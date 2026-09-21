"""Buffer 経由で X に投稿する（`NOTE_FEED.md` の延長）。

なぜ X API を直接叩かないか（2026-09-20 に調べた結論）:
  🔴 X API は2026年2月に**無料枠が廃止**され従量課金が既定になり、4月から
     **リンク付き投稿は1件 $0.20**。副業図鑑は実測 1日2.78件（月83件）で、
     全件流すと **月$16.6**（約2,500円）かかる。
  🔴 Zapier も同じ。2026年2月に X 連携が復活したが**自分の X Developer App を繋ぐ方式**で、
     従量課金はそのまま自分持ち。Make・IFTTT も同様。
  ✅ Buffer は X API の費用を**自分で払う必要がない**（Buffer 側の枠に載る）。
     無料プランで API キーを発行でき、実測で投稿・削除まで通った。

🔴 Buffer の API は **GraphQL**（REST ではない）。すべて `https://api.buffer.com/graphql` に
   POST し、`Authorization: Bearer <key>` を付ける。
🔴 無料プランは**1チャンネルあたり予約10件まで**。溜めすぎると投稿が弾かれるので、
   出すのは1日1件に絞る（`feeds` 側で制御）。
🔴 API キーには**有効期限がある**。切れると投稿が黙って止まるので、
   期限を長めにして `BUFFER_KEY_EXPIRES` に控えておく（`check_key_expiry`）。
"""

from __future__ import annotations

import datetime as dt
import logging
from typing import Any

import requests

log = logging.getLogger(__name__)

ENDPOINT = "https://api.buffer.com/graphql"
TIMEOUT = 20

# createPost / deletePost はどちらも union を返す。成功と失敗を同じ形で受けるための断片。
_POST_RESULT = """
  __typename
  ... on PostActionSuccess { post { id status dueAt } }
  ... on NotFoundError { message }
  ... on UnauthorizedError { message }
  ... on UnexpectedError { message }
  ... on RestProxyError { message }
  ... on LimitReachedError { message }
  ... on InvalidInputError { message }
"""

CREATE_POST = f"mutation($i: CreatePostInput!) {{ createPost(input: $i) {{ {_POST_RESULT} }} }}"
DELETE_POST = """
mutation($id: PostId!) {
  deletePost(input: {id: $id}) {
    __typename
    ... on DeletePostSuccess { id }
    ... on VoidMutationError { message }
  }
}
"""
CHANNELS = """
query($i: ChannelsInput!) { channels(input: $i) { id name service } }
"""


class BufferError(RuntimeError):
    """Buffer が投稿を受け付けなかった。"""


class BufferClient:
    """Buffer の GraphQL を叩くだけの薄いクライアント。"""

    def __init__(self, api_key: str, *, session: Any = None, endpoint: str = ENDPOINT):
        self.api_key = (api_key or "").strip()
        self.session = session or requests.Session()
        self.endpoint = endpoint

    @property
    def enabled(self) -> bool:
        """鍵が無いときは**黙って何もしない**（設定前でも日次バッチを壊さない）。"""
        return bool(self.api_key)

    # -------------------------------------------------- 低レベル

    def call(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        res = self.session.post(
            self.endpoint,
            headers={"Authorization": f"Bearer {self.api_key}",
                     "Content-Type": "application/json"},
            json={"query": query, "variables": variables or {}},
            timeout=TIMEOUT,
        )
        # 🔵 鍵は実質パスワード。エラーでも本文に鍵は出ないが、ヘッダはログに出さない
        if res.status_code == 401:
            raise BufferError("Buffer の API キーが無効（期限切れか権限不足）")
        res.raise_for_status()
        payload = res.json() or {}
        if payload.get("errors"):
            first = payload["errors"][0].get("message", "不明なエラー")
            raise BufferError(f"Buffer GraphQL: {first}")
        return payload.get("data") or {}

    # -------------------------------------------------- 使うところ

    def channels(self, organization_id: str) -> list[dict[str, Any]]:
        data = self.call(CHANNELS, {"i": {"organizationId": organization_id}})
        return data.get("channels") or []

    def create_post(self, *, channel_id: str, text: str,
                    due_at: dt.datetime | None = None) -> str:
        """予約投稿を1件作る。返すのは post id（あとで消せるように）。

        🔴 `due_at` を渡さないと `shareNow`＝**即時投稿**になる。日次バッチは
           夕方に走るので、渡さないと毎回その時刻に出る。時刻はこちらで決める。
        """
        payload: dict[str, Any] = {
            "channelId": channel_id,
            "text": text,
            "schedulingType": "automatic",   # Buffer が自動で送る（通知して人が押す、ではない）
            "needsApproval": False,
            "assets": [],
        }
        if due_at is None:
            payload["mode"] = "shareNow"
        else:
            payload["mode"] = "customScheduled"
            # 🔴 Buffer は UTC の ISO8601（ミリ秒つき）で受ける
            payload["dueAt"] = _to_iso_utc(due_at)

        result = self.call(CREATE_POST, {"i": payload}).get("createPost") or {}
        if result.get("__typename") != "PostActionSuccess":
            raise BufferError(f"{result.get('__typename')}: {result.get('message', '')}")
        return str((result.get("post") or {}).get("id", ""))

    def delete_post(self, post_id: str) -> bool:
        result = self.call(DELETE_POST, {"id": post_id}).get("deletePost") or {}
        if result.get("__typename") == "DeletePostSuccess":
            return True
        log.warning("Buffer の投稿を消せなかった %s: %s", post_id, result.get("message", ""))
        return False


def _to_iso_utc(when: dt.datetime) -> str:
    """Buffer が受け取る形（`2027-01-01T03:00:00.000Z`）にする。

    🔴 タイムゾーンなしの datetime は**ローカル時刻として扱う**。UTC と決め打ちすると
       日本時間の朝に出したいものが9時間ずれる。
    """
    if when.tzinfo is None:
        when = when.astimezone()
    return when.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def check_key_expiry(cfg, *, today: dt.date | None = None) -> str:
    """鍵の期限が近い／分からないときに、その旨を返す（問題なければ空文字）。

    🔴 期限切れは**黙った故障**になる。投稿が止まっても、止まった理由がどこにも出ない
       （SP-API の鍵が180日で切れて定期処理が落ちたのと同じ壊れ方）。
    🔴 期限は Buffer の API から読めないので、config に手で書いた値を見るしかない。
       **書かれていないこと自体を警告する**（黙って「問題なし」にしない）。
    """
    raw = str(cfg.get("buffer.key_expires", "") or "").strip()
    if not raw:
        return ("Buffer の鍵の期限が config に書かれていない"
                "（Settings → API で確認して buffer.key_expires に書く）")
    try:
        expires = dt.date.fromisoformat(raw)
    except ValueError:
        return f"Buffer の鍵の期限が日付として読めない: {raw!r}"

    left = (expires - (today or dt.date.today())).days
    warn_days = int(cfg.get("buffer.expiry_warn_days", 14))
    if left < 0:
        return f"Buffer の鍵は {raw} に切れている（投稿は止まっている）"
    if left <= warn_days:
        return f"Buffer の鍵はあと{left}日で切れる（{raw}）。発行し直して .env を差し替える"
    return ""


def from_config(cfg) -> BufferClient | None:
    """config の `buffer.enabled` と `.env` の `BUFFER_API_KEY` で作る。"""
    if not cfg.get("buffer.enabled", False):
        return None
    key = getattr(cfg.secrets, "buffer_api_key", "") or ""
    client = BufferClient(key)
    if not client.enabled:
        log.warning("Buffer: BUFFER_API_KEY が未設定なので投稿しない")
        return None
    warning = check_key_expiry(cfg)
    if warning:
        log.warning("🔴 %s", warning)
    return client
