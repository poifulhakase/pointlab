import { useState, useRef, useEffect } from 'react'

// 波動の書（DATA → 未来ガジェット。旧名「フォーメーション分析」）
//
// 🔵 「チャートパターン」ではなく**フォーメーション分析**。テクニカル分析での正式な呼称で、
//    値動きが作る「形（フォーメーション）」から次の展開を読む手法群を指す。
//
// 🔴 このページの主張は「パターンを覚えよう」ではない。
//    **26年の日経で測ったら、方向すら安定しなかった**という実測を一緒に出すこと。
//    教科書の説明だけ並べると「これを見れば当たる」と読めてしまう。
//    測った結果を横に置くことで、形の意味と、当たらなさの両方が伝わる。
//
// 🔵 図は画像ではなくSVGで描く。読み込みを増やさず、ダーク/ライト両方に追随できる。
//
// 🔴 実測の出どころは `scripts/analyze-chart-patterns.mjs`（2026-08-11）。
//    数字を書き換えるときは必ずスクリプトを走らせ直すこと。ここで手打ちしない。

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose: () => void }

type Pattern = {
  name: string
  kind: 'top' | 'bottom' | 'cont-up' | 'cont-down'
  /** 教科書での意味 */
  says: string
  /** 見つけ方 */
  how: string
  /** 26年の日経で測った結果。null = まだ測っていない */
  measured: string | null
  /** ポリラインの点（0-100 の座標系。y は上が0） */
  path: number[][]
  /** 水平線（ネックライン等）。[y, x1, x2] */
  lines?: { y: number; x1: number; x2: number; kind: 'neck' | 'res' | 'sup' }[]
  /** 斜めの線（トレンドライン）。[x1,y1,x2,y2] */
  slopes?: { p: number[]; kind: 'up' | 'down' }[]
}

// ── 16種 ──────────────────────────────────────────────────────────────────
const PATTERNS: Pattern[] = [
  {
    name: 'ヘッド＆ショルダー（三尊）',
    kind: 'top',
    says: '上昇の終わり。中央の山がいちばん高く、両肩がそろう。ネックラインを割ったら成立。',
    how: '山3つで真ん中が最も高い／両肩の高さが近い／谷2つを結んだ線を下抜け',
    measured: '🔴 26年で測ると 符号すら定まらない。9通りの定義で先20日が +1.15% 〜 −1.34% とバラバラ（n=8〜26）。「下落転換の代表格」だが、日経では確認できなかった。',
    path: [[0, 70], [12, 45], [22, 58], [34, 22], [46, 60], [58, 38], [70, 62], [85, 82], [100, 90]],
    lines: [{ y: 60, x1: 18, x2: 74, kind: 'neck' }],
  },
  {
    name: '逆ヘッド＆ショルダー（逆三尊）',
    kind: 'bottom',
    says: '下落の終わり。中央の谷がいちばん深く、両肩がそろう。ネックラインを超えたら成立。',
    how: '谷3つで真ん中が最も深い／両肩の深さが近い／山2つを結んだ線を上抜け',
    measured: '🔴 先5日で +0.81〜+1.16%（基準 +0.16%）と方向は合うが、t=0.72〜1.91 で統計的には未確定（n=10〜26）。',
    path: [[0, 30], [12, 55], [22, 42], [34, 78], [46, 40], [58, 62], [70, 38], [85, 18], [100, 10]],
    lines: [{ y: 40, x1: 18, x2: 74, kind: 'neck' }],
  },
  {
    name: 'ダブルトップ',
    kind: 'top',
    says: '同じ高さの山を2つ作って失速。間の谷を割ったら成立。',
    how: '山2つの高さが近い（1%以内など）／その間の谷を下抜け',
    measured: '🔴 先20日で −0.99% 〜 +1.19% と符号が定まらない（8通り・n=15〜91）。最大でも t=1.01。',
    path: [[0, 75], [15, 30], [32, 58], [50, 28], [68, 62], [85, 80], [100, 88]],
    lines: [{ y: 58, x1: 10, x2: 74, kind: 'neck' }],
  },
  {
    name: 'ダブルボトム',
    kind: 'bottom',
    says: '同じ深さの谷を2つ作って底打ち。間の山を超えたら成立。',
    how: '谷2つの深さが近い／その間の山を上抜け',
    measured: '🔵 16種でいちばんマシ。先5日で +0.73〜+0.82%（基準 +0.16%）と9通りすべてプラス。ただし基準（t≧2）に届いたのは1通りだけ（t=2.57・n=97）。',
    path: [[0, 25], [15, 70], [32, 42], [50, 72], [68, 38], [85, 20], [100, 12]],
    lines: [{ y: 42, x1: 10, x2: 74, kind: 'neck' }],
  },
  {
    name: 'トリプルトップ',
    kind: 'top',
    says: '同じ高さの山を3つ作って失速。谷を割ったら成立。',
    how: '山3つの高さが近い／いちばん低い谷を下抜け',
    measured: '🔴 先20日で −1.76% 〜 −0.31% と方向は合うが t=−0.40 〜 −1.49 で未確定。n=13〜40 と少ない。',
    path: [[0, 78], [12, 32], [26, 58], [40, 30], [54, 58], [68, 31], [82, 62], [100, 85]],
    lines: [{ y: 58, x1: 8, x2: 86, kind: 'neck' }],
  },
  {
    name: 'トリプルボトム',
    kind: 'bottom',
    says: '同じ深さの谷を3つ作って底打ち。山を超えたら成立。',
    how: '谷3つの深さが近い／いちばん高い山を上抜け',
    measured: null,
    path: [[0, 22], [12, 68], [26, 42], [40, 70], [54, 42], [68, 69], [82, 38], [100, 15]],
    lines: [{ y: 42, x1: 8, x2: 86, kind: 'neck' }],
  },
  {
    name: '上昇フラッグ',
    kind: 'cont-up',
    says: '急騰したあと、下向きの狭いレンジで一服。上抜けたら上昇が続く。',
    how: '大きな上げ（ポール）→ 平行な2本の線で下向きの箱 → 上抜け',
    measured: null,
    path: [[0, 88], [18, 30], [30, 45], [42, 34], [54, 52], [66, 42], [78, 58], [88, 30], [100, 10]],
    slopes: [{ p: [18, 28, 80, 50], kind: 'down' }, { p: [22, 48, 84, 66], kind: 'down' }],
  },
  {
    name: '下降フラッグ',
    kind: 'cont-down',
    says: '急落したあと、上向きの狭いレンジで一服。下抜けたら下落が続く。',
    how: '大きな下げ（ポール）→ 平行な2本の線で上向きの箱 → 下抜け',
    measured: null,
    path: [[0, 12], [18, 70], [30, 55], [42, 66], [54, 48], [66, 58], [78, 42], [88, 70], [100, 90]],
    slopes: [{ p: [18, 72, 80, 50], kind: 'up' }, { p: [22, 52, 84, 34], kind: 'up' }],
  },
  {
    name: '上昇ウェッジ',
    kind: 'cont-down',
    says: '2本の線が上向きに狭まっていく。🔴 形は上向きだが下抜けやすいとされる。',
    how: '高値も安値も切り上がるが、上値の傾きのほうがゆるい／下抜けで成立',
    measured: null,
    path: [[0, 80], [14, 50], [26, 66], [40, 42], [52, 58], [66, 38], [78, 50], [88, 62], [100, 88]],
    slopes: [{ p: [10, 52, 82, 36], kind: 'up' }, { p: [10, 74, 82, 52], kind: 'up' }],
  },
  {
    name: '下降ウェッジ',
    kind: 'cont-up',
    says: '2本の線が下向きに狭まっていく。🔴 形は下向きだが上抜けやすいとされる。',
    how: '高値も安値も切り下がるが、下値の傾きのほうがゆるい／上抜けで成立',
    measured: null,
    path: [[0, 20], [14, 52], [26, 36], [40, 60], [52, 44], [66, 64], [78, 52], [88, 36], [100, 12]],
    slopes: [{ p: [10, 48, 82, 64], kind: 'down' }, { p: [10, 26, 82, 48], kind: 'down' }],
  },
  {
    name: '上昇三角保ち合い',
    kind: 'cont-up',
    says: '上値は同じ水準で止まるが、安値が切り上がる。上値を抜けたら上昇。',
    how: '水平な上値ライン＋切り上がる下値ライン／上抜けで成立',
    measured: null,
    path: [[0, 72], [14, 32], [28, 62], [42, 33], [56, 52], [70, 32], [82, 44], [92, 26], [100, 8]],
    lines: [{ y: 32, x1: 8, x2: 88, kind: 'res' }],
    slopes: [{ p: [10, 74, 86, 42], kind: 'up' }],
  },
  {
    name: '下降三角保ち合い',
    kind: 'cont-down',
    says: '下値は同じ水準で止まるが、高値が切り下がる。下値を割ったら下落。',
    how: '水平な下値ライン＋切り下がる上値ライン／下抜けで成立',
    measured: null,
    path: [[0, 28], [14, 68], [28, 38], [42, 67], [56, 48], [70, 68], [82, 56], [92, 74], [100, 92]],
    lines: [{ y: 68, x1: 8, x2: 88, kind: 'sup' }],
    slopes: [{ p: [10, 26, 86, 58], kind: 'down' }],
  },
  {
    name: '対称三角保ち合い',
    kind: 'cont-up',
    says: '上下から狭まって、どちらかへ放れる。🔴 方向は形からは決まらない。',
    how: '切り下がる上値ライン＋切り上がる下値ライン／抜けた方向へ',
    measured: null,
    path: [[0, 18], [14, 74], [28, 30], [42, 66], [56, 38], [70, 58], [82, 44], [92, 52], [100, 20]],
    slopes: [{ p: [10, 22, 88, 48], kind: 'down' }, { p: [10, 80, 88, 50], kind: 'up' }],
  },
  {
    name: '上昇レクタングル',
    kind: 'cont-up',
    says: '上げの途中で、同じ幅の箱を往復。上を抜けたら上昇が続く。',
    how: '水平な上値と下値のあいだを何度か往復／上抜けで成立',
    measured: null,
    path: [[0, 82], [12, 36], [26, 64], [40, 36], [54, 64], [68, 36], [80, 60], [90, 30], [100, 8]],
    lines: [{ y: 36, x1: 8, x2: 86, kind: 'res' }, { y: 64, x1: 8, x2: 86, kind: 'sup' }],
  },
  {
    name: '下降レクタングル',
    kind: 'cont-down',
    says: '下げの途中で、同じ幅の箱を往復。下を割ったら下落が続く。',
    how: '水平な上値と下値のあいだを何度か往復／下抜けで成立',
    measured: null,
    path: [[0, 18], [12, 64], [26, 36], [40, 64], [54, 36], [68, 64], [80, 40], [90, 70], [100, 92]],
    lines: [{ y: 36, x1: 8, x2: 86, kind: 'res' }, { y: 64, x1: 8, x2: 86, kind: 'sup' }],
  },
  {
    name: 'カップ・ウィズ・ハンドル',
    kind: 'bottom',
    says: '丸い底を作ったあと、小さく押して再上昇。取っ手の上を抜けたら成立。',
    how: 'U字の底 → 右肩で浅い押し（取っ手） → 高値を上抜け',
    measured: null,
    path: [[0, 25], [10, 32], [22, 55], [36, 66], [50, 68], [64, 58], [74, 34], [82, 46], [90, 40], [100, 12]],
    lines: [{ y: 30, x1: 4, x2: 92, kind: 'res' }],
  },
]

