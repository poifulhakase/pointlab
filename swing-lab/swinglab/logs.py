"""判断ログ（SPEC 9 監査可能性）。

🔴 各ステップの LLM 入出力（**生の JSON**）は必ずログに残す。
   あとで「なぜこの判断をしたか」を追えるようにする。
🔴 実行ごとに（入力データ・各AIの生出力・最終判断・約定結果）を1つのスナップショットとして
   保存する。障害時の再現とデバッグに効く。
🔴 後知恵バイアス対策（SPEC 12.1）: AIの読みは**結果が出る前に確定**させる。
   ログは追記のみで、後から書き換えない。

🔵 logs/ はリポジトリ直下の .gitignore に `logs` があるため git に入らない。
   判断ログと成績DBは**ローカルだけの資産**なので、バックアップは手動。
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


class RunLogger:
    """1営業日ぶんの実行ログ。"""

    def __init__(self, log_dir: Path | str, run_date: date):
        self.dir = Path(log_dir) / run_date.isoformat()
        self.dir.mkdir(parents=True, exist_ok=True)
        self.run_date = run_date
        self.calls_path = self.dir / "agent_calls.jsonl"
        self.snapshot: dict[str, Any] = {
            "run_date": run_date.isoformat(),
            "started_at": datetime.now().isoformat(timespec="seconds"),
            "steps": {},
        }

    def agent_call(self, record: Any) -> None:
        """LLM 呼び出し1件を追記（成功も失敗も）。"""
        with self.calls_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record.as_dict(), ensure_ascii=False, default=str) + "\n")

    def step(self, name: str, payload: Any) -> None:
        self.snapshot["steps"][name] = payload

    def finish(self, status: str, note: str = "") -> Path:
        self.snapshot["finished_at"] = datetime.now().isoformat(timespec="seconds")
        self.snapshot["status"] = status
        if note:
            self.snapshot["note"] = note
        path = self.dir / "snapshot.json"
        path.write_text(
            json.dumps(self.snapshot, ensure_ascii=False, indent=1, default=str),
            encoding="utf-8",
        )
        return path


def setup_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )
    # yfinance / httpx の通信ログは煩いので落とす
    for noisy in ("httpx", "httpx2", "httpcore", "anthropic", "yfinance", "peewee", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
