import { useState, useRef, useEffect, useCallback, type CSSProperties, type FC } from 'react'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }

type SubSection = { subtitle: string; items: string[] }
type Section = {
  id: string
  icon: string
  title: string
  tocLabel?: string
  intro?: string[]
  items?: string[]
  subs?: SubSection[]
  wide?: boolean
}

const SECTIONS: Section[] = [
  {
    id: 'calendar',
    icon: '📅',
    title: 'カレンダー',
    items: [
      '画面下のナビバーにある「カレンダー」アイコンをタップすると表示されます。',
      '上部のタブで「月・週・日」の3つのビューを切り替えられます。',
      '配当落ち日・SQ日・FOMC など、相場に影響するイベントが自動でカレンダーに表示されます。',
      '日付をタップするとメモパネルが開きます。自由記述のメモのほか、時間帯を指定したスケジュールを複数登録できます。タイトルを入力せずに閉じると空のスケジュールは自動で削除されます。',
      '週・日ビューでは、登録したスケジュールが時間グリッド上に帯として表示されます。',
      '画面左のサイドバーには付箋メモ欄があります。どのビューからでもすぐに書き留められる簡易メモです（最大1件）。',
    ],
  },
  {
    id: 'chart',
    icon: '📈',
    title: 'チャート',
    items: [
      '画面下のナビバーにある「チャート」アイコンをタップすると表示されます。チャートはメンバー登録不要で、どなたでもご覧いただけます。',
      '日経225・ドル円・米国債（米国長期国債ETF）の TradingView チャートを表示できます。上部のタブで切り替えてください。',
      '右上の分割ボタンで1画面 / 2画面を切り替えられます。2画面では2つのチャートを並べて確認できます（スマートフォンは1画面固定）。',
    ],
  },
  {
    id: 'engine',
    icon: '🔎',
    title: 'ブンセキ（需給分析）',
    tocLabel: 'ブンセキ',
    wide: true,
    intro: [
      '画面下のナビバーにある「ブンセキ」アイコン（虫めがねと棒グラフ）をタップすると表示されます。',
      '「需給・環境・現物・先物」の4つのタブで切り替えられます。',
      '需給・先物などの市場データは毎営業日の夜に自動更新されます（JPX等が前営業日分を翌営業日に公表するため、最新は通常1営業日前の確定値です）。もしデータが古く見える場合は、ページを再読み込み（スマホは下に引っ張って更新／PCは Ctrl+Shift+R）すると最新になります。',
    ],
    subs: [
      {
        subtitle: '需給タブ',
        items: [
          '「ぽいロボ ブンセキ」エリアの「クオンツ分析用プロンプト＋需給データをコピー」ボタンを押すと需給データ入りのプロンプトがコピーされます。Gemini・Claude・ChatGPT・DeepSeek などの AI に貼り付けて分析を依頼してください。右側のテキストエリアは AI 分析レポートを保存するメモ欄です。',
          'テキストを入力して「保存」を押すと表示モードに切り替わり、「確信度：XX%」「判定：〜」の行がシアン色でハイライト表示されます。表示モードのテキストエリアをタップすると編集モードに戻ります。「全選択」ボタンでテキスト全体をコピーできます。',
          'AI 出力には「慣性持続性」（強持続 / 中持続 / 枯渇圏）が含まれます。需給エネルギーがあと何週持続しそうかの指標です。「枯渇圏」の場合は需給の勢いが切れかけている状態です（強い追い風とは読みません）。最終的な投資判断はご自身で行ってください。',
          'AI 出力の「需給×価格セル」は、価格の方向（上昇 / 下落 / レンジ）と需給の方向（買い / 脆弱・売り）の組み合わせを示します。たとえば「メルトアップ（脆弱な上昇）」は価格は上がっているが需給が伴わない状態で、追いかけず守りを固め、価格がトレンドを割るまで待つ局面という意味です。',
        ],
      },
      {
        subtitle: '環境タブ',
        items: [
          'VIX（恐怖指数）・NT倍率のチャートと、ドル円の日次推移テーブルを表示します。',
        ],
      },
      {
        subtitle: '現物タブ',
        items: [
          '信用倍率・投資主体別の売買動向・騰落レシオ・空売り比率・裁定買い残のほか、日経平均の銘柄別寄与度と業種別騰落率（東証33業種）を確認できます。',
        ],
      },
      {
        subtitle: '先物タブ',
        items: [
          '海外投機筋（ヘッジファンド）の日経225先物ポジション（週次）と売り圧力スコア、建玉残高・出来高・PCR（プット/コール比）の日次テーブルを表示します。PCR が 1.2 以上は赤（弱気）、0.8 以下は緑（強気）です。右下には日経平均の日次テーブル（終値・前日比・25日移動平均乖離率）も表示されます。',
          '25日MA乖離率は「価格が25日移動平均線からどれだけ離れているか（％）」を示す過熱・過冷の目安です。色分け: +7%以上=過熱（赤）／+5〜7%=注意（黄）／-5〜-7%=注意（黄）／-7〜-10%=過冷（青）／-10%以下=暴落・最終局面（紫）。日経は上に+13%・下に-28%と非対称なため、下側だけ深い段階を設けています。トレンド中は平均から離れたまま動き続ける（バンドウォーク）ため、単独の逆張り根拠にはしないのが安全です。',
        ],
      },
    ],
  },
  {
    id: 'shield',
    icon: '🤖',
    title: 'ロボ口座',
    tocLabel: 'ロボ口座',
    intro: [
      '画面下のナビバーにある「ロボ口座」アイコン（ロボット）をタップすると表示されます。',
      'AI が毎営業日の朝に「買う／持つ／手放す」を判断し、その結果を仮想の口座に記録している画面です。実際の売買はしません。',
      '🔴 いまは開発者のみが閲覧できます。判断の精度を検証している段階のためです。',
      '「口座・成績・履歴」の3つのタブで切り替えられます。',
    ],
    subs: [
      {
        subtitle: '口座タブ',
        items: [
          '評価額・累計損益・現金と、いま持っている建玉（銘柄・数量・平均取得価格・損切り値）を表示します。',
          '🔵 損切り値は、利益が乗るほど自動で引き上がります（下がることはありません）。利益を確定するルールはあえて置いていません。この型は「たまに来る大きな勝ち」で成り立っているため、上限を決めて降りると期待値が落ちるからです。',
          '下には資産推移のグラフが出ます。元本からどう動いてきたかを見る場所です。',
        ],
      },
      {
        subtitle: '成績タブ',
        items: [
          'AI の成績と「決定論ルール（対照群）」の成績を並べて表示します。勝率・期待値・最大ドローダウンの3つです。',
          '🔴 勝率では判断しません。過去の検証で勝率34〜40%が正常と分かっています（勝ちが大きく負けが小さい型のため）。見るのは期待値と最大ドローダウンです。',
          '「YOUR CALL」は、AI の判断どおりに動いた区間と、自分で違う判断をした区間のその後を比べたものです。AI が上手いかではなく、自分の介入が効いているかを測ります。',
        ],
      },
      {
        subtitle: '履歴タブ',
        items: [
          '1件ごとの約定と、そのときの判断理由・確信度・「この判断が外れるとき」を表示します。',
          '🔴 「この判断が外れるとき」は毎回読んでください。ここに書かれた条件が実際に起きたら、その読みは外れています。',
        ],
      },
    ],
  },
  {
    id: 'sector',
    icon: '🔄',
    title: 'セクターローテーション（周期）',
    tocLabel: '周期',
    items: [
      'カレンダー画面の左サイドバー（メモの上）にある円形のバナーをタップすると表示されます。',
      '景気の循環（金融相場 → 業績相場 → 逆金融相場 → 逆業績相場）のどこにいるかと、その局面で動きやすいとされる業種を確認できます。',
      '現在地は金利と期待インフレ率の動きから決めています。どちらかが横ばいの日は判定せず、バナーもどこも光りません。',
      '🔴 「次に来るとされる業種」は循環の順番という理論の話で、上がるという意味ではありません。順位や騰落率は実測値を並べているだけです。',
      '銘柄コード・銘柄名・業種名で検索でき、行をタップすると TradingView のチャートが別タブで開きます。',
      'スマートフォンでは「セクター」「個別」の2つのタブに分かれています。セクター＝いまどの局面にいるかの円環、個別＝業種の一覧と銘柄検索です。パソコンでは3列すべてが同時に表示されるため、タブは出ません。',
      '「次に来るとされる業種」や「いま資金が向かっている業種」の行をタップすると、その業種の銘柄がそのまま下の検索結果に並びます。',
      '🔵 この画面は日経平均の話ではないため、ブンセキ（需給分析）とは切り離した別ページにしています。',
    ],
  },
  {
    id: 'believe',
    icon: '🤖',
    title: 'Believe（第4次産業革命）',
    tocLabel: 'Believe',
    intro: [
      '研究室のメニュー「Believe / 第4次産業革命」から表示されます。',
      'ロボットが第4次産業革命を起こす、という見立てで選んだ銘柄を並べているページです。数ヶ月〜年単位で見る前提で、途中の上下は判定材料にしていません。',
      '🔴 このページは研究の記録であり、売買の推奨ではありません。ロボ口座（AIの疑似トレード）の判断や売買対象にも入っていません。',
    ],
    subs: [
      {
        subtitle: '選び方',
        items: [
          '基準はひとつで、**世界で独占があるか**です。独占が無ければ、台数が増えても値下げ競争で終わってしまうためです。',
          '各カードの「MOAT / 独占」に、その会社の壁が何かを書いています。「詳しく」を押すと、なぜ見ているか（WHY）・効いていれば出てくる数字（CONFIRM）・崩れる条件（BREAK）が開きます。',
          '銘柄の入れ替えは自動では行いません。相談して決めた結果を書き込む形にしています。外した銘柄も理由とともに記録しています。',
        ],
      },
      {
        subtitle: '画面の見方',
        items: [
          '上のロボットの図は、AIを4つの層（考える・記憶・つなぐ・動く）に分けたものです。頭＝考える、胸＝記憶、配線＝つなぐ、関節＝動く に対応しています。',
          '棒はその層の代表銘柄の12ヶ月の騰落です。**まだ値段が付いていない層だけが光ります**（現時点では「動く＝ロボット」）。',
          '各カードでは、株価・前日比・12ヶ月と3ヶ月の騰落・52週高値からの距離・25日線からの乖離と、200日線つきのチャート（6ヶ月／1年／2年で切り替え）を確認できます。',
          '数値は毎営業日、自動で更新されます。',
        ],
      },
    ],
  },
  {
    id: 'lab',
    icon: '🧪',
    title: '研究室',
    wide: true,
    intro: [
      '画面下のナビバーにある「研究室」アイコンをタップすると表示されます。',
      '左のメニューから「資料」「設定」「お問い合わせ」の3つの機能にアクセスできます。',
    ],
    subs: [
      {
        subtitle: '資料',
        items: [
          '記事や解説資料を読めます。資料を開いた後、右上の「×」ボタンを押すと資料一覧に戻ります。',
          '「戦略プレイブック」では、ぽいロボを使った運用の進め方（道具の使い方・取引のルール・長期投資との違い・応用）をスライドでまとめています。画面下の矢印（▼／▲）やスマートフォンの上下スワイプで1枚ずつめくれます。各「ぽいロボ ◯◯」のスライドには、これから使い方動画も掲載予定です。',
        ],
      },
      {
        subtitle: '設定',
        items: [
          'テーマ（ライト / ダーク）の切り替えと、Google アカウントでのログイン・ログアウトができます。ログインすると複数デバイス間でメモが自動同期されます。',
          'ログイン後はプッシュ通知を ON にできます。「ぽいロボ レーダー」（選択イベントの前日 12:30 に通知）と「需給データ更新通知」（週次データ更新後に通知）を個別に ON/OFF できます。',
          '🔴 レーダーの通知対象は、はじめは「メジャーSQ」「ミニSQ」だけが選ばれています。FOMC・日銀・米CPI・雇用統計などは、カレンダー画面のぽいロボアラート設定で個別にチェックを入れないと通知されません。',
        ],
      },
      {
        subtitle: 'お問い合わせ',
        items: [
          'フォームからお問い合わせを送信できます（種別選択 ＋ 内容入力）。',
        ],
      },
      {
        subtitle: 'ぽいロボ コネクト',
        items: [
          '画面右下の「ぽいロボ コネクト」ボタンから予約画面を開けます。ログイン不要で空き枠を確認でき、枠を選んで申請するとログインを求められます。ログイン後は予約内容の確認やカレンダーへの登録（.ics ファイルのダウンロード）もできます。',
          'セッション開始の5分前になると「今すぐ接続する」ボタンが現れます。タップするとぽいふる博士との音声通話・画面共有が始まります。通話中でも最小化して他の画面を見ながら話せます（iOS は画面共有非対応）。',
        ],
      },
    ],
  },
  {
    id: 'notice',
    icon: '📌',
    title: 'ご利用にあたって',
    items: [
      'ぽいロボは、相場のカレンダー・客観的な需給データ・過去の検証結果の提示と、それらの分析を補助するツール・教育コンテンツを提供するサービスです。',
      'ぽいロボは金融商品取引業（投資助言・代理業を含む）の登録を受けておらず、特定の銘柄等についての売買の助言やシグナルの配信は行いません。ブンセキ・ロボ口座・戦略プレイブックなどが示す指標・需給状態・手法は、過去データにもとづく客観的な情報および教育であり、売買の推奨・指示ではありません。',
      '投資の最終判断は、必要に応じて外部 AI などの分析を参考にしつつ、ご自身の責任で行ってください。詳しくは「資料」内のプライバシー・免責事項をご確認ください。',
    ],
  },
]