const KIND_LABEL: Record<Pattern['kind'], string> = {
  top: '天井（下落へ）',
  bottom: '底（上昇へ）',
  'cont-up': '上昇の途中',
  'cont-down': '下落の途中',
}

// ── 巻三・波（エリオット波動／一目均衡表の波動論）─────────────────────────────
//
// 🔴 巻二（形）と決定的に違うのは、**同じやり方で測れない**こと。
//    形はネックライン割れなど機械的に定義できるが、波は数え方が一意に決まらない。
//    同じチャートを見ても人によって「今は第3波」「いや第1波」と割れる。
//    だから ぽいロボは**判断には使わない**。相場を語るための語彙として置いている。
//    この立場はページ冒頭に常時出す（畳まない）。畳むと「使える道具」に見えてしまう。

type WaveColors = {
  bg: string; card: string; border: string; text: string; sub: string
  accent: string; up: string; down: string; line: string; stop: string
}

/** 波の図。points は 0-100 座標（y は上が0）。label があれば点の脇に付く。 */
function WaveFigure({
  pts, labels, levels, c, dark, height, delay = 0, colorFrom = 0, show = true,
}: {
  pts: number[][]
  labels?: (string | null)[]
  levels?: { y: number; x1: number; x2: number; label?: string; warn?: boolean }[]
  c: WaveColors
  dark: boolean
  height: number
  delay?: number
  /** この番号以降の点を修正波の色にする（推進＝上げ色、修正＝下げ色） */
  colorFrom?: number
  /** false のあいだは描かない（画面に入ってから描く） */
  show?: boolean
}) {
  const d = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const corr = colorFrom > 0 ? pts.slice(colorFrom).map(([x, y]) => `${x},${y}`).join(' ') : null
  const imp = colorFrom > 0 ? pts.slice(0, colorFrom + 1).map(([x, y]) => `${x},${y}`).join(' ') : d

  return (
    <svg viewBox="-4 -6 108 112" width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
      {levels?.map((lv, i) => (
        <g key={`lv${i}`} style={{ opacity: 0, animation: show ? `cpFade .5s ease ${delay + 0.9}s forwards` : 'none' }}>
          <line x1={lv.x1} y1={lv.y} x2={lv.x2} y2={lv.y}
            stroke={lv.warn ? c.stop : c.accent} strokeWidth={1.2} strokeDasharray="3 2" />
          {lv.label && (
            <text x={lv.x2} y={lv.y - 2.5} textAnchor="end" fontSize={5.5}
              fill={lv.warn ? c.stop : c.accent} fontFamily="inherit">{lv.label}</text>
          )}
        </g>
      ))}

      {/* 推進波 */}
      <polyline points={imp} fill="none" stroke={c.line} strokeWidth={2.1}
        strokeLinejoin="round" strokeLinecap="round" pathLength={100}
        style={{
          strokeDasharray: 100, strokeDashoffset: 100,
          animation: show ? `cpDraw 1.2s ease-out ${delay}s forwards` : 'none',
          filter: dark ? 'drop-shadow(0 0 3px rgba(226,240,252,0.35))' : undefined,
        }} />
      {/* 修正波（色を変えて、推進と修正の別を見せる） */}
      {corr && (
        <polyline points={corr} fill="none" stroke={c.down} strokeWidth={2.1}
          strokeLinejoin="round" strokeLinecap="round" pathLength={100}
          style={{
            strokeDasharray: 100, strokeDashoffset: 100,
            animation: show ? `cpDraw .8s ease-out ${delay + 1.1}s forwards` : 'none',
            filter: dark ? `drop-shadow(0 0 4px ${c.down}88)` : undefined,
          }} />
      )}

      {labels?.map((t, i) => {
        if (!t) return null
        const [x, y] = pts[i]
        // 谷（前後より下）ならラベルを下に、山なら上に置く
        const prev = pts[i - 1]?.[1] ?? y
        const low = y > prev
        return (
          <text key={`t${i}`} x={x} y={low ? y + 8 : y - 4.5} textAnchor="middle" fontSize={7} fontWeight={700}
            fill={/[ABC]/.test(t) ? c.down : c.accent} fontFamily="inherit"
            style={{ opacity: 0, animation: show ? `cpFade .4s ease ${delay + 0.5 + i * 0.09}s forwards` : 'none' }}>{t}</text>
        )
      })}
    </svg>
  )
}

type Level = { y: number; x1: number; x2: number; label?: string; warn?: boolean }
type Fig = { pts: number[][]; labels?: (string | null)[]; levels?: Level[] }

/** 3つの絶対ルール。これを満たさない数え方は「間違い」と言える数少ない部分。 */
const RULES: (Fig & { no: string; title: string; body: string })[] = [
  {
    no: '其の一',
    title: '第2波は、第1波の始点を割らない',
    body: '割ったら、その数え方は間違い。第1波はまだ始まっていなかったことになる。',
    pts: [[0, 88], [26, 34], [56, 70], [78, 44], [100, 30]],
    labels: [null, '1', '2', null, null],
    levels: [{ y: 88, x1: 0, x2: 100, label: '始点', warn: true }],
  },
  {
    no: '其の二',
    title: '第3波は、1・3・5の中で最も短くならない',
    body: 'いちばん伸びる波であることが多い。最短なら数え直す。',
    pts: [[0, 90], [16, 60], [30, 74], [62, 22], [74, 40], [100, 14]],
    labels: [null, '1', '2', '3', '4', '5'],
  },
  {
    no: '其の三',
    title: '第4波は、第1波の高値の領域に重ならない',
    body: '重なったら数え直す（株式では例外もあるとされる）。',
    pts: [[0, 90], [18, 56], [32, 72], [62, 26], [78, 48], [100, 16]],
    labels: [null, '1', '2', '3', '4', '5'],
    levels: [{ y: 56, x1: 0, x2: 100, label: '1波の高値', warn: false }],
  },
]

/** 修正波の型。3つとも「下げ」ではなく「持ち合い」も含むのが要点。 */
const CORRECTIONS: (Fig & { name: string; body: string })[] = [
  {
    name: 'ジグザグ（5-3-5）',
    body: '深く速い調整。A で大きく落ち、B は浅く戻し、C が A より下まで伸びる。',
    pts: [[0, 12], [30, 62], [52, 38], [100, 84]],
    labels: [null, 'A', 'B', 'C'],
  },
  {
    name: 'フラット（3-3-5）',
    body: '横ばいの調整。B が A の始点近くまで戻り、C が A の底あたりで止まる。',
    pts: [[0, 16], [30, 62], [58, 22], [100, 66]],
    labels: [null, 'A', 'B', 'C'],
  },
  {
    name: 'トライアングル（3-3-3-3-3）',
    body: '値幅が狭まっていく持ち合い。多くは第4波に現れ、抜けた先が最後の波。',
    pts: [[0, 12], [20, 74], [38, 28], [56, 64], [72, 40], [86, 56], [100, 20]],
    labels: [null, 'A', 'B', 'C', 'D', 'E', null],
  },
]

/** 巻三で使う囲み・見出し・本文。🔴 レンダーのたびに作り直さないよう module scope に置く。 */
function WCard({ c, dark, isMobile, accent, children }: {
  c: WaveColors; dark: boolean; isMobile: boolean; accent?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{
      background: c.card, border: `1px solid ${accent ? c.accent : c.border}`,
      borderRadius: 12, padding: isMobile ? 14 : 18,
      boxShadow: accent && dark ? `0 0 24px ${c.accent}18` : undefined,
    }}>{children}</div>
  )
}
const WH = ({ c, children }: { c: WaveColors; children: React.ReactNode }) => (
  <div style={{ fontSize: 10, letterSpacing: '0.18em', color: c.accent, marginBottom: 8 }}>{children}</div>
)
function ElliottScroll({ c, dark, isMobile }: {
  c: PanelColors
  dark: boolean
  isMobile: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18, animation: 'cpRise .4s ease both' }}>

      {/* 全体像 */}
      <WaveCard c={c} dark={dark} isMobile={isMobile} accent
        sub="▶ 全体像"
        title="推進5波 ＋ 修正3波"
        fig={{
          pts: [[0, 92], [12, 62], [22, 76], [48, 24], [58, 42], [72, 14], [84, 40], [91, 27], [100, 52]],
          labels: [null, '1', '2', '3', '4', '5', 'A', 'B', 'C'],
          colorFrom: 5,
          height: isMobile ? 190 : 250,
        }}
        body={<>
          相場は<b style={{ color: c.text }}>上げ5つ・下げ3つ</b>のかたまりで進む、という見方。
          1・3・5が進む波（推進）、2・4が押し（修正）、そのあとの A・B・C がまとめての調整。
          そして<b style={{ color: c.text }}>この8つが、より大きな1つの波の一部でもある</b>（入れ子）。
        </>}
      />

      {/* 3つの絶対ルール */}
      <div>
        <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: c.text, margin: '4px 0 10px' }}>
          三つの掟<span style={{ fontSize: 11, fontWeight: 400, color: c.sub, marginLeft: 8 }}>これを破る数え方は間違い</span>
        </div>
        <div style={{
          display: 'grid', gap: isMobile ? 12 : 16,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
        }}>
          {RULES.map(r => (
            <WaveCard key={r.no} c={c} dark={dark} isMobile={isMobile}
              sub={r.no} title={r.title} body={r.body}
              fig={{ pts: r.pts, labels: r.labels, levels: r.levels, height: isMobile ? 120 : 140 }} />
          ))}
        </div>
      </div>

      {/* 修正波の型 */}
      <div>
        <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: c.text, margin: '8px 0 10px' }}>
          修正の型<span style={{ fontSize: 11, fontWeight: 400, color: c.sub, marginLeft: 8 }}>A・B・C の並び方</span>
        </div>
        <div style={{
          display: 'grid', gap: isMobile ? 12 : 16,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
        }}>
          {CORRECTIONS.map(w => (
            <WaveCard key={w.name} c={c} dark={dark} isMobile={isMobile}
              title={w.name} body={w.body}
              fig={{ pts: w.pts, labels: w.labels, colorFrom: 1, height: isMobile ? 120 : 140 }} />
          ))}
        </div>
      </div>

      {/* 目安（ルールではない） */}
      <WCard c={c} dark={dark} isMobile={isMobile}>
        <WH c={c}>▶ 目安 ／ ルールではなく「よくある」話</WH>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['オルタネーション', '第2波が鋭い（深く速い）なら、第4波は横ばいになりやすい。逆もまた。同じ顔の押しは続かない。'],
            ['フィボナッチ', '第2波は第1波の 38.2〜61.8% 押し、第3波は第1波の 1.618 倍——といった比率がよく持ち出される。'],
            ['第3波', 'いちばん出来高が増え、いちばん伸びやすいとされる波。ニュースが後から追いつく。'],
            ['チャネル', '1と3の高値、2と4の安値を結ぶと平行に近い帯になり、第5波の終点の目安に使われる。'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, color: c.accent, flexShrink: 0, marginTop: 4, minWidth: isMobile ? 74 : 96 }}>{k}</span>
              <span style={{ fontSize: isMobile ? 12 : 13, color: c.sub, lineHeight: 1.85 }}>{v}</span>
            </div>
          ))}
        </div>
      </WCard>

      <IchimokuSection c={c} dark={dark} isMobile={isMobile} />
    </div>
  )
}

