"""X に出す文面を組み立てる（記事1本ぶん）。

形（@Aojiru_Hakase の実際の投稿に合わせた・2026-09-20 に運用者と確認）:

    {博士の一言・2〜3行}

    {記事タイトル}｜{書き手}
    {記事URL}
    #副業 #note

🔴 **カギカッコで囲まない**。このアカウントは**博士本人**なので、
   「博士「〜」」ではなく**一人称でそのまま語る**（Discord の #判断サマリ とは別物。
   あちらは ぽいロボ が博士に報告する形なのでカギカッコが要る）。
🔴 **絵文字を付けない**。既存の投稿に絵文字は入っていない。
🔴 文体は **〜じゃ / 〜かもしれん / 諸君**（welcomebot の `greeting.py` と同じ人格）。
   ここを変えるなら向こうも一緒に直す。

🔴 **ハッシュタグは候補から選ばせる**（`sns_post.hashtag_choices`）。
   AI に自由に作らせると、存在しない語や的外れなタグが混ざる。
   選択肢の外が返ってきたら捨てる（`enum` を弾くのと同じ考え方）。

🔴 **280字を超えない**。🔴 X は**日本語を1文字2**として数える（実質140字）。
   URL は中身に関係なく **t.co の23**。超えたら**一言→タイトルの順で削る**
   （URLと出典は消さない）。2026-09-20 に「151字」のつもりで投稿して弾かれた。

🔴 **一言が作れなくても投稿は止めない**。AI が落ちたら一言なしで出す
   （記事の紹介という本体は成立する）。

🔴 **他人の記事**を紹介する（共同マガジンの寄稿）。書き手の名前を必ず添える。
"""

from __future__ import annotations

import logging
import re
from typing import Any

log = logging.getLogger(__name__)

# X の上限。URL は t.co に置き換わるので実際の長さに関わらずこの文字数で数える。
MAX_CHARS = 280
URL_WEIGHT = 23

# 🔴 SNS によって**日本語の数え方が違う**。
#    X は日本語を1文字2として数える（実質140字）。Threads は1文字1で500字。
#    ここを揃えてしまうと、X で弾かれるか Threads で無駄に短くなる。
CJK_WEIGHT_X = 2
CJK_WEIGHT_PLAIN = 1

# 🔴 note の表示名は**プロフィール文になっていることがある**
#    （例「ハル ｜基本フォロバ100 | note×AIで資産型コンテンツの作り方発信中」）。
#    そのまま載せると一言の余地を食い尽くし、博士の言葉が丸ごと落ちる。
#    出典として要るのは**名前の部分**なので、区切り記号で切って詰める。
MAX_CREDIT = 16
_CREDIT_SPLIT = re.compile(r"[｜|/／・]")

SYSTEM_TEMPLATE = """あなたは「ぽいふる博士」です。{where}で、
共同マガジン「普通じゃない副業図鑑」に届いた記事を紹介します。

🔴 **記事を書いたのはあなたではありません**。あなたはマガジンの運営者で、
   寄稿された他の人の記事を「こんな記事が届いた」と紹介する立場です。
   ここを外すと、書き手の考えを勝手に代弁したり、書き手に迷惑をかけることになります。

人格:
- 収入の自動化を研究している博士。ポイ活・副業・投資・節税を「無理なく続く仕組み」として見る。
- 文体は **〜じゃ / 〜かもしれん / 〜のう**。読者は「諸君」と呼んでよい。
- 断定しすぎない。「〜かもしれん」と余白を残すのがこの人の語り口。

書き方（必ず守る）:
- **{length_hint}**。1行は短く切り、読みやすく改行する。
- **記事に書いてあることだけ**を、題材の紹介として1つ挙げる。
- 🔴 **評価しない**。良い/悪い、正しい/間違い、おすすめ、を言わない。
  記事の主張に賛成も反対もしない（書いたのは他の人）。
- 🔴 **断定しない**。「稼げる」「儲かる」「必ず」「絶対」のような言い切りを書かない。
  収入や効果の見込みを語らない。
- 🔴 記事に書かれていないことを足さない。数字・効果・体験・背景を作らない。
- 🔴 書き手を褒めも批判もしない。人物評を書かない。
- 🔴 自分の名乗り（「ぽいふる博士だ」）は書かない。すでに名前が出ている。
- 🔴 「ぜひ読んでみてください」のような宣伝文句・煽り・感嘆符の連打は書かない。
- 🔴 ハッシュタグ・URL・絵文字・かぎかっこは書かない（こちらで付ける）。

迷ったら、**記事が何について書かれているかを述べるだけ**にしてください。

出力は必ず指定のツール形式（JSON）で返してください。"""


