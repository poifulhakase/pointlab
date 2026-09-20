"""決算発表予定日（JPX 公開サイトの Excel）。

「保有期間内に決算をまたぐか」を判定するための一次情報。SPEC 5.2 / 6（第3層）。

なぜ JPX の Excel か（他の候補を落とした理由）:
  - **J-Quants の決算発表予定日API**は、無料枠でも取れるが
    **翌営業日ぶんだけ・3月期と9月期の会社だけ**（REIT除く）。2〜14日スイングで
    「保有期間内に決算が入るか」を見るには足りない。登録も要る。
  - 株探・Yahoo!ファイナンス等のスクレイピングは**規約で禁止**。
  - JPX の一覧は**登録もAPIキーも要らず**、決算期末の月ごとに数週間先まで載る。
    ぽいロボ本体が JPX の週次PDFを取っているのと同じ性質の取得元。

🔴 **予定は変わる**。JPX 自身が「現在」の予定として出している。
   「未定」の行は捨てる（日付を勝手に決めない）。取得した基準日を一緒に持ち、
   使う側が鮮度を見られるようにする。

🔴 **過去日の再実行では厳密な point-in-time にならない**。手に入るのは「いま時点の予定表」で、
   その日に公表されていた予定表ではない。`as_of` より前の予定は返さないことで
   最低限の先読みは防ぐが、予定が後から変わっていた場合までは再現できない。
   バックテスト（Phase 11）で使うときはこの限界を承知で使う。

🔴 取れなくてもその日の実行は止めない（決算の判定だけ「データなし」に落ちる）。
"""

from __future__ import annotations

import io
import json
import logging
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import requests

log = logging.getLogger(__name__)

INDEX_URL = ("https://www.jpx.co.jp/listing/event-schedules/"
             "financial-announcement/index.html")
BASE_URL = "https://www.jpx.co.jp"
# 一覧ページに貼られている Excel（決算期末の月ごとに1本）
LINK_PATTERN = re.compile(r'href="(/listing/event-schedules/[^"]+\.xlsx)"')
USER_AGENT = "robotrade/1.0"


class EarningsSchedule:
    """銘柄コード → これから先の決算発表予定日。

    取得した内容はファイルに貯める（毎回JPXを叩かない・落ちていても昨日ぶんで動く）。
    """

    def __init__(self, cfg, *, session: Any = None):
        self.cfg = cfg
        self.session = session or requests.Session()
        self.index_url = str(cfg.get("earnings.index_url", INDEX_URL))
        self.cache_path = cfg.path("earnings.cache_path", "data/earnings_schedule.json")
        self.max_age_days = int(cfg.get("earnings.cache_max_age_days", 3))
        self.timeout = float(cfg.get("earnings.timeout_sec", 30))
        self._data: dict[str, Any] | None = None

    # ------------------------------------------------------------ 公開

    def next_announcement(self, ticker: str, as_of: date) -> dict[str, Any] | None:
        """`as_of` 以降で最も近い決算発表予定。無ければ None。

        🔴 `as_of` より前の予定は返さない（終わった決算を「これから」と言わない）。
        """
        data = self._load()
        if not data:
            return None
        code = ticker.split(".")[0]
        for row in data.get("schedule", {}).get(code, []):
            when = _parse_date(row.get("date"))
            if when is None or when < as_of:
                continue
            return {
                "date": when.isoformat(),
                "days_until": (when - as_of).days,
                "kind": row.get("kind", ""),
                "as_of": data.get("as_of", ""),
            }
        return None

    def is_available(self) -> bool:
        """予定表が手元にあるか（無いときは「データなし」と正直に言うため）。"""
        return bool(self._load())

    def refresh(self) -> int:
        """JPX から取り直してキャッシュに書く。入った銘柄数を返す。"""
        schedule: dict[str, list[dict[str, str]]] = {}
        for url in self._workbook_urls():
            for code, row in self._read_workbook(url):
                schedule.setdefault(code, []).append(row)

        if not schedule:
            log.warning("決算発表予定日が1件も取れなかった（JPXの様式変更を疑う）")
            return 0

        for rows in schedule.values():
            rows.sort(key=lambda r: r["date"])

        payload = {
            "as_of": date.today().isoformat(),
            "source": self.index_url,
            "schedule": schedule,
        }
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        self._data = payload
        log.info("決算発表予定日を更新: %d銘柄", len(schedule))
        return len(schedule)

    # ------------------------------------------------------------ 中身

    def _load(self) -> dict[str, Any] | None:
        if self._data is not None:
            return self._data or None
        if self.cache_path.exists():
            try:
                self._data = json.loads(self.cache_path.read_text(encoding="utf-8"))
            except Exception as exc:  # noqa: BLE001
                log.warning("決算予定のキャッシュが読めない: %s", exc)
                self._data = {}
            if self._fresh_enough():
                return self._data or None
        try:
            self.refresh()
        except Exception as exc:  # noqa: BLE001
            # 🔴 ここで落とすとその日の実行ごと止まる。古いキャッシュで続ける。
            log.warning("決算発表予定日の取得に失敗: %s", exc)
            self._data = self._data or {}
        return self._data or None

    def _fresh_enough(self) -> bool:
        as_of = _parse_date((self._data or {}).get("as_of"))
        if as_of is None:
            return False
        return (date.today() - as_of).days <= self.max_age_days

    def _workbook_urls(self) -> list[str]:
        res = self.session.get(self.index_url, timeout=self.timeout,
                               headers={"User-Agent": USER_AGENT})
        res.raise_for_status()
        seen: list[str] = []
        for path in LINK_PATTERN.findall(res.text):
            url = BASE_URL + path
            if url not in seen:
                seen.append(url)
        if not seen:
            log.warning("一覧ページに Excel のリンクが無い（様式変更を疑う）")
        return seen

    def _read_workbook(self, url: str):
        res = self.session.get(url, timeout=self.timeout,
                               headers={"User-Agent": USER_AGENT})
        res.raise_for_status()
        # 見出しが2行（日本語＋英語）で、上に表題が数行ある。列位置で読む。
        frame = pd.read_excel(io.BytesIO(res.content), header=None, skiprows=5)
        for row in frame.itertuples(index=False):
            values = list(row)
            when = _parse_date(values[0] if values else None)
            code = _normalize_code(values[1] if len(values) > 1 else None)
            if when is None or not code:
                continue      # 「未定」や空行。日付を勝手に決めない
            yield code, {"date": when.isoformat(),
                         "kind": str(values[7]).strip() if len(values) > 7
                                 and not pd.isna(values[7]) else ""}


def _normalize_code(value: Any) -> str:
    """4桁の銘柄コードにする。5桁（末尾0）で来ることがある。"""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    if len(text) == 5 and text.endswith("0"):
        text = text[:4]
    return text if re.fullmatch(r"[0-9A-Z]{4}", text) else ""


def _parse_date(value: Any) -> date | None:
    if value is None or value == "" or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def from_config(cfg) -> Any:
    """config の `earnings.enabled` で有効・無効を決める。"""
    if not cfg.get("earnings.enabled", True):
        return None
    return EarningsSchedule(cfg)