// ── 巻一・灯（ローソク足の型）─────────────────────────────────────────────
//
// 🔵 巻二「形」が数十本で作る図形、巻三「波」が数え方の話なのに対して、
//    ここは**1〜3本で読む**いちばん短い足あと。いちばん短いので巻一に置く。
// 🔵 酒田五法のうち 三川（明星）・三空・三兵・三法 はここに入る。
//    残る「三山」は三尊そのものなので巻二に置いてある（同じものを別の粒度で見ている）。
// 🔴 巻二と同じで、**載っているのは「そう言われている」という話**。
//    ローソクの型は成立日が機械的に決まるので、後から26年で測れる（`scripts/analyze-candles.mjs` 予定）。

/** 1本のローソク。0-100 の価格座標（大きいほど高い）。 */
type Bar = { o: number; h: number; l: number; c: number }

type Candle = {
  name: string
  /** 何本で見る型か */
  n: string
  kind: 'top' | 'bottom' | 'cont-up' | 'cont-down' | 'neutral'
  says: string
  how: string
  bars: Bar[]
}

const CANDLE_KIND: Record<Candle['kind'], string> = {
  top: '天井（下落へ）',
  bottom: '底（上昇へ）',
  'cont-up': '上昇の途中',
  'cont-down': '下落の途中',
  neutral: '迷い（どちらへも）',
}

const CANDLES: Candle[] = [
  // ── 1本で読む ──
  {
    name: '大陽線', n: '1本', kind: 'cont-up',
    says: '始値から終値までまっすぐ上げた1本。買いが一日中優勢だった跡。',
    how: '実体が直近の足よりはっきり長い／ヒゲが短い。安値圏で出れば転換、上げの途中なら継続。',
    bars: [{ o: 20, h: 92, l: 16, c: 88 }],
  },
  {
    name: '大陰線', n: '1本', kind: 'cont-down',
    says: '始値から終値までまっすぐ下げた1本。売りが一日中優勢だった跡。',
    how: '実体が長くヒゲが短い／高値圏で出れば天井のサインとされる。',
    bars: [{ o: 88, h: 92, l: 14, c: 20 }],
  },
  {
    name: '十字線（同時線）', n: '1本', kind: 'neutral',
    says: '始値と終値がほぼ同じ。買いと売りが押し合って決着がつかなかった。',
    how: '実体がほとんど無い／トレンドの端で出ると転換の目印にされる。持ち合いの中では意味が薄い。',
    bars: [{ o: 52, h: 84, l: 20, c: 50 }],
  },
  {
    name: 'カラカサ（ハンマー）', n: '1本', kind: 'bottom',
    says: '長い下ヒゲ。一度大きく売られたが、そこから買い戻された跡。',
    how: '下ヒゲが実体の2倍以上／上ヒゲはほぼ無い。🔴 高値圏で同じ形が出たら「首吊り線」と呼ばれ意味が逆になる。',
    bars: [{ o: 66, h: 74, l: 14, c: 70 }],
  },
  {
    name: 'トンカチ（流れ星）', n: '1本', kind: 'top',
    says: '長い上ヒゲ。一度買われたが、そこから売り戻された跡。',
    how: '上ヒゲが実体の2倍以上／下ヒゲはほぼ無い。安値圏で出た場合は「たぐり線」で意味が逆。',
    bars: [{ o: 30, h: 88, l: 24, c: 34 }],
  },
  {
    name: 'コマ', n: '1本', kind: 'neutral',
    says: '小さい実体に上下のヒゲ。方向が定まらない一日。',
    how: '実体もヒゲも小さい／単独では判断材料にならず、次の1本とセットで見る。',
    bars: [{ o: 46, h: 74, l: 28, c: 54 }],
  },

  // ── 2本で読む ──
  {
    name: '包み線（抱き線）', n: '2本', kind: 'bottom',
    says: '2本目が1本目をすっぽり包む。前日の動きを全部飲み込むほど力が入れ替わった。',
    how: '2本目の実体が1本目の実体を上下とも包む／安値圏で陽が陰を包めば買い、高値圏で陰が陽を包めば売り。',
    bars: [{ o: 62, h: 66, l: 44, c: 46 }, { o: 40, h: 76, l: 36, c: 72 }],
  },
  {
    name: 'はらみ線', n: '2本', kind: 'neutral',
    says: '2本目が1本目の内側に収まる。大きく動いた翌日に動きが止まった＝勢いが切れた合図。',
    how: '2本目の実体が1本目の実体の中に完全に入る／包み線と逆の並び。',
    bars: [{ o: 82, h: 86, l: 30, c: 34 }, { o: 44, h: 56, l: 40, c: 52 }],
  },
  {
    name: 'かぶせ線', n: '2本', kind: 'top',
    says: '陽線の翌日、上に窓を開けて始まったのに、前日の実体の半分より下で引けた。',
    how: '2本目は1本目の高値より上で寄り、1本目の実体の中心より下で引ける／高値圏で意味を持つ。',
    bars: [{ o: 30, h: 74, l: 26, c: 70 }, { o: 80, h: 84, l: 40, c: 46 }],
  },
  {
    name: '切り込み線', n: '2本', kind: 'bottom',
    says: 'かぶせ線の逆。下に窓を開けて始まったのに、前日の実体の半分より上まで戻した。',
    how: '2本目は1本目の安値より下で寄り、1本目の実体の中心より上で引ける／安値圏で意味を持つ。',
    bars: [{ o: 74, h: 78, l: 26, c: 30 }, { o: 20, h: 62, l: 18, c: 58 }],
  },
  {
    name: '毛抜き天井', n: '2本', kind: 'top',
    says: '2本の高値がぴたりとそろう。同じ値段で2度はね返された。',
    how: '高値が同値（ヒゲの先がそろう）／上昇のあとに出たものを指す。',
    bars: [{ o: 40, h: 84, l: 36, c: 78 }, { o: 76, h: 84, l: 44, c: 48 }],
  },
  {
    name: '毛抜き底', n: '2本', kind: 'bottom',
    says: '2本の安値がぴたりとそろう。同じ値段で2度支えられた。',
    how: '安値が同値／下落のあとに出たものを指す。',
    bars: [{ o: 60, h: 64, l: 18, c: 22 }, { o: 24, h: 56, l: 18, c: 52 }],
  },

  // ── 3本以上で読む ──
  {
    name: '明けの明星（三川）', n: '3本', kind: 'bottom',
    says: '大陰線 → 小さな星 → 大陽線。下げが止まり、間の一日を挟んで買いが戻った。',
    how: '真ん中の足は上下から離れて小さい／3本目が1本目の実体の半分より上まで戻す。酒田五法「三川」。',
    bars: [{ o: 82, h: 86, l: 36, c: 40 }, { o: 26, h: 32, l: 20, c: 24 }, { o: 38, h: 80, l: 34, c: 76 }],
  },
  {
    name: '宵の明星', n: '3本', kind: 'top',
    says: '大陽線 → 小さな星 → 大陰線。明けの明星の裏返しで、上げが止まった形。',
    how: '真ん中の足が上に離れて小さい／3本目が1本目の実体の半分より下まで沈む。',
    bars: [{ o: 24, h: 70, l: 20, c: 66 }, { o: 78, h: 86, l: 74, c: 82 }, { o: 64, h: 68, l: 24, c: 28 }],
  },
  {
    name: '赤三兵', n: '3本', kind: 'cont-up',
    says: '陽線が3本、少しずつ切り上がる。買いが続いている状態。酒田五法「三兵」。',
    how: '3本とも陽線／終値が前日より高い。🔴 3本目に長い上ヒゲが出たら「赤三兵先詰まり」で逆に警戒。',
    bars: [{ o: 20, h: 44, l: 16, c: 40 }, { o: 36, h: 62, l: 32, c: 58 }, { o: 54, h: 82, l: 50, c: 78 }],
  },
  {
    name: '三羽烏（黒三兵）', n: '3本', kind: 'cont-down',
    says: '陰線が3本、少しずつ切り下がる。売りが続いている状態。',
    how: '3本とも陰線／終値が前日より安い／高値圏から始まると下げが長引くとされる。',
    bars: [{ o: 82, h: 86, l: 58, c: 60 }, { o: 64, h: 68, l: 40, c: 42 }, { o: 46, h: 50, l: 20, c: 22 }],
  },
  {
    name: '三空踏み上げ', n: '4本', kind: 'top',
    says: '窓を3つ開けて一気に上げた形。買いが行き過ぎているので、酒田では**売り場**とされる。',
    how: '連続する足のあいだに空（窓）が3つ／下げで同じ形になったものが「三空叩き込み」で買い場。',
    bars: [{ o: 16, h: 30, l: 12, c: 28 }, { o: 36, h: 50, l: 34, c: 48 }, { o: 56, h: 70, l: 54, c: 68 }, { o: 76, h: 92, l: 74, c: 90 }],
  },
  {
    name: '上げ三法', n: '5本', kind: 'cont-up',
    says: '大陽線のあと小さな足で3日休み、また大陽線で上抜ける。「休むも相場」の形。酒田五法「三法」。',
    how: '間の小さい足が1本目の値幅の中に収まる／最後の足が1本目の高値を上抜けて成立。下向きが「下げ三法」。',
    bars: [
      { o: 14, h: 60, l: 10, c: 56 },
      { o: 52, h: 56, l: 44, c: 46 }, { o: 48, h: 52, l: 40, c: 42 }, { o: 46, h: 50, l: 38, c: 40 },
      { o: 44, h: 94, l: 40, c: 90 },
    ],
  },
]