def system_for(*, where: str, length_hint: str) -> str:
    """宛先ごとの指示。🔴 字数の目安は宛先で変える（X と Threads で上限が違う）。"""
    return SYSTEM_TEMPLATE.format(where=where, length_hint=length_hint)


# 🔵 既存の呼び出しが壊れないように、X 向けを既定として残しておく
SYSTEM = system_for(where="X（@Aojiru_Hakase）", length_hint="2〜3行・50文字以内")

# 🔴 言い切り・誇大の語。**他人の記事**を紹介する立場なので、これが入ったら
#    一言そのものを捨てる（AI の指示だけに頼らず、コードでも止める）。
#    運用者はマガジンの運営者であって記事の書き手ではない＝
#    ここで断定すると、書いていない人の言葉として広まってしまう。
BANNED = (
    "稼げ", "儲か", "必ず", "絶対", "確実", "保証", "間違いない",
    "おすすめ", "オススメ", "ぜひ",
)

# 🔴 「べき」は**単語で切ると巻き込む**。「見つめ直すべきか」「どこを見るべきか」は
#    ただの問いかけで、推奨ではない（2026-09-21 に実際に誤判定して一言が落ちた）。
#    推奨として使われている形＝**言い切っている**ものだけを弾く。
BANNED_PATTERNS = (
    re.compile(r"すべき(だ|です|でしょう|である)"),
    re.compile(r"べきだ(ろう|と思)?"),
    re.compile(r"読んでみて"),
)


def is_safe(comment: str) -> bool:
    """一言として出してよいか。ひとつでも当たれば出さない。"""
    text = str(comment or "")
    if any(word in text for word in BANNED):
        return False
    return not any(p.search(text) for p in BANNED_PATTERNS)


def build_tool_schema(choices: list[str]) -> dict[str, Any]:
    """一言とハッシュタグを同時に返させる。タグは**候補の中からだけ**選ばせる。"""
    return {
        "name": "submit_x_post",
        "description": "X に出す一言と、付けるハッシュタグを返す",
        "strict": True,
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["comment", "hashtags"],
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "ぽいふる博士の語り（2〜3行・50文字以内・記号や絵文字・かぎかっこなし）",
                },
                "hashtags": {
                    "type": "array",
                    "description": "記事に合うものを1〜3個。候補以外は選ばない",
                    "items": {"type": "string", "enum": choices} if choices else {"type": "string"},
                },
            },
        },
    }


def build_user(*, title: str, summary: str, creator: str, choices: list[str]) -> str:
    lines = [
        "次の記事を紹介する一言を書いてください。",
        "",
        f"タイトル: {title}",
    ]
    if creator:
        lines.append(f"書き手: {creator}")
    if summary:
        lines.append(f"書き出し: {summary[:300]}")
    if choices:
        lines += ["", "ハッシュタグの候補（この中からだけ選ぶ。合うものが無ければ空でよい）:",
                  " ".join(choices)]
    return "\n".join(lines)


def pick_hashtags(raw: Any, *, fixed: list[str], choices: list[str], limit: int) -> list[str]:
    """固定タグ＋AIが選んだタグ。🔴 候補の外と重複は捨てる。"""
    allowed = set(choices)
    out = list(fixed)
    for tag in (raw or []):
        tag = str(tag).strip()
        if not tag:
            continue
        if allowed and tag not in allowed:
            # 🔴 黙って混ぜない。候補の外＝プロンプトが効いていない合図なので残す
            log.warning("候補に無いハッシュタグを捨てた: %s", tag)
            continue
        if tag not in out:
            out.append(tag)
    return out[:limit]


