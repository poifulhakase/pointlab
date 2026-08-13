import { useState } from 'react'

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

export function ChartPatternPanel({ theme, isMobile, onClose }: Props) {
  const dark = theme === 'dark'
  const [open, setOpen] = useState<string | null>(null)
  const [help, setHelp] = useState(false)

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
  const isUp = (k: Pattern['kind']) => k === 'bottom' || k === 'cont-up'

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
        <span style={{ fontSize: 9, color: c.sub, letterSpacing: '0.06em', flexShrink: 0 }}>{PATTERNS.length} 種</span>
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
          }}>FORMATION</div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 12, letterSpacing: '0.28em', color: c.accent, marginBottom: 8,
              textShadow: dark ? `0 0 12px ${c.accent}55` : undefined,
              animation: 'cpBlink 2.4s ease-in-out infinite',
            }}>▶ FORMATION ANALYSIS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{
                fontSize: isMobile ? 26 : 40, fontWeight: 800, margin: 0, letterSpacing: '-0.01em',
                textShadow: dark ? `0 0 24px ${c.accent}22` : undefined,
              }}>
                フォーメーション<span style={{ color: c.accent }}>{PATTERNS.length}</span>種
              </h1>
              <button
                onClick={() => setHelp(v => !v)}
                aria-label="このページについて"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  border: `1px solid ${c.accent}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                  background: help ? (dark ? 'rgba(0,229,255,0.14)' : 'rgba(11,114,168,0.12)') : 'transparent',
                  color: c.accent,
                }}
              >?</button>
            </div>
          </div>
        </div>

        {/* 🔴 このページの立場と測り方は**ヘルプに畳む**（2026-08-11 ユーザー指示）。
            図鑑として見に来た人の邪魔にならないよう、既定では出さない。
            🔴 ただし**消さない**。教科書の説明だけ並べると「これを見れば当たる」と読めるので、
               ヘッダーの ? からいつでも開ける場所には必ず置いておく。 */}
        {help && (
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

        <div style={{
          display: 'grid', gap: isMobile ? 12 : 16,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
        }}>
          {PATTERNS.map((p, idx) => {
            const col = isUp(p.kind) ? c.up : c.down
            const isOpen = open === p.name
            return (
              <button
                key={p.name}
                onClick={() => setOpen(isOpen ? null : p.name)}
                className="cp-card"
                style={{
                  // 🔴 グリッドは行の中で高さが揃うので、1枚を開くと隣のカードも背が伸びる。
                  //    button は中身を**縦中央**に置くため、そのままだとタイトルと図が下へずれる。
                  //    flex の縦並び＋上揃えに固定して、開いても他のカードの見た目が動かないようにする。
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch',
                  textAlign: 'left', background: c.card, border: `1px solid ${isOpen ? col : c.border}`,
                  borderRadius: 12, padding: 14, cursor: 'pointer', color: c.text,
                  transition: 'border-color .15s, transform .15s, box-shadow .15s',
                  animationDelay: `${idx * 0.04}s`,
                  boxShadow: isOpen && dark ? `0 0 24px ${col}22` : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: col, letterSpacing: '0.06em' }}>{KIND_LABEL[p.kind]}</span>
                </div>

                {/* 🔵 図は画像ではなくSVG。読み込みを増やさず、テーマにも追随できる。
                    🔴 線を**描かれていく**演出にする。形は動きで覚えるものなので、
                       静止画で並べるより「どう作られたか」が伝わる。
                    🔴 遅延をカードごとにずらして、一斉に動かない（画面がうるさくなる）ようにする。 */}
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
                      fill={`url(#cpg-${idx})`} />
                    {p.lines?.map((l, i) => (
                      <line key={`l${i}`} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y}
                        stroke={l.kind === 'sup' ? c.up : l.kind === 'res' ? c.down : col}
                        strokeWidth={1.6} strokeDasharray={l.kind === 'neck' ? '0' : '3 2'}
                        style={{ filter: dark ? `drop-shadow(0 0 4px ${col}88)` : undefined,
                          opacity: 0, animation: `cpFade .5s ease ${0.35 + idx * 0.05}s forwards` }} />
                    ))}
                    {p.slopes?.map((sl, i) => (
                      <line key={`s${i}`} x1={sl.p[0]} y1={sl.p[1]} x2={sl.p[2]} y2={sl.p[3]}
                        stroke={sl.kind === 'up' ? c.up : c.down} strokeWidth={1.6}
                        style={{ filter: dark ? `drop-shadow(0 0 4px ${col}88)` : undefined,
                          opacity: 0, animation: `cpFade .5s ease ${0.35 + idx * 0.05}s forwards` }} />
                    ))}
                    <polyline
                      points={p.path.map(([x, y]) => `${x},${y}`).join(' ')}
                      fill="none" stroke={c.line} strokeWidth={2}
                      strokeLinejoin="round" strokeLinecap="round"
                      pathLength={100}
                      style={{
                        strokeDasharray: 100, strokeDashoffset: 100,
                        animation: `cpDraw 1.1s ease-out ${idx * 0.05}s forwards`,
                        filter: dark ? 'drop-shadow(0 0 3px rgba(226,240,252,0.35))' : undefined,
                      }} />
                    {/* 抜けた先を示す矢印 */}
                    <polyline
                      points={isUp(p.kind) ? '92,26 100,8 100,20' : '92,74 100,92 100,80'}
                      fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      style={{ opacity: 0, animation: `cpFade .5s ease ${1.0 + idx * 0.05}s forwards`,
                        filter: dark ? `drop-shadow(0 0 6px ${col})` : undefined }} />
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
          })}
        </div>

      </div>
      </div>
    </div>
  )
}