/** ローソク足の図。0-100 の価格座標を上下反転して描く。 */
function CandleFigure({ bars, c, dark, height, delay = 0, show = true }: {
  bars: Bar[]
  c: { up: string; down: string; line: string }
  dark: boolean
  height: number
  delay?: number
  /** false のあいだは灯さない（画面に入ってから1本ずつ） */
  show?: boolean
}) {
  const n = bars.length
  const slot = 100 / n
  const bw = Math.min(slot * 0.46, 13)

  return (
    <svg viewBox="0 0 100 100" width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
      {bars.map((b, i) => {
        const cx = slot * (i + 0.5)
        const up = b.c > b.o
        const doji = Math.abs(b.c - b.o) < 2.5
        const col = doji ? c.line : up ? c.up : c.down
        const top = 100 - Math.max(b.o, b.c)
        const h = Math.max(Math.abs(b.c - b.o), 1.6)
        return (
          <g key={i} style={{
            opacity: 0, animation: show ? `cpFade .42s ease ${delay + i * 0.13}s forwards` : 'none',
            filter: dark ? `drop-shadow(0 0 4px ${col}66)` : undefined,
          }}>
            {/* ヒゲ */}
            <line x1={cx} y1={100 - b.h} x2={cx} y2={100 - b.l} stroke={col} strokeWidth={1.5} strokeLinecap="round" />
            {/* 実体（陽は塗り、陰は塗り＋濃い枠で日本式の見た目に寄せる）*/}
            <rect x={cx - bw / 2} y={top} width={bw} height={h} rx={1}
              fill={up ? col : col} fillOpacity={up ? 0.9 : 0.55}
              stroke={col} strokeWidth={1.2} />
          </g>
        )
      })}
    </svg>
  )
}

type PanelColors = {
  bg: string; card: string; border: string; text: string; sub: string
  accent: string; up: string; down: string; line: string; stop: string
}

/**
 * 画面に入ったかどうか。
 *
 * 🔵 図が一斉に動くと、目がどこを見ればいいのか分からなくなる（2026-08-13 ユーザー指摘）。
 *    スクロールして**そのカードが見えたときに、その図だけ動き出す**ようにする。
 * 🔴 一度動いたら戻さない（`disconnect`）。行き来のたびに描き直すとうるさい。
 * 🔴 IntersectionObserver が無い環境では素直に最初から見せる（動かないより出るほうが良い）。
 */
function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (seen) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect() }
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen]
}

/** 巻二のカード（フォーメーション）。図は見えてから描かれる。 */
function PatternCard({ p, idx, c, dark, isMobile, isOpen, onToggle }: {
  p: Pattern; idx: number; c: PanelColors; dark: boolean; isMobile: boolean
  isOpen: boolean; onToggle: () => void
}) {
  const [ref, show] = useInView<HTMLButtonElement>()
  const col = (p.kind === 'bottom' || p.kind === 'cont-up') ? c.up : c.down
  // 🔵 遅延は「画面に入った順」で少しずつ。列ごとの見え方が自然になる程度に留める。
  const d = (idx % 3) * 0.08

  return (
    <button
      ref={ref}
      onClick={onToggle}
      className="cp-card"
      style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch',
        textAlign: 'left', background: c.card, border: `1px solid ${isOpen ? col : c.border}`,
        borderRadius: 12, padding: 14, cursor: 'pointer', color: c.text,
        transition: 'border-color .15s, transform .15s, box-shadow .15s',
        opacity: show ? undefined : 0,
        animation: show ? `cpRise .5s ease ${d}s both` : 'none',
        boxShadow: isOpen && dark ? `0 0 24px ${col}22` : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700 }}>{p.name}</span>
        <span style={{ fontSize: 10, color: col, letterSpacing: '0.06em' }}>{KIND_LABEL[p.kind]}</span>
      </div>

      {/* 🔵 図は画像ではなくSVG。読み込みを増やさず、テーマにも追随できる。
          🔴 線を**描かれていく**演出にする。形は動きで覚えるものなので、
             静止画で並べるより「どう作られたか」が伝わる。 */}
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 100 100" width="100%" height={isMobile ? 140 : 170} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={`cpg-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={col} stopOpacity={dark ? 0.16 : 0.10} />
              <stop offset="100%" stopColor={col} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* 面で塗って厚みを出す */}
          <polygon
            points={`0,100 ${p.path.map(([x, y]) => `${x},${y}`).join(' ')} 100,100`}
            fill={`url(#cpg-${idx})`}
            style={{ opacity: show ? undefined : 0 }} />
          {p.lines?.map((l, i) => (
            <line key={`l${i}`} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y}
              stroke={l.kind === 'sup' ? c.up : l.kind === 'res' ? c.down : col}
              strokeWidth={1.6} strokeDasharray={l.kind === 'neck' ? '0' : '3 2'}
              style={{
                filter: dark ? `drop-shadow(0 0 4px ${col}88)` : undefined,
                opacity: 0, animation: show ? `cpFade .5s ease ${d + 0.35}s forwards` : 'none',
              }} />
          ))}
          {p.slopes?.map((sl, i) => (
            <line key={`s${i}`} x1={sl.p[0]} y1={sl.p[1]} x2={sl.p[2]} y2={sl.p[3]}
              stroke={sl.kind === 'up' ? c.up : c.down} strokeWidth={1.6}
              style={{
                filter: dark ? `drop-shadow(0 0 4px ${col}88)` : undefined,
                opacity: 0, animation: show ? `cpFade .5s ease ${d + 0.35}s forwards` : 'none',
              }} />
          ))}
          <polyline
            points={p.path.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none" stroke={c.line} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round"
            pathLength={100}
            style={{
              strokeDasharray: 100, strokeDashoffset: 100,
              animation: show ? `cpDraw 1.1s ease-out ${d}s forwards` : 'none',
              filter: dark ? 'drop-shadow(0 0 3px rgba(226,240,252,0.35))' : undefined,
            }} />
          {/* 抜けた先を示す矢印 */}
          <polyline
            points={(p.kind === 'bottom' || p.kind === 'cont-up') ? '92,26 100,8 100,20' : '92,74 100,92 100,80'}
            fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            style={{
              opacity: 0, animation: show ? `cpFade .5s ease ${d + 1.0}s forwards` : 'none',
              filter: dark ? `drop-shadow(0 0 6px ${col})` : undefined,
            }} />
        </svg>
      </div>

      <div style={{ fontSize: 11, color: c.sub, lineHeight: 1.7, marginTop: 8 }}>{p.says}</div>

      {isOpen && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 10, color: c.accent, letterSpacing: '0.1em', marginBottom: 4 }}>見つけ方</div>
          <div style={{ fontSize: 11, color: c.sub, lineHeight: 1.7 }}>{p.how}</div>
          {/* 🔵 2026-08-13 ユーザー判断で「日経225・26年で測った結果」は非表示にした。
              統計的に未確定（t<2・n が小さい）のものが多く、読む人には
              「効く/効かない」の判断材料にならないため。
              🔴 データ（p.measured）は消していないので、表示を戻すのはこのブロックを戻すだけ。 */}
        </div>
      )}
      {!isOpen && (
        <div style={{ fontSize: 10, color: c.accent, marginTop: 8 }}>タップで見つけ方 →</div>
      )}
    </button>
  )
}

/** 巻一のカード（ローソク足）。1本ずつ順に灯る。 */
function CandleCard({ p, idx, c, dark, isMobile, isOpen, onToggle }: {
  p: Candle; idx: number; c: PanelColors; dark: boolean; isMobile: boolean
  isOpen: boolean; onToggle: () => void
}) {
  const [ref, show] = useInView<HTMLButtonElement>()
  const col = p.kind === 'neutral' ? c.line : (p.kind === 'bottom' || p.kind === 'cont-up') ? c.up : c.down
  const d = (idx % 3) * 0.08

  return (
    <button
      ref={ref}
      onClick={onToggle}
      className="cp-card"
      style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch',
        textAlign: 'left', background: c.card, border: `1px solid ${isOpen ? col : c.border}`,
        borderRadius: 12, padding: 14, cursor: 'pointer', color: c.text,
        transition: 'border-color .15s, transform .15s, box-shadow .15s',
        opacity: show ? undefined : 0,
        animation: show ? `cpRise .5s ease ${d}s both` : 'none',
        boxShadow: isOpen && dark ? `0 0 24px ${col}22` : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700 }}>{p.name}</span>
        <span style={{
          fontSize: 9, color: c.sub, border: `1px solid ${c.border}`,
          borderRadius: 20, padding: '1px 6px', letterSpacing: '0.06em',
        }}>{p.n}</span>
        <span style={{ fontSize: 10, color: col, letterSpacing: '0.06em' }}>{CANDLE_KIND[p.kind]}</span>
      </div>

      <CandleFigure bars={p.bars} c={c} dark={dark} height={isMobile ? 140 : 170} delay={d} show={show} />

      <div style={{ fontSize: 11, color: c.sub, lineHeight: 1.7, marginTop: 8 }}>{p.says}</div>

      {isOpen && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 10, color: c.accent, letterSpacing: '0.1em', marginBottom: 4 }}>見つけ方</div>
          <div style={{ fontSize: 11, color: c.sub, lineHeight: 1.7 }}>{p.how}</div>
        </div>
      )}
      {!isOpen && (
        <div style={{ fontSize: 10, color: c.accent, marginTop: 8 }}>タップで見つけ方 →</div>
      )}
    </button>
  )
}

/** 巻三のカード（波の図つき）。見えたときに波が描かれる。 */
function WaveCard({ c, dark, isMobile, title, sub, body, fig, accent }: {
  c: PanelColors; dark: boolean; isMobile: boolean
  title?: string; sub?: string; body: React.ReactNode
  fig: Fig & { colorFrom?: number; height: number }
  accent?: boolean
}) {
  const [ref, show] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className="cp-card" style={{
      background: c.card, border: `1px solid ${accent ? c.accent : c.border}`, borderRadius: 12,
      padding: isMobile ? 14 : 18,
      opacity: show ? undefined : 0,
      animation: show ? 'cpRise .5s ease both' : 'none',
      boxShadow: accent && dark ? `0 0 24px ${c.accent}18` : undefined,
    }}>
      {(title || sub) && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {sub && <span style={{ fontSize: 10, letterSpacing: '0.14em', color: c.accent }}>{sub}</span>}
          {title && <span style={{ fontSize: isMobile ? 12.5 : 13.5, fontWeight: 700, color: c.text }}>{title}</span>}
        </div>
      )}
      <WaveFigure pts={fig.pts} labels={fig.labels} levels={fig.levels} colorFrom={fig.colorFrom}
        c={c} dark={dark} height={fig.height} show={show} />
      <div style={{ fontSize: isMobile ? 12 : 12.5, color: c.sub, lineHeight: 1.8, marginTop: 8 }}>{body}</div>
    </div>
  )
}

// ── 巻三のうしろ半分：一目均衡表の波動論 ────────────────────────────────
//
// 🔵 エリオットと同じ「波の数え方」の話なので、巻を分けずにここへ置く（2026-08-13 ユーザー判断）。
// 🔵 **ここは読み物**。当たる/当たらないの検証結果は載せない（2026-08-13 ユーザー判断）。
//    検証は地下室（デイトレード／スイングトレード）でやる、という住み分け。
// 🔴 一目は測れる部分がある（型・時間論・水準論はすべて数式）ので、実際に26年で測ってある。
//    結果は `scripts/analyze-ichimoku.mjs` を走らせれば出る（当たらなかった）。画面には出さない。

/** 波動論の5つの型。I→V→N と増えていき、P・Y は持ち合いの形。 */
const ICHI_WAVES: (Fig & { name: string; body: string })[] = [
  {
    name: 'I波',
    body: '上げ（または下げ）だけの一本調子。いちばん小さい単位で、これが積み重なって他の波になる。',
    pts: [[0, 90], [100, 16]],
  },
  {
    name: 'V波',
    body: '上げて下げる（または下げて上げる）。行って来いの形。',
    pts: [[0, 86], [50, 16], [100, 72]],
    labels: [null, null, null],
  },
  {
    name: 'N波',
    body: '上げ→押し→上げ。**一目ではこれが基本形**で、他の波もN波の組み合わせとして数える。',
    pts: [[0, 90], [32, 40], [60, 62], [100, 14]],
    labels: ['A', 'B', 'C', 'D'],
  },
  {
    name: 'P波',
    body: '高値が切り下がり安値が切り上がる、先すぼまりの持ち合い（三角保ち合いと同じ形）。',
    pts: [[0, 14], [16, 84], [34, 28], [50, 72], [66, 40], [82, 62], [100, 50]],
  },
  {
    name: 'Y波',
    body: '高値も安値も広がっていく、先広がりの持ち合い。荒れている場面で出る。',
    pts: [[0, 50], [16, 40], [32, 62], [48, 26], [66, 76], [82, 14], [100, 88]],
  },
]