def compose(*, title: str, link: str, creator: str, comment: str,
            hashtags: list[str], emoji: str = "",
            max_chars: int = MAX_CHARS, cjk_weight: int = CJK_WEIGHT_X) -> str:
    """投稿の本文を組み立てて、宛先の上限に収める。

    🔴 `cjk_weight` は宛先ごとに変える。X は日本語を2として数える（実質140字）、
       Threads は1で500字。ここを揃えると X で弾かれるか Threads で無駄に短くなる。
    🔴 `emoji` は既定で空。既存の投稿に絵文字が無いので付けない（引数は残してある）。
    """
    tags = " ".join(hashtags)
    comment = _clean(comment)
    if comment and not is_safe(comment):
        # 🔴 黙って直さない。落としたことをログに残す（プロンプトが効いていない合図）
        log.warning("言い切り・誇大の語が入ったので一言を落とした: %s", comment[:60])
        comment = ""
    head = f"{emoji} {title}".strip() if emoji else title
    credit = shorten_credit(creator)

    def render(t: str, c: str) -> str:
        blocks: list[str] = []
        if c:
            blocks.append(c)
        # 🔴 他人の記事なので書き手を必ず添える（共同マガジンの寄稿）
        line = f"{t}｜{credit}" if credit else t
        tail = [line, link]
        if tags:
            tail.append(tags)
        blocks.append("\n".join(tail))
        return "\n\n".join(blocks)

    def fits(text: str) -> bool:
        return _weigh(text, link, cjk_weight=cjk_weight) <= max_chars

    text = render(head, comment)
    if fits(text):
        return text

    # 🔴 削る順番＝一言 → タイトル。URLと出典（｜書き手）は消さない
    text = render(head, "")
    if fits(text):
        return text

    over = _weigh(text, link, cjk_weight=cjk_weight) - max_chars
    short = head[: max(10, len(head) - over - 1)] + "…"
    return render(short, "")


def shorten_credit(creator: str) -> str:
    """書き手の表示名を、出典として載せられる長さに詰める。

    🔴 消さない。他人の記事なので**誰が書いたかは必ず残す**。
       長いときに落とすのは肩書き・宣伝文のほうで、名前は残す。
    """
    raw = str(creator or "").strip()
    if not raw:
        return ""
    head = _CREDIT_SPLIT.split(raw)[0].strip() or raw
    if len(head) <= MAX_CREDIT:
        return head
    return head[: MAX_CREDIT - 1] + "…"


def _clean(text: str) -> str:
    """AI が付けてくることのある飾りを落とす（プロンプトでも禁じているが二重に）。

    🔴 **改行は残す**。博士の投稿は短い行に切って読ませる形なので、
       空白にまとめると1本の長い行になって別物になる（2026-09-20 に一度やってしまった）。
    """
    t = str(text or "").strip()
    t = re.sub(r"^[「『\"']+|[」』\"']+$", "", t).strip()
    t = re.sub(r"#\S+", "", t)          # ハッシュタグはこちらで付ける
    t = re.sub(r"https?://\S+", "", t)  # URL も
    t = re.sub(r"[ \t　]+", " ", t)  # 横方向の空白だけ詰める
    t = re.sub(r" *\n *", "\n", t)       # 行頭行末の空白を落とす
    return re.sub(r"\n{3,}", "\n\n", t).strip()


# 🔴 X は**文字の種類で重みが違う**（twitter-text の weighted length）。
#    ASCII・記号は1、それ以外（**日本語を含む**）は2。つまり日本語は実質140字まで。
#    2026-09-20 に「151字」のつもりで投稿して Buffer に 280字超で弾かれた。
#    下の範囲が重み1、それ以外は2（twitter-text の既定の設定と同じ）。
_LIGHT_RANGES = (
    (0x0000, 0x10FF),
    (0x2000, 0x200D),
    (0x2010, 0x201F),
    (0x2032, 0x2037),
)


def _char_weight(ch: str, cjk_weight: int) -> int:
    code = ord(ch)
    if any(lo <= code <= hi for lo, hi in _LIGHT_RANGES):
        return 1
    return cjk_weight


def _weigh(text: str, link: str, *, cjk_weight: int = CJK_WEIGHT_X) -> int:
    """宛先の数え方に寄せる。

    - 日本語は **1文字 `cjk_weight`**（X は2／Threads は1）
    - URL は中身の長さに関係なく **t.co の23**（X の仕様。他は実寸だが、
      短い方に倒れるだけなので同じ数え方で安全側に寄せる）
    """
    body = text
    urls = 0
    if link and link in body:
        body = body.replace(link, "")
        urls = URL_WEIGHT
    return sum(_char_weight(c, cjk_weight) for c in body) + urls