// ── スライドの割り方 ────────────────────────────────────────────────────────
// 🔴 1枚に入れるのは**1トピックだけ**。章の中のタブ解説（サブセクション）も1枚ずつに割る。
//    章まるごと1枚だと中身がはみ出して**スライドの中でスクロール**することになり、
//    「めくる」と「スクロールする」が混ざって読みづらい（2026-08-13 ユーザー指摘）。
// 🔵 目次は章単位のまま。押せばその章の1枚目へ飛ぶ。
type Page = {
  key: string
  secIdx: number
  sec: Section
  sub?: SubSection
  /** 章の中で何枚目か（1始まり）。1枚しかない章では出さない */
  part: number
  parts: number
}

function buildPages(sections: Section[]): Page[] {
  const pages: Page[] = []
  sections.forEach((sec, secIdx) => {
    const parts = (sec.intro || sec.items ? 1 : 0) + (sec.subs?.length ?? 0)
    let part = 0
    if (sec.intro || sec.items) {
      part += 1
      pages.push({ key: sec.id, secIdx, sec, part, parts })
    }
    sec.subs?.forEach(sub => {
      part += 1
      pages.push({ key: `${sec.id}-${sub.subtitle}`, secIdx, sec, sub, part, parts })
    })
  })
  return pages
}