function IchimokuSection({ c, dark, isMobile }: { c: PanelColors; dark: boolean; isMobile: boolean }) {
  return (
    <>
      {/* 🔵 エリオットと同じ流れにそろえる（2026-08-13 ユーザー指示）＝
          まず**全体像を1枚**見せて、そのあとに部品を分けて説明する。 */}
      <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: c.text, margin: `${isMobile ? 12 : 20}px 0 6px` }}>
        一目均衡表の波動論
        <span style={{ fontSize: 11, fontWeight: 400, color: c.sub, marginLeft: 8 }}>日本発の「波」の数え方</span>
      </div>

      <WaveCard c={c} dark={dark} isMobile={isMobile} accent
        sub="▶ 全体像"
        title="N波を基本に数え、値幅と日柄を出す"
        fig={{
          pts: [[0, 88], [26, 30], [52, 56], [88, 14], [100, 22]],
          labels: ['A', 'B', 'C', 'D', null],
          levels: [
            { y: 14, x1: 52, x2: 100, label: '目標（水準論）' },
            { y: 56, x1: 26, x2: 100, label: '押し C' },
          ],
          height: isMobile ? 200 : 260,
        }}
        body={<>
          エリオットが5波と3波で数えるのに対して、一目は <b style={{ color: c.text }}>I・V・N・P・Y</b> の5つの形で数え、
          そのうち<b style={{ color: c.text }}>N波（上げ→押し→上げ）を基本</b>に置く。
          そのうえで<b style={{ color: c.text }}>どこまで行くか（水準論）</b>と
          <b style={{ color: c.text }}>いつ変わるか（時間論）</b>を出すところまでが一目の作法で、
          形だけを見るエリオットとはここが違う。
        </>}
      />

      <div>
        <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: c.text, margin: '4px 0 10px' }}>
          波の型<span style={{ fontSize: 11, fontWeight: 400, color: c.sub, marginLeft: 8 }}>I・V・N・P・Y の5つ</span>
        </div>
        <div style={{
          display: 'grid', gap: isMobile ? 12 : 16,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
        }}>
          {ICHI_WAVES.map(w => (
            <WaveCard key={w.name} c={c} dark={dark} isMobile={isMobile}
              title={w.name} body={w.body}
              fig={{ pts: w.pts, labels: w.labels, height: isMobile ? 120 : 140 }} />
          ))}
        </div>
      </div>

      {/* 水準論 */}
      <WaveCard c={c} dark={dark} isMobile={isMobile}
        sub="▶ 水準論"
        title="次にどこまで行くかを、4つの式で置く"
        fig={{
          pts: [[0, 84], [30, 26], [56, 54], [100, 12]],
          labels: ['A', 'B', 'C', 'D'],
          levels: [{ y: 12, x1: 56, x2: 100, label: '目標 D' }],
          height: isMobile ? 150 : 190,
        }}
        body={<>
          谷 A → 山 B → 谷 C と来たあと、次の山 D を式で置く。
          <b style={{ color: c.text }}>V＝B+(B−C)</b> ／ <b style={{ color: c.text }}>N＝C+(B−A)</b> ／
          <b style={{ color: c.text }}>E＝B+(B−A)</b> ／ <b style={{ color: c.text }}>NT＝C+(C−A)</b>。
          上から順に強気で、E がいちばん高い目標になる。
        </>}
      />

      {/* 時間論 */}
      <WaveCard c={c} dark={dark} isMobile={isMobile}
        sub="▶ 時間論"
        title="値段ではなく、日数を数える"
        fig={{
          pts: [[0, 86], [22, 34], [44, 62], [70, 18], [100, 44]],
          labels: [null, '9', '17', '26', null],
          height: isMobile ? 130 : 160,
        }}
        body={<>
          基本数値は <b style={{ color: c.text }}>9・17・26</b>（さらに 33・42・65・76…）。
          転換点から数えてこの日数のところで、次の転換が起きやすいとされる。
          一目でいちばん独特なのがこの<b style={{ color: c.text }}>日柄</b>の考え方で、値段の予想（水準論）と組で使う。
        </>}
      />

    </>
  )
}

export function ChartPatternPanel({ theme, isMobile, onClose }: Props) {
  const dark = theme === 'dark'
  const [open, setOpen] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  // 🔵 巻を分ける（2026-08-13）。**形**は機械的に定義でき、実際に26年で測れた。
  //    **波**（エリオット）は数え方が一意に決まらず、そもそも同じやり方で測れない。
  //    性質が違うものを同じ棚に並べると「どちらも同じ根拠」に見えてしまうので、巻で隔てる。
  const [maki, setMaki] = useState<'candle' | 'form' | 'wave'>('candle')

  const c = {
    bg: dark ? '#04070f' : '#f6f8fc',
    card: dark ? 'rgba(8,16,30,0.72)' : 'rgba(255,255,255,0.9)',
    border: dark ? 'rgba(0,229,255,0.18)' : 'rgba(30,60,110,0.14)',
    text: dark ? '#dbe9f5' : '#16233a',
    sub: dark ? 'rgba(190,215,235,0.62)' : 'rgba(30,50,80,0.62)',
    accent: dark ? '#00e5ff' : '#0b72a8',
    up: dark ? '#3ddc84' : '#128a4c',
    down: dark ? '#4aa8ff' : '#1d63c9',
    line: dark ? 'rgba(226,240,252,0.92)' : '#22304a',
    stop: dark ? 'rgba(255,110,110,0.85)' : 'rgba(200,50,50,0.85)',
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      background: c.bg, color: c.text,
      fontFamily: "'Courier New', Courier, monospace",
      backgroundImage: dark
        ? 'repeating-linear-gradient(0deg, rgba(0,229,255,0.03) 0 1px, transparent 1px 3px)'
        : undefined,
    }}>
      {/* 🔴 keyframes はここに1つだけ置く。カード側は animation 名で参照する。 */}
      <style>{`
        @keyframes cpDraw { to { stroke-dashoffset: 0 } }
        @keyframes cpFade { to { opacity: 1 } }
        @keyframes cpBlink { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        @keyframes cpRise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .cp-card { animation: cpRise .5s ease both; }
        .cp-card:hover { transform: translateY(-3px); }
      `}</style>

      {/* 🔴 ヘッダーはタイムマシンと同じ形にそろえる（2026-08-11 ユーザー指示）。
          研究室から開く内部ビューは、どれも同じ見た目で始まるようにする。 */}
      <div style={{
        position: 'relative', zIndex: 6, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: isMobile ? '11px 16px' : '12px 28px',
        background: dark ? 'rgba(4,10,22,0.72)' : 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${c.border}`,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: c.accent,
          boxShadow: dark ? `0 0 7px ${c.accent}` : 'none', flexShrink: 0,
        }} />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: c.sub,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          ぽいロボ ▸ 波動の書
        </span>
        <span style={{ fontSize: 9, color: c.sub, letterSpacing: '0.06em', flexShrink: 0 }}>
          {maki === 'form' ? `${PATTERNS.length} 種` : maki === 'wave' ? '5-3' : `${CANDLES.length} 型`}
        </span>
        {/* 🔴 ヘッダー右端は**閉じる**（タイムマシンと同じ位置・同じ役目）。
            ヘルプは見出しの右に置く（2026-08-11 ユーザー指示）。 */}
        <button onClick={onClose} aria-label="閉じる" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
          borderRadius: 7, cursor: 'pointer', border: `1px solid ${c.border}`,
          background: 'transparent', color: c.sub, flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '20px 14px 120px' : '32px 24px 60px' }}>

        {/* 🔵 見出しは大きく。背景に薄い巨大文字を敷いて奥行きを出す（研究室の世界観に寄せる） */}
        <div style={{ position: 'relative', marginBottom: isMobile ? 18 : 26 }}>
          <div aria-hidden style={{
            position: 'absolute', top: isMobile ? -14 : -26, left: -4, zIndex: 0,
            fontSize: isMobile ? 64 : 120, fontWeight: 900, lineHeight: 1,
            color: 'transparent', WebkitTextStroke: `1px ${dark ? 'rgba(0,229,255,0.10)' : 'rgba(20,60,110,0.08)'}`,
            letterSpacing: '-0.04em', pointerEvents: 'none', userSelect: 'none',
          }}>{maki === 'form' ? 'FORMATION' : maki === 'wave' ? 'ELLIOTT' : 'CANDLE'}</div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 12, letterSpacing: '0.28em', color: c.accent, marginBottom: 8,
              textShadow: dark ? `0 0 12px ${c.accent}55` : undefined,
              animation: 'cpBlink 2.4s ease-in-out infinite',
            }}>▶ {maki === 'form' ? 'FORMATION ANALYSIS' : maki === 'wave' ? 'ELLIOTT WAVE PRINCIPLE' : 'CANDLESTICK PATTERNS'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{
                fontSize: isMobile ? 26 : 40, fontWeight: 800, margin: 0, letterSpacing: '-0.01em',
                textShadow: dark ? `0 0 24px ${c.accent}22` : undefined,
              }}>
                {maki === 'form'
                  ? <>フォーメーション<span style={{ color: c.accent }}>{PATTERNS.length}</span>種</>
                  : maki === 'wave'
                    ? <>エリオット<span style={{ color: c.accent }}>波動</span></>
                    : <>ローソク足<span style={{ color: c.accent }}>{CANDLES.length}</span>型</>}
              </h1>
              {/* 🔵 ? は巻一だけ。巻二には畳む中身が無いので出さない。 */}
              {maki === 'form' && <button
                onClick={() => setHelp(v => !v)}
                aria-label="このページについて"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  border: `1px solid ${c.accent}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                  background: help ? (dark ? 'rgba(0,229,255,0.14)' : 'rgba(11,114,168,0.12)') : 'transparent',
                  color: c.accent,
                }}
              >?</button>}
            </div>
          </div>
        </div>

        {/* 🔵 巻の切り替え。書物なので「タブ」ではなく**巻**と呼ぶ。 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: isMobile ? 16 : 22, flexWrap: 'wrap' }}>
          {([
            { key: 'candle' as const, no: '巻一', name: '灯', sub: 'ローソク足の型' },
            { key: 'form' as const, no: '巻二', name: '形', sub: 'フォーメーション16種' },
            { key: 'wave' as const, no: '巻三', name: '波', sub: 'エリオット波動・一目' },
          ]).map(t => {
            const on = maki === t.key
            return (
              <button key={t.key} onClick={() => { setMaki(t.key); setOpen(null); setHelp(false) }} style={{
                display: 'flex', alignItems: 'baseline', gap: 8,
                padding: isMobile ? '8px 12px' : '9px 16px', borderRadius: 10,
                border: `1px solid ${on ? c.accent : c.border}`,
                background: on ? (dark ? 'rgba(0,229,255,0.10)' : 'rgba(11,114,168,0.08)') : 'transparent',
                color: on ? c.accent : c.sub, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: on && dark ? `0 0 18px ${c.accent}22` : undefined,
                transition: 'border-color .15s, background .15s, color .15s',
              }}>
                <span style={{ fontSize: 10, letterSpacing: '0.18em' }}>{t.no}</span>
                <span style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800 }}>{t.name}</span>
                <span style={{ fontSize: 10, opacity: 0.85 }}>{t.sub}</span>
              </button>
            )
          })}
        </div>

        {/* 🔴 このページの立場と測り方は**ヘルプに畳む**（2026-08-11 ユーザー指示）。
            図鑑として見に来た人の邪魔にならないよう、既定では出さない。
            🔴 ただし**消さない**。教科書の説明だけ並べると「これを見れば当たる」と読めるので、
               ヘッダーの ? からいつでも開ける場所には必ず置いておく。 */}
        {help && maki === 'form' && (
          <div style={{
            border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.stop}`,
            background: c.card, borderRadius: 8, padding: isMobile ? 12 : 16, marginBottom: 22,
            fontSize: isMobile ? 12 : 13, lineHeight: 1.9, animation: 'cpRise .3s ease both',
          }}>
            <div style={{ fontWeight: 700, color: c.text, marginBottom: 6 }}>先に大事なこと</div>
            <div style={{ color: c.sub }}>
              形の意味は<b style={{ color: c.text }}>「そう言われている」</b>という話であって、当たるという意味ではありません。
              2026-08-11 に<b style={{ color: c.text }}>日経225の26年・6,361営業日</b>で6種類を測ったところ、
              <b style={{ color: c.stop }}>108通りの定義のうち基準を超えたのは1つだけ</b>でした。
              三尊にいたっては<b style={{ color: c.stop }}>上がるか下がるかの符号すら定まりません</b>。
              <br />
              測れたものには実測を併記しています。<b style={{ color: c.text }}>形を覚えることより、
              覚えた形が効かないと知っていることのほうが役に立ちます。</b>
            </div>

            <div style={{ fontWeight: 700, color: c.text, margin: '14px 0 6px' }}>測り方</div>
            <div style={{ color: c.sub }}>
              山と谷（ピボット）を機械的に拾い、パターンが成立した日（ネックラインを抜けた日）の終値から
              先5日・20日のリターンを見ています。<b style={{ color: c.text }}>山の探し方（3/5/10本）と
              許容幅（0.5/1/2%）を先に振って、全部の組み合わせを並べました</b>。
              <br />
              🔴 これは<b style={{ color: c.text }}>定義をいじって当たりを作らないため</b>です。
              9通りのうち1つだけ当たったなら、それは効いたのではなく、たまたま当たる定義を選んだだけです。
              <br />
              🔴 山は<b style={{ color: c.text }}>その後 k 本経たないと確定しません</b>。
              「あとから見れば山だった」を使うと成績はいくらでも良くなります。確定した山だけを使っています。
              <br />
              検証コード: <span style={{ color: c.text }}>scripts/analyze-chart-patterns.mjs</span>
            </div>
          </div>
        )}

        {maki === 'wave' && <ElliottScroll c={c} dark={dark} isMobile={isMobile} />}

        {/* 巻一・灯：1〜3本で読む型。巻二と同じカードの作りにそろえる（並べ方が変わると別物に見える）*/}
        {maki === 'candle' && <div style={{
          display: 'grid', gap: isMobile ? 12 : 16,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
        }}>
          {CANDLES.map((p, idx) => (
            <CandleCard key={p.name} p={p} idx={idx} c={c} dark={dark} isMobile={isMobile}
              isOpen={open === p.name} onToggle={() => setOpen(open === p.name ? null : p.name)} />
          ))}
        </div>}

        {maki === 'form' && <div style={{
          display: 'grid', gap: isMobile ? 12 : 16,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
        }}>
          {PATTERNS.map((p, idx) => (
            <PatternCard key={p.name} p={p} idx={idx} c={c} dark={dark} isMobile={isMobile}
              isOpen={open === p.name} onToggle={() => setOpen(open === p.name ? null : p.name)} />
          ))}
        </div>}

      </div>
      </div>
    </div>
  )
}