const PAGES = buildPages(SECTIONS)
/** 章 → その章の1枚目のページ番号 */
const FIRST_PAGE = SECTIONS.map(sec => PAGES.findIndex(p => p.sec === sec))

export const ManualView: FC<Props> = ({ theme, isMobile, onClose }) => {
  const L = theme === 'light'

  const c = {
    HDRBG:   L ? 'rgba(228,242,255,0.97)' : 'rgba(3,9,22,0.97)',
    BG:      L ? 'rgba(218,236,255,0.92)' : 'rgba(3,10,24,0.92)',
    ACCENT:  L ? '#0369a1'                : '#00e5ff',
    DIM:     L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.52)',
    TEXT:    L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:     L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:    L ? 'rgba(3,105,161,0.12)'   : 'rgba(0,200,255,0.10)',
    CARD:    L ? 'rgba(255,255,255,0.52)' : 'rgba(0,200,255,0.04)',
    CARDBR:  L ? 'rgba(3,105,161,0.14)'   : 'rgba(0,200,255,0.10)',
    SUBTAG:  L ? 'rgba(3,105,161,0.55)'   : 'rgba(0,229,255,0.60)',
    SCAN:    L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    BULLET:  L ? 'rgba(3,105,161,0.50)'   : 'rgba(0,229,255,0.45)',
    GHOST:   L ? 'rgba(3,105,161,0.055)'  : 'rgba(0,229,255,0.05)',
  }

  const mono = "'Courier New', Courier, monospace" as const

  const total = PAGES.length
  const [idx, setIdx] = useState(0)
  const go = useCallback((n: number) => setIdx(Math.max(0, Math.min(total - 1, n))), [total])
  const page = PAGES[idx]

  // スワイプ：万一はみ出したときのため、スクロール端に着いた向きにだけ送る
  const touchY = useRef<number | null>(null)
  const atTop = useRef(true)
  const atBottom = useRef(true)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [idx, go, onClose])

  const chevron = (down: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: down ? 'none' : 'rotate(180deg)' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )

  const navBtn = (disabled: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 9,
    border: `1px solid ${c.CARDBR}`, background: c.CARD, color: c.ACCENT,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.28 : 1,
    transition: 'opacity .2s',
  })

  const bullets = page.sub ? page.sub.items : [...(page.sec.intro ?? []), ...(page.sec.items ?? [])]
  const next = PAGES[idx + 1]
  const nextLabel = next ? (next.sub ? next.sub.subtitle : (next.sec.tocLabel ?? next.sec.title)) : ''

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      background: c.BG,
      backgroundImage: c.SCAN,
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
    }}>
      <style>{`
        @keyframes mvFadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mvSweep  { from { transform:translateY(-100%); } to { transform:translateY(250%); } }
        @keyframes mvNumIn  { from { opacity:0; transform:translateX(24px) scale(1.06); } to { opacity:1; transform:none; } }
        @keyframes mvRow    { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .mv-page-in { animation: mvFadeUp .45s cubic-bezier(.16,1,.3,1) both; }
        .mv-num-in  { animation: mvNumIn .55s cubic-bezier(.16,1,.3,1) both; }
        .mv-row     { animation: mvRow .4s ease both; }
        @media (prefers-reduced-motion: reduce) { .mv-page-in, .mv-num-in, .mv-row { animation: none; } }
      `}</style>

      {!L && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '26%',
            background: 'linear-gradient(to bottom,transparent 0%,rgba(0,229,255,0.024) 50%,transparent 100%)',
            animation: 'mvSweep 11s linear infinite',
          }} />
        </div>
      )}

      {/* ── ヘッダー ── */}
      <div style={{
        flexShrink: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: isMobile ? '11px 16px' : '12px 28px',
        background: c.HDRBG,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${c.RULE}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.ACCENT, boxShadow: L ? 'none' : `0 0 7px ${c.ACCENT}`, flexShrink: 0 }} />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
          color: c.DIM, fontFamily: mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: L ? 'none' : '0 0 10px rgba(0,229,255,0.28)',
        }}>
          ぽいロボ ▸ 使い方ガイド
        </span>
        <span style={{ fontSize: 9, color: c.SUB, fontFamily: mono, flexShrink: 0, letterSpacing: '0.06em' }}>{idx + 1} / {total}</span>
        {onClose && (
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 7,
            border: L ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
            background: L ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
            color: L ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)',
            cursor: 'pointer', flexShrink: 0,
          }} aria-label="閉じる">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── 進捗バー ── */}
      <div style={{ flexShrink: 0, height: 2, background: c.RULE, zIndex: 5 }}>
        <div style={{
          height: '100%', width: `${((idx + 1) / total) * 100}%`,
          background: c.ACCENT, boxShadow: L ? 'none' : `0 0 8px ${c.ACCENT}`,
          transition: 'width .45s cubic-bezier(.22,1,.36,1)',
        }} />
      </div>

      {/* ── 本体（PCは目次＋1枚）── */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex',
        gap: isMobile ? 0 : 22,
        padding: isMobile ? 0 : '18px 32px 14px 28px',
        zIndex: 1,
      }}>

        {/* 目次 — PC のみ。章の1枚目へ飛ぶ */}
        {!isMobile && (
          <nav style={{ width: 176, flexShrink: 0, paddingTop: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: c.DIM, fontFamily: mono, marginBottom: 12, paddingLeft: 4 }}>
              CONTENTS
            </div>
            {SECTIONS.map((sec, i) => {
              const on = page.secIdx === i
              return (
                <button key={sec.id} onClick={() => go(FIRST_PAGE[i])} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '5px 8px', marginBottom: 2, borderRadius: 7,
                  border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                  background: on ? c.CARD : 'transparent',
                  borderLeft: `2px solid ${on ? c.ACCENT : 'transparent'}`,
                  color: on ? c.ACCENT : c.DIM,
                  fontSize: 12, fontFamily: mono, lineHeight: 1.35,
                  transition: 'color 0.15s, background 0.15s',
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{sec.icon}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sec.tocLabel ?? sec.title}
                  </span>
                  {on && page.parts > 1 && (
                    <span style={{ fontSize: 9, opacity: 0.75, flexShrink: 0 }}>{page.part}/{page.parts}</span>
                  )}
                </button>
              )
            })}
          </nav>
        )}

        {/* 1枚（めくる） */}
        <div
          style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
          onTouchStart={e => {
            touchY.current = e.touches[0].clientY
            const el = (e.target as HTMLElement).closest('[data-mv-page]') as HTMLElement | null
            if (el) {
              atTop.current = el.scrollTop <= 1
              atBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
            } else {
              atTop.current = true
              atBottom.current = true
            }
          }}
          onTouchEnd={e => {
            if (touchY.current == null) return
            const d = touchY.current - e.changedTouches[0].clientY
            touchY.current = null
            if (Math.abs(d) < 48) return
            if (d > 0) { if (atBottom.current) go(idx + 1) }
            else if (atTop.current) go(idx - 1)
          }}
        >
          {/* 背景の巨大な章番号 */}
          <span key={`n${idx}`} className="mv-num-in" aria-hidden style={{
            position: 'absolute', right: isMobile ? 6 : 18, top: isMobile ? 4 : -12,
            fontFamily: mono, fontWeight: 700, fontSize: isMobile ? 84 : 150,
            lineHeight: 1, color: c.GHOST, pointerEvents: 'none', userSelect: 'none', zIndex: 0,
          }}>{String(page.secIdx + 1).padStart(2, '0')}</span>

          <div
            data-mv-page
            style={{
              flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative', zIndex: 1,
              padding: isMobile ? '18px 16px 84px' : '0 6px 8px 0',
            }}
          >
            <div key={`p${idx}`} className="mv-page-in" style={{ maxWidth: 860 }}>
              <div style={{ background: c.CARD, border: `1px solid ${c.CARDBR}`, borderRadius: 12, overflow: 'hidden' }}>
                {/* 章ヘッダー（サブがある枚は「章 ▸ タブ名」）*/}
                <div style={{
                  padding: isMobile ? '11px 16px' : '13px 20px',
                  borderBottom: `1px solid ${c.CARDBR}`,
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                }}>
                  <span style={{ width: 4, height: 14, borderRadius: 2, background: c.ACCENT, flexShrink: 0, boxShadow: L ? 'none' : `0 0 6px ${c.ACCENT}` }} />
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{page.sec.icon}</span>
                  <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: page.sub ? c.SUB : c.TEXT, letterSpacing: '0.03em' }}>
                    {page.sec.title}
                  </span>
                  {page.sub && (
                    <>
                      <span style={{ color: c.SUBTAG, fontSize: 12 }}>▸</span>
                      <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: c.TEXT, letterSpacing: '0.03em' }}>
                        {page.sub.subtitle}
                      </span>
                    </>
                  )}
                  {page.parts > 1 && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: c.SUB, fontFamily: mono, letterSpacing: '0.08em' }}>
                      {page.part} / {page.parts}
                    </span>
                  )}
                </div>

                {/* 本文（1枚1トピックなので1カラム。横に切れない）*/}
                <div style={{
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  display: 'flex', flexDirection: 'column', gap: isMobile ? 11 : 13,
                }}>
                  {bullets.map((item, ii) => (
                    <div key={ii} className="mv-row" style={{ display: 'flex', gap: isMobile ? 9 : 10, alignItems: 'flex-start', animationDelay: `${0.06 + ii * 0.05}s` }}>
                      <span style={{
                        fontFamily: mono, fontSize: isMobile ? 9 : 10, fontWeight: 700,
                        color: c.BULLET, flexShrink: 0, marginTop: isMobile ? 4 : 5,
                        textShadow: L ? 'none' : `0 0 6px ${c.BULLET}`,
                      }}>▸</span>
                      <span style={{ fontSize: isMobile ? 13 : 13.5, color: c.SUB, lineHeight: 1.82, letterSpacing: '0.01em' }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 次の1枚の予告 */}
              {next && (
                <button onClick={() => go(idx + 1)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginTop: 12, padding: '9px 14px', borderRadius: 10,
                  border: `1px solid ${c.CARDBR}`, background: 'transparent',
                  color: c.DIM, fontFamily: mono, fontSize: 11, cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}>
                  <span>NEXT ▸</span>
                  <span style={{ fontSize: 13 }}>{next.sec.icon}</span>
                  <span>{nextLabel}</span>
                </button>
              )}
            </div>
          </div>

          {/* めくる矢印 */}
          <div style={{
            position: 'absolute', right: isMobile ? 12 : 10, bottom: isMobile ? 18 : 10,
            display: 'flex', flexDirection: 'column', gap: 8, zIndex: 4,
          }}>
            <button onClick={() => go(idx - 1)} disabled={idx === 0} style={navBtn(idx === 0)} aria-label="前へ">{chevron(false)}</button>
            <button onClick={() => go(idx + 1)} disabled={idx === total - 1} style={navBtn(idx === total - 1)} aria-label="次へ">{chevron(true)}</button>
          </div>

          {/* ドット（章の切れ目で間隔をあける。スマホでは目次の代わり）*/}
          <div style={{
            position: 'absolute', left: isMobile ? 16 : 2, bottom: isMobile ? 24 : 14,
            display: 'flex', alignItems: 'center', gap: 4, zIndex: 4, flexWrap: 'wrap', maxWidth: '70%',
          }}>
            {PAGES.map((p, i) => (
              <button key={p.key} onClick={() => go(i)}
                aria-label={`${p.sec.tocLabel ?? p.sec.title}${p.sub ? ` ${p.sub.subtitle}` : ''}`}
                style={{
                  width: idx === i ? 16 : 5, height: 5, borderRadius: 3, padding: 0,
                  marginLeft: i > 0 && PAGES[i - 1].secIdx !== p.secIdx ? 7 : 0,
                  border: 'none', cursor: 'pointer',
                  background: idx === i ? c.ACCENT : (p.secIdx === page.secIdx ? c.SUBTAG : c.CARDBR),
                  boxShadow: (!L && idx === i) ? `0 0 8px ${c.ACCENT}` : 'none',
                  transition: 'width .3s, background .3s',
                }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManualView
