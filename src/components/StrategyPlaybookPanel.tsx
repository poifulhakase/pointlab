import { useState, useEffect, useCallback, useRef } from 'react'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

const mono = "'Courier New', Courier, monospace" as const

type C = {
  L: boolean; BG: string; HDRBG: string; ACCENT: string; DIM: string
  TEXT: string; SUB: string; RULE: string; TAGBG: string; TAGBDR: string
  SCAN: string; WIN: string; LOSS: string; WARN: string; CARD: string
}
function makeC(theme: 'dark' | 'light'): C {
  const L = theme === 'light'
  return {
    L,
    BG:     L ? 'rgba(238,246,255,0.78)' : 'rgba(4,10,22,0.55)',
    HDRBG:  L ? 'rgba(248,252,255,0.90)' : 'rgba(4,10,22,0.80)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.42)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.16)'   : 'rgba(0,229,255,0.16)',
    TAGBG:  L ? 'rgba(3,105,161,0.07)'   : 'rgba(0,229,255,0.10)',
    TAGBDR: L ? 'rgba(3,105,161,0.22)'   : 'rgba(0,229,255,0.16)',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    WIN:    L ? '#15803d'                : '#4ade80',
    LOSS:   L ? '#dc2626'                : '#f87171',
    WARN:   L ? '#b45309'                : '#fbbf24',
    CARD:   L ? 'rgba(255,255,255,0.66)' : 'rgba(8,16,30,0.55)',
  }
}

// ── やること（初心者向け・3つだけ）──
const ACTIONS = [
  { n: '1', t: '大きく下げたら買う', s: 'ただし下落が続いている最中は手を出さない（落ちるナイフを避ける）' },
  { n: '2', t: '上げている間は乗る／下げ続けたら降りる', s: '暴落を避ける装置。トレンドが続く限り持つ' },
  { n: '3', t: '3月と12月は買う', s: '3月＝配当の権利確定前／12月＝年末。上がりやすい季節' },
]

// ── 採用エッジ（検証済み・使う）── plain=やさしい説明 / 以下は折りたたみ内の詳細
type Edge = { name: string; grade: '◎' | '○' | '△'; gradeLabel: string; plain: string; aim: string; trigger: string; hold: string; ev: string; dd: string }
const ADOPTED: Edge[] = [
  { name: 'トレンドフィルター', grade: '◎', gradeLabel: '暴落よけの“お守り”（一番だいじ）',
    plain: '上がっている相場のときだけ乗る仕組み。高値を更新したら買い、下がり始めたら降りる。これで大きな暴落をよけられます。',
    aim: '暴落を回避してドローダウンを抑える', trigger: '50日高値を上抜けで買い／25日安値割れで撤退（ロングのみ）', hold: 'トレンドが続く限り', ev: 'CAGR 約10%（2倍）', dd: '−39%（常時ロング−88%の半分）' },
  { name: '売られすぎ買い（押し目）', grade: '△', gradeLabel: 'チャンスは少なめ',
    plain: '大きく下げたところを買って、反発をねらいます。ただし下げ続けている最中は手を出しません（落ちるナイフを避ける）。',
    aim: '売られすぎの反発を取る', trigger: '25日線 ≤ −10%。下落トレンド中は見送り（落ちるナイフ回避）', hold: '5営業日で機械的に降りる', ev: '−10%で +1.8%（勝率66%）', dd: '単体−57%（濾すと改善）' },
  { name: '季節性：3月の権利確定', grade: '○', gradeLabel: '一番つよい季節',
    plain: '3月は配当をもらう権利を取りにいく買いが入りやすい時期。3月中旬から月末まで持ちます（年1回）。',
    aim: '配当の権利確定に向けた買い需要', trigger: '3/15頃 → 3/27頃', hold: '約2週間（年1回）', ev: '+3.2%（勝率70%）', dd: '窓 −37%' },
  { name: '季節性：年末ラリー', grade: '○', gradeLabel: '当たりやすい・小さめ',
    plain: '12月末は上がりやすい時期。12月中旬から年末まで持ちます（年1回）。',
    aim: '年末の買い需要', trigger: '12/15頃 → 12/30頃', hold: '約2週間（年1回）', ev: '+0.95%（勝率75%）', dd: '低' },
]

// アプリ内（フッターナビ）と同一のアイコン
function CalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function EngineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
    </svg>
  )
}
function ShieldGuardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

export function StrategyPlaybookPanel({ theme, isMobile, onClose }: Props) {
  const c = makeC(theme)
  const PAD = isMobile ? '26px 20px' : '42px 46px'

  // スライド枠
  const slide = (title: string, subtitle: string, body: React.ReactNode, icon?: React.ReactNode) => (
    <section style={{ borderRadius: 18, border: `1px solid ${c.TAGBDR}`, background: c.CARD, padding: PAD, boxShadow: c.L ? '0 2px 10px rgba(0,50,110,0.06)' : '0 2px 16px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 14, marginBottom: isMobile ? 22 : 30, paddingBottom: isMobile ? 16 : 22, borderBottom: `1px solid ${c.RULE}` }}>
        {icon && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 36 : 42, height: isMobile ? 36 : 42, borderRadius: 11, flexShrink: 0, color: c.ACCENT, background: c.L ? 'rgba(3,105,161,0.08)' : 'rgba(0,229,255,0.08)', border: `1px solid ${c.TAGBDR}`, overflow: 'hidden', boxShadow: c.L ? 'none' : `0 0 10px ${c.ACCENT}22` }}>{icon}</span>
        )}
        <div>
          <div style={{ fontSize: isMobile ? 17 : 23, fontWeight: 800, color: c.TEXT, letterSpacing: '0.01em', lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: isMobile ? 9.5 : 11, color: c.DIM, marginTop: 6, fontFamily: mono, letterSpacing: '0.12em' }}>{subtitle}</div>}
        </div>
      </div>
      {body}
    </section>
  )

  // KPIスタット
  const stat = (label: string, value: string, color: string, small = false) => (
    <div style={{
      flex: 1, minWidth: isMobile ? 0 : 130, padding: isMobile ? '16px 18px' : '24px 26px',
      borderRadius: 14, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG,
      boxShadow: c.L ? '0 1px 6px rgba(0,50,110,0.05)' : 'none',
    }}>
      <div style={{ fontSize: isMobile ? 9 : 10.5, color: c.DIM, fontFamily: mono, letterSpacing: '0.08em', marginBottom: 13 }}>{label}</div>
      <div style={{ fontSize: small ? (isMobile ? 14 : 17) : (isMobile ? 20 : 27), fontWeight: 800, color, lineHeight: small ? 1.4 : 1, letterSpacing: '0.01em' }}>{value}</div>
    </div>
  )

  // カード内のラベル:値 行
  const kv = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', gap: 11, alignItems: 'baseline' }}>
      <span style={{ flexShrink: 0, width: isMobile ? 48 : 54, fontSize: isMobile ? 9 : 10, color: c.DIM, fontWeight: 700, fontFamily: mono, letterSpacing: '0.03em', lineHeight: 1.6 }}>{label}</span>
      <span style={{ fontSize: isMobile ? 11 : 12.5, color: color || c.TEXT, lineHeight: 1.65, fontWeight: color ? 700 : 400 }}>{value}</span>
    </div>
  )

  // ポイント枠（左にシアンの細線）
  const point = (label: string, text: React.ReactNode) => (
    <div style={{ padding: isMobile ? '13px 15px' : '16px 20px', borderRadius: 12, background: c.TAGBG, border: `1px solid ${c.TAGBDR}`, borderLeft: `3px solid ${c.ACCENT}`, fontSize: isMobile ? 11.5 : 13, color: c.SUB, lineHeight: 1.8 }}>
      <span style={{ display: 'block', fontSize: isMobile ? 9.5 : 10.5, fontWeight: 700, color: c.ACCENT, fontFamily: mono, letterSpacing: '0.1em', marginBottom: 7 }}>{label}</span>
      {text}
    </div>
  )

  // 使い方動画の埋め込み枠（後で iframe / video を差し込む。現状はプレースホルダー）
  const videoFrame = (
    <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 560, margin: '0 auto', aspectRatio: '16 / 9', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.L ? 'rgba(3,105,161,0.05)' : 'rgba(0,229,255,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <span style={{ width: 52, height: 52, borderRadius: '50%', border: `1.5px solid ${c.ACCENT}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.ACCENT, background: c.L ? 'rgba(255,255,255,0.5)' : 'rgba(0,229,255,0.06)', boxShadow: c.L ? 'none' : `0 0 14px ${c.ACCENT}33` }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </span>
      <span style={{ fontSize: isMobile ? 10 : 11, fontFamily: mono, color: c.DIM, letterSpacing: '0.12em' }}>使い方動画（準備中）</span>
    </div>
  )

  // 道具スライドの本体（使い方動画＋説明文＋ポイント枠）
  const toolBody = (intro: React.ReactNode, pointLabel: string, pointText: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>
      {videoFrame}
      <div style={{ fontSize: isMobile ? 12.5 : 14, color: c.SUB, lineHeight: 1.9 }}>{intro}</div>
      {point(pointLabel, pointText)}
    </div>
  )

  // ── スライド本体（1枚ずつ切替）──
  const slides: { id: string; node: React.ReactNode }[] = [
    // ════ 表紙 ════
    { id: 'cover', node: (
      <div style={{ padding: isMobile ? '4px 2px' : '8px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 24, height: 2, borderRadius: 2, background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}` }} />
          <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, letterSpacing: '0.28em', color: c.ACCENT, fontFamily: mono }}>POIROBO STRATEGY</span>
        </div>
        <div style={{
          fontSize: isMobile ? 27 : 42, fontWeight: 800, lineHeight: 1.15, letterSpacing: '0.01em', marginBottom: 18,
          background: c.L ? 'linear-gradient(92deg,#0c4a6e,#0369a1)' : 'linear-gradient(92deg,#ffffff 35%,#00e5ff)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: c.TEXT,
          filter: c.L ? 'none' : 'drop-shadow(0 0 18px rgba(0,229,255,0.22))', width: 'fit-content',
        }}>戦略プレイブック</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 11 : 14, fontSize: isMobile ? 12.5 : 15, color: c.SUB, lineHeight: 1.8, marginBottom: isMobile ? 26 : 40, maxWidth: 640 }}>
          <p style={{ margin: 0 }}>ぽいロボを使って<b style={{ color: c.TEXT }}>「どう売買し、どう運用していくか」</b>をまとめた作戦書です。</p>
          <p style={{ margin: 0 }}>使うのは、ふつうに買える<b style={{ color: c.TEXT }}>日経225のETF</b>です。</p>
          <p style={{ margin: 0 }}>ルールはシンプル。<b style={{ color: c.TEXT }}>下げたら買い、上げている間は持つ</b>。</p>
          <p style={{ margin: 0 }}>大もうけより、<b style={{ color: c.TEXT }}>「大きく負けないこと」を最優先</b>にします。</p>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flexWrap: 'wrap' }}>
          {stat('使うもの', '日経平均 ブル/ベア1倍2倍 ETF', c.TEXT, true)}
        </div>
        <div style={{ marginTop: isMobile ? 26 : 38, fontSize: isMobile ? 10 : 11, color: c.DIM, fontFamily: mono, letterSpacing: '0.06em' }}>
          ↓ 下の矢印で1枚ずつめくれます
        </div>
      </div>
    ) },

    // ════ 全体像 ════
    { id: 'overview', node: slide('ぽいロボでの運用', '全体像・OVERVIEW', (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10, fontSize: isMobile ? 12.5 : 14, color: c.SUB, lineHeight: 1.9 }}>
          <p style={{ margin: 0 }}>ぽいロボは「相場のいま」を読む<b style={{ color: c.TEXT }}>3つの道具</b>と、迷ったとき頼れる<b style={{ color: c.TEXT }}>伴走</b>でできています。</p>
          <p style={{ margin: 0 }}>やることは、<b style={{ color: c.TEXT }}>道具で“いまの地合い”を確かめ、ルールどおり淡々と動く</b>だけです。</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 14 }}>
          {[
            { icon: <CalIcon />,         nm: 'ぽいロボ レーダー',   ds: 'この先「何が起きるか」を知り、大事な日は前日に通知' },
            { icon: <EngineIcon />,       nm: 'ぽいロボ エンジン',   ds: 'いま「買っていい地合いか」を需給で確かめる' },
            { icon: <ShieldGuardIcon />,  nm: 'ぽいロボ シールド',   ds: '持っているものを「いつ手放すか」を決める' },
            { icon: <img src={`${import.meta.env.BASE_URL}hakase.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />, nm: 'ぽいロボ コネクト', ds: '迷ったら「ぽいふる博士に相談」できる' },
          ].map(({ icon, nm, ds }) => (
            <div key={nm} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: isMobile ? '13px 14px' : '16px 18px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, flexShrink: 0, color: c.ACCENT, background: c.L ? 'rgba(3,105,161,0.08)' : 'rgba(0,229,255,0.08)', border: `1px solid ${c.TAGBDR}`, overflow: 'hidden' }}>{icon}</span>
              <span>
                <b style={{ fontSize: isMobile ? 13 : 14.5, color: c.ACCENT }}>{nm}</b>
                <span style={{ display: 'block', marginTop: 4, fontSize: isMobile ? 11 : 12.5, color: c.SUB, lineHeight: 1.55 }}>{ds}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    )) },

    // ════ 1週間の流れ ════
    { id: 'week', node: slide('1週間の流れ', '土曜起点・ROUTINE', (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {([
          ['1', '土曜（週の準備）', '金曜までの需給データが出そろう日。エンジンで最新の地合いを確認し、カレンダーで来週の予定（イベント・季節）をチェック。レーダー通知をONに。'],
          ['2', '平日（エントリー）', '重要イベントの前は控えめに。チャンスがルールに合えば買う。合わなければ何もしないのも仕事。'],
          ['3', '持っている間（管理）', 'シールドで出口（利確・損切り）を見守る。'],
          ['4', '迷ったら（伴走）', 'コネクトでぽいふる博士に相談。ひとりで抱えない。'],
        ] as const).map(([n, h, d], i, arr) => (
          <div key={n}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: isMobile ? '13px 14px' : '16px 20px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG }}>
              <span style={{ flexShrink: 0, width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: '50%', background: c.ACCENT, color: c.L ? '#fff' : '#04101a', fontWeight: 800, fontSize: isMobile ? 14 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}55` }}>{n}</span>
              <span style={{ paddingTop: 2 }}>
                <b style={{ fontSize: isMobile ? 13.5 : 15 }}>{h}</b>
                <span style={{ display: 'block', marginTop: 5, fontSize: isMobile ? 11.5 : 13, color: c.SUB, lineHeight: 1.6 }}>{d}</span>
              </span>
            </div>
            {i < arr.length - 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? '7px 0' : '9px 0', color: c.ACCENT }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v13M6 12l6 6 6-6"/></svg>
              </div>
            )}
          </div>
        ))}
        <div style={{ fontSize: isMobile ? 11.5 : 13, color: c.SUB, lineHeight: 1.8, marginTop: isMobile ? 16 : 20 }}>
          毎日張りつく必要はありません。<b style={{ color: c.TEXT }}>「土曜に整える → 平日に動く → 出口を守る → 迷えば相談」</b>の繰り返しです。
        </div>
      </div>
    )) },

    // ════ 道具：ぽいロボ レーダー（カレンダー）════
    { id: 'radar', node: slide('ぽいロボ レーダー', 'いつを知る・CALENDAR', toolBody(
      <>配当落ち日・SQ・FOMC・雇用統計・休場日が<b style={{ color: c.TEXT }}>自動で並ぶ</b>カレンダーです。重要イベントの前は値が荒れやすいので<b style={{ color: c.TEXT }}>新規は控えめ</b>に。<b style={{ color: c.TEXT }}>3月（権利確定前）・12月（年末）は季節の追い風</b>です。</>,
      '使い方の主役＝レーダー通知',
      <>気になるイベント（FOMC・雇用統計・SQ など）を選んでおくと、<b style={{ color: c.TEXT }}>前日のお昼（12:30）にスマホへ通知</b>が届きます。受け取る種別は設定で選べるので、見たいイベントだけを逃さずキャッチできます。</>,
    ), <CalIcon />) },

    // ════ 道具：ぽいロボ エンジン ════
    { id: 'engine', node: slide('ぽいロボ エンジン', '買っていい地合いか・ENGINE', toolBody(
      <>需給を物理にたとえて、相場のエネルギー（TEV）を診断します。「<b style={{ color: c.TEXT }}>需給×価格セル</b>」「<b style={{ color: c.TEXT }}>慣性持続性</b>」で、いまが<b style={{ color: c.TEXT }}>順行・売られすぎ・限界</b>のどれかがひと目で分かります。</>,
      '基本の使い方',
      <>ボタン一つでAI用プロンプトをコピーでき、AIに<b style={{ color: c.TEXT }}>確信度つきの判定</b>を出してもらえます。<b style={{ color: c.TEXT }}>“枯渇圏”のときは本命の買いを控える</b>——これが基本です。</>,
    ), <EngineIcon />) },

    // ════ 道具：ぽいロボ シールド ════
    { id: 'shield-tool', node: slide('ぽいロボ シールド', 'いつ手放すか・SHIELD', toolBody(
      <>持っているポジション専用の道具です。証券口座の<b style={{ color: c.TEXT }}>保有画面のスクショ</b>を撮り、シールドの市場データ＋プロンプトと一緒にAIへ。<b style={{ color: c.TEXT }}>持ち続ける／利確／損切り</b>の出口を相談できます。</>,
      '「守り」の道具',
      <>エントリー（買い）ではなく、買ったあとの<b style={{ color: c.TEXT }}>出口</b>を整える道具。持っている間の不安をここで整理します。</>,
    ), <ShieldGuardIcon />) },

    // ════ 道具：ぽいロボ コネクト ════
    { id: 'connect', node: slide('ぽいロボ コネクト', 'ひとりで悩まない・CONNECT', toolBody(
      <>研究室の右下から、<b style={{ color: c.TEXT }}>ぽいふる博士と30分の通話</b>を予約できます。空き枠を選んで申請し、承認されると画面から接続。「自分の運用を見てほしい」「判断に迷っている」——そんなときの<b style={{ color: c.TEXT }}>伴走</b>の場です。</>,
      '次は「取引のルール」へ',
      <>道具で地合いを見たら、あとは次のルールで淡々と動くだけ。下の矢印で取引パートへ進みましょう。</>,
    ), <img src={`${import.meta.env.BASE_URL}hakase.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) },

    // ════ 取引パート（PART 2）════
    { id: 's1', node: slide('やることは3つだけ', 'PART 2 ─ 取引のルール', (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 11 : 14, marginBottom: isMobile ? 16 : 20 }}>
          {ACTIONS.map(a => (
            <div key={a.n} style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: 'flex-start', gap: isMobile ? 14 : 12, padding: isMobile ? '13px 14px' : '20px 20px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG }}>
              <span style={{ flexShrink: 0, width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: '50%', background: c.ACCENT, color: c.L ? '#fff' : '#04101a', fontWeight: 800, fontSize: isMobile ? 15 : 17, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}55` }}>{a.n}</span>
              <span style={{ paddingTop: isMobile ? 2 : 0 }}>
                <b style={{ fontSize: isMobile ? 14 : 15 }}>{a.t}</b>
                <span style={{ display: 'block', marginTop: 6, fontSize: isMobile ? 11.5 : 12.5, color: c.SUB, lineHeight: 1.6 }}>{a.s}</span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: isMobile ? 10 : 11.5, color: c.DIM, fontWeight: 700, fontFamily: mono, marginRight: 2 }}>やらない：</span>
          {['信用・空売り', '毎日売買', '損切りの連発'].map(x => (
            <span key={x} style={{ fontSize: isMobile ? 10.5 : 12, color: c.SUB, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG, borderRadius: 999, padding: '4px 12px', fontWeight: 600 }}>✕ {x}</span>
          ))}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: isMobile ? 10.5 : 12, color: c.SUB, fontFamily: mono, userSelect: 'none' }}>
            ▸ 用語（CAGR / DD / 乖離 / 勝率）
          </summary>
          <div style={{ paddingLeft: 4, marginTop: 10, fontSize: isMobile ? 11 : 12.5, color: c.SUB, lineHeight: 1.9 }}>
            ・<b>CAGR</b>＝1年で平均何％増えたか（複利の年率）<br />
            ・<b>DD（ドローダウン）</b>＝一番高かった所から最大何％下がったか（痛みの大きさ）<br />
            ・<b>乖離（かいり）</b>＝価格が移動平均線からどれだけ離れたか<br />
            ・<b>勝率</b>＝勝ったトレードの割合 ／ <b>期待値</b>＝1回平均で何％取れるか
          </div>
        </details>
      </>
    )) },

    // ════ スライド2：長期投資と何が違う？ ════
    { id: 's2', node: slide('長期投資と何が違う？', 'なぜ“買い持ち”だけじゃないか・VS BUY&HOLD', (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 13, fontSize: isMobile ? 12 : 13.5, color: c.SUB, lineHeight: 1.8, marginBottom: isMobile ? 18 : 22 }}>
          <p style={{ margin: 0 }}>「長期投資（買って持ちっぱなし）でいいのでは？」——いい質問です。</p>
          <p style={{ margin: 0 }}>上げ相場では長期投資は強い。でも弱点は<b style={{ color: c.TEXT }}>暴落をまるごと食らうこと</b>。</p>
          <p style={{ margin: 0 }}>日経平均は過去に<b style={{ color: c.TEXT }}>最悪−80%、高値を取り戻すのに約34年</b>かかりました。</p>
        </div>

        {/* 簡易グラフ（資産の動きイメージ） */}
        <div style={{ padding: isMobile ? '14px 12px' : '18px 18px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG }}>
          <svg viewBox="0 0 320 165" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <line x1="8" y1="120" x2="312" y2="120" stroke={c.RULE} strokeWidth="1" strokeDasharray="3 4" />
            <polyline points="8,120 52,98 92,72 118,152 158,152 198,148 248,118 312,96" fill="none" stroke={c.DIM} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="8,122 56,100 100,84 128,106 170,86 230,80 312,74" fill="none" stroke={c.ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 10 : 18, marginTop: 10, fontSize: isMobile ? 10 : 11, fontFamily: mono }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.SUB }}><span style={{ width: 16, height: 3, borderRadius: 2, background: c.DIM }} />長期投資（買い持ち）</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.SUB }}><span style={{ width: 16, height: 3, borderRadius: 2, background: c.ACCENT }} />ぽいロボ流</span>
          </div>
          <div style={{ marginTop: 8, fontSize: isMobile ? 9 : 10, color: c.DIM, fontFamily: mono, letterSpacing: '0.04em' }}>※ 過去の日経平均をもとにした動きのイメージ図です</div>
        </div>

        {/* 比較2行 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: 12, border: `1px solid ${c.RULE}`, background: c.TAGBG }}>
            <span style={{ width: 16, height: 3, borderRadius: 2, background: c.DIM, marginTop: 7, flexShrink: 0 }} />
            <span style={{ fontSize: isMobile ? 11.5 : 13, color: c.SUB, lineHeight: 1.7 }}><b style={{ color: c.TEXT }}>長期投資</b>：暴落をまるごと（2008年 −60%／最悪 −80%・高値回復に約34年）。相場まかせで下げに無力。</span>
          </div>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: 12, border: `1.5px solid ${c.ACCENT}`, background: c.L ? 'rgba(3,105,161,0.06)' : 'rgba(0,229,255,0.06)' }}>
            <span style={{ width: 16, height: 3, borderRadius: 2, background: c.ACCENT, marginTop: 7, flexShrink: 0 }} />
            <span style={{ fontSize: isMobile ? 11.5 : 13, color: c.SUB, lineHeight: 1.7 }}><b style={{ color: c.ACCENT }}>ぽいロボ流</b>：谷を <b style={{ color: c.TEXT }}>−38%</b> に抑え、下げ続けるトレンドでは<b style={{ color: c.TEXT }}>降りる</b>。だから生き残れる。</span>
          </div>
        </div>

        <div style={{ marginTop: 18, padding: isMobile ? '14px 16px' : '16px 20px', borderRadius: 12, background: c.TAGBG, border: `1px solid ${c.TAGBDR}`, borderLeft: `3px solid ${c.ACCENT}`, fontSize: isMobile ? 11 : 12.5, color: c.SUB, lineHeight: 1.8 }}>
          長期投資は“上げ相場専用”で、暴落と長い低迷をそのまま受けます。<b style={{ color: c.TEXT }}>ぽいロボ流は谷を浅く抑えて「生き残りながら続ける」</b>。年+10%を目標にするのは、欲張らず最後まで走り切るためです。
        </div>
      </>
    )) },

    // ════ スライド3：勝てる4つの理由 ════
    { id: 's3', node: slide('勝てる4つの理由', '使う作戦・ADOPTED', (
      <>
      <div style={{ fontSize: isMobile ? 12 : 13.5, color: c.SUB, lineHeight: 1.85, marginBottom: isMobile ? 16 : 20 }}>
        使うと決めた4つの作戦です。各カードの<b style={{ color: c.TEXT }}>「▸ くわしい数字でみる」</b>を開くと、<b style={{ color: c.TEXT }}>過去20年のバックテスト（検証）</b>での合図・勝率・1回の見込み・最大の下げが見られます。
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 12 : 16 }}>
        {ADOPTED.map(e => (
          <div key={e.name} style={{ padding: isMobile ? '16px 16px' : '22px 22px', borderRadius: 14, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flexShrink: 0, fontSize: isMobile ? 13 : 14, fontWeight: 800, color: c.L ? '#fff' : '#04101a', background: c.ACCENT, borderRadius: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{e.grade}</span>
              <span style={{ fontWeight: 800, fontSize: isMobile ? 13.5 : 15, color: c.ACCENT }}>{e.name}</span>
            </div>
            <div style={{ fontSize: isMobile ? 10.5 : 11.5, color: c.SUB, fontWeight: 700, marginTop: -4 }}>{e.gradeLabel}</div>
            <div style={{ fontSize: isMobile ? 12 : 13, color: c.TEXT, lineHeight: 1.7 }}>{e.plain}</div>
            <details>
              <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: isMobile ? 10 : 11, color: c.DIM, fontFamily: mono, userSelect: 'none', paddingTop: 2 }}>
                ▸ くわしい数字でみる
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${c.RULE}`, paddingTop: 12, marginTop: 8 }}>
                {kv('狙い', e.aim)}
                {kv('合図', e.trigger)}
                {kv('持つ期間', e.hold)}
                {kv('1回の見込み', e.ev, c.WIN)}
                {kv('最大の負け', e.dd, c.LOSS)}
              </div>
            </details>
          </div>
        ))}
      </div>
      </>
    )) },

    // ════ 応用：資産を二重に働かせる（A＋B）════
    { id: 'advanced', node: slide('応用：資産を二重に働かせる', '長期投資を超える・ADVANCED', (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 13 : 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10, fontSize: isMobile ? 12.5 : 14, color: c.SUB, lineHeight: 1.9 }}>
          <p style={{ margin: 0 }}>長期投資（現物を持つ）でも、配当・優待・値上がりはもらえます。でも資産は<b style={{ color: c.TEXT }}>“それだけ”</b>。</p>
          <p style={{ margin: 0 }}>ぽいロボ流は、その<b style={{ color: c.TEXT }}>現物を「担保」にして、同じ資産でトレード（スイング）も重ねます</b>。</p>
        </div>

        {/* A：土台 */}
        <div style={{ padding: isMobile ? '14px 16px' : '18px 20px', borderRadius: 14, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 }}>
            <span style={{ fontWeight: 800, fontSize: isMobile ? 13 : 15, color: c.TEXT }}>A. 現物を長期保有（土台）</span>
            <span style={{ flexShrink: 0, fontSize: isMobile ? 12 : 13.5, fontWeight: 800, color: c.WIN, fontFamily: mono }}>年 約+10%</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 9 }}>
            {['高配当', '株主優待', 'キャピタルゲイン'].map(x => (
              <span key={x} style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: c.ACCENT, border: `1px solid ${c.TAGBDR}`, background: c.L ? 'rgba(3,105,161,0.06)' : 'rgba(0,229,255,0.06)', borderRadius: 999, padding: '4px 12px' }}>{x}</span>
            ))}
          </div>
          <div style={{ fontSize: isMobile ? 11 : 12, color: c.SUB }}>持っているだけでもらえる（＝ふつうの長期投資）</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: c.ACCENT, fontSize: 22, fontWeight: 800, fontFamily: mono, lineHeight: 1 }}>＋</div>

        {/* B：応用 */}
        <div style={{ padding: isMobile ? '14px 16px' : '18px 20px', borderRadius: 14, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
            <span style={{ fontWeight: 800, fontSize: isMobile ? 13 : 15, color: c.TEXT }}>B. 株式担保信用でスイング</span>
            <span style={{ flexShrink: 0, fontSize: isMobile ? 12 : 13.5, fontWeight: 800, color: c.WIN, fontFamily: mono }}>年 約+10%</span>
          </div>
          <div style={{ fontSize: isMobile ? 12 : 13, color: c.SUB, lineHeight: 1.7 }}>その現物を<b style={{ color: c.TEXT }}>担保</b>に、ぽいロボ戦略を<b style={{ color: c.TEXT }}>信用で回す</b>。同じ資産でトレードも働かせます。</div>
        </div>

        {/* ＝ 結論（式のイメージ） */}
        <div style={{ padding: isMobile ? '16px 16px' : '20px 22px', borderRadius: 14, border: `1.5px solid ${c.ACCENT}`, background: c.L ? 'rgba(3,105,161,0.06)' : 'rgba(0,229,255,0.06)', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', gap: isMobile ? 6 : 9, fontWeight: 800 }}>
            <span style={{ fontSize: isMobile ? 16 : 20, color: c.TEXT }}>約+10%</span>
            <span style={{ fontSize: isMobile ? 10 : 12, color: c.DIM, fontFamily: mono }}>(A)</span>
            <span style={{ fontSize: isMobile ? 16 : 20, color: c.ACCENT }}>＋</span>
            <span style={{ fontSize: isMobile ? 16 : 20, color: c.TEXT }}>約+10%</span>
            <span style={{ fontSize: isMobile ? 10 : 12, color: c.DIM, fontFamily: mono }}>(B)</span>
            <span style={{ fontSize: isMobile ? 16 : 20, color: c.ACCENT }}>＝</span>
            <span style={{ fontSize: isMobile ? 23 : 30, color: c.WIN, letterSpacing: '0.01em' }}>年利 約20%</span>
          </div>
          <span style={{ display: 'block', marginTop: 10, fontSize: isMobile ? 11 : 12.5, color: c.SUB }}>同じ資産から A も B も受け取る。長期投資（A だけ）より<b style={{ color: c.TEXT }}>上</b>を狙えます。<span style={{ color: c.DIM }}>※ あくまで例（イメージ）</span></span>
        </div>

      </div>
    )) },

    // ════ 安全に回すコツ ════
    { id: 'tips', node: slide('安全に回すコツ', '無理なく続けるために・SAFETY', (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
        <div style={{ fontSize: isMobile ? 12.5 : 14, color: c.SUB, lineHeight: 1.85 }}>担保信用を“応用”で使うとき、退場せず続けるための<b style={{ color: c.TEXT }}>3つの約束</b>です。</div>
        {([
          ['ベアを保険に', '暴落ではロングの損をベアで相殺し、追証・退場を回避する'],
          ['株式担保信用は短期スイング限定', '2倍ETFは長期保有しない（持ちっぱなしは減価でじわじわ目減り）'],
          ['担保は常に余裕', 'フルレバはかけない。優待・高配当の現物は担保にしすぎない（土台を守る）'],
        ] as const).map(([h, d]) => (
          <div key={h} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: isMobile ? '14px 16px' : '18px 20px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG }}>
            <span style={{ flexShrink: 0, width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: '50%', background: c.ACCENT, color: c.L ? '#fff' : '#04101a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: isMobile ? 14 : 16, boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}55` }}>✓</span>
            <span style={{ paddingTop: 2 }}>
              <b style={{ fontSize: isMobile ? 13.5 : 15 }}>{h}</b>
              <span style={{ display: 'block', marginTop: 5, fontSize: isMobile ? 11.5 : 13, color: c.SUB, lineHeight: 1.6 }}>{d}</span>
            </span>
          </div>
        ))}
      </div>
    )) },

    // ════ 注意書き ════
    { id: 'note', node: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>
        <div style={{ padding: isMobile ? '16px 18px' : '22px 26px', borderRadius: 16, border: `1px solid ${c.RULE}`, background: c.CARD, fontSize: isMobile ? 11 : 12.5, color: c.SUB, lineHeight: 1.95 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: c.TEXT, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠</span>最後に大事なこと
          </div>
          これは過去20年のデータで「ルール通りに売買したらこうなった」という結果です。<b style={{ color: c.TEXT }}>未来を約束するものではありません</b>。季節性は年1回なので、試せた回数（20回ぶん）も少なめです。<br /><br />
          基本は<b style={{ color: c.TEXT }}>「チャンス（+の見込み）が来たときだけ、無理のない金額で買う」</b>。毎回むやみに売り買いしたり、根拠がないのに張ると、かえって減りやすくなります。
        </div>

        <div style={{ padding: isMobile ? '16px 18px' : '22px 26px', borderRadius: 16, border: `1px solid ${c.RULE}`, borderLeft: `3px solid ${c.ACCENT}`, background: c.CARD, fontSize: isMobile ? 11 : 12.5, color: c.SUB, lineHeight: 1.95 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: c.TEXT, marginBottom: 12 }}>リスクと安定性</div>
          担保信用は暴落時に<b style={{ color: c.TEXT }}>追証・強制決済</b>の危険があります。ただし対象は<b style={{ color: c.TEXT }}>1倍/2倍のETF（指数連動）</b>で、個別株のような<b style={{ color: c.TEXT }}>倒産リスクはありません</b>。谷を浅く抑えるルールと合わせれば、比較的安定して回せます。<b style={{ color: c.TEXT }}>無理なレバはかけないこと。</b>
        </div>
      </div>
    ) },
  ]

  const total = slides.length
  const [idx, setIdx] = useState(0)
  const touchY = useRef<number | null>(null)

  const go = useCallback((n: number) => setIdx(Math.max(0, Math.min(total - 1, n))), [total])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [idx, go, onClose])

  const chevron = (down: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: down ? 'none' : 'rotate(180deg)' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )

  const pageStyle: React.CSSProperties = {
    height: `${100 / total}%`, overflowY: 'auto', display: 'flex', flexDirection: 'column',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column',
      background: c.BG, backgroundImage: c.SCAN,
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        flexShrink: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10,
        padding: isMobile ? '11px 16px' : '12px 28px',
        background: c.HDRBG, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${c.RULE}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 7px ${c.ACCENT}`, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: c.DIM, fontFamily: mono, whiteSpace: 'nowrap' }}>
          ぽいロボ ▸ 戦略プレイブック
        </span>
        <span style={{ fontSize: 9, color: c.SUB, fontFamily: mono, flexShrink: 0, letterSpacing: '0.06em' }}>{idx + 1} / {total}</span>
        <button onClick={onClose} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
          border: c.L ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
          background: c.L ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
          color: c.L ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)', flexShrink: 0,
        }} aria-label="閉じる">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── 進捗バー ── */}
      <div style={{ flexShrink: 0, height: 2, background: c.RULE }}>
        <div style={{ height: '100%', width: `${((idx + 1) / total) * 100}%`, background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}`, transition: 'width .52s cubic-bezier(.22,1,.36,1)' }} />
      </div>

      {/* ── ステージ（1枚ずつ縦スライド）── */}
      <div
        style={{ position: 'relative', flex: 1, overflow: 'hidden', zIndex: 1, minHeight: 0 }}
        onTouchStart={e => { touchY.current = e.touches[0].clientY }}
        onTouchEnd={e => {
          if (touchY.current == null) return
          const d = touchY.current - e.changedTouches[0].clientY
          if (Math.abs(d) > 50) go(idx + (d > 0 ? 1 : -1))
          touchY.current = null
        }}
      >
        {/* 大きな番号（ダイナミックな背景） */}
        <div style={{ position: 'absolute', top: isMobile ? 4 : 10, right: isMobile ? 10 : 26, fontSize: isMobile ? 96 : 168, fontWeight: 800, fontFamily: mono, lineHeight: 1, color: c.ACCENT, opacity: c.L ? 0.05 : 0.06, pointerEvents: 'none', userSelect: 'none', zIndex: 0, transition: 'opacity .3s' }}>
          {String(idx + 1).padStart(2, '0')}
        </div>

        {/* スライドトラック */}
        <div style={{ position: 'relative', zIndex: 1, height: `${total * 100}%`, transform: `translateY(-${idx * (100 / total)}%)`, transition: 'transform .52s cubic-bezier(.22,1,.36,1)' }}>
          {slides.map(s => (
            <div key={s.id} style={pageStyle}>
              <div style={{ width: '100%', maxWidth: 1040, margin: 'auto', padding: isMobile ? '26px 18px' : '44px 52px' }}>
                {s.node}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── コントロール（前 / ドット / 次）── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 16 : 22, padding: isMobile ? '10px 12px 14px' : '14px 0 18px', zIndex: 6 }}>
        <button
          onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="前のスライド"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            border: `1px solid ${c.TAGBDR}`, background: 'transparent',
            color: c.DIM, cursor: idx === 0 ? 'default' : 'pointer',
            opacity: idx === 0 ? 0.3 : 1, transition: 'opacity .2s',
          }}
        >{chevron(false)}</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {slides.map((s, i) => (
            <button
              key={s.id} onClick={() => go(i)} aria-label={`${i + 1}枚目へ`}
              style={{
                width: i === idx ? 24 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0,
                background: i === idx ? c.ACCENT : c.TAGBDR, cursor: 'pointer',
                boxShadow: i === idx && !c.L ? `0 0 8px ${c.ACCENT}` : 'none',
                transition: 'all .4s cubic-bezier(.22,1,.36,1)',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => go(idx + 1)} disabled={idx === total - 1} aria-label="次のスライド"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
            border: 'none', background: c.ACCENT, color: c.L ? '#fff' : '#04101a',
            cursor: idx === total - 1 ? 'default' : 'pointer',
            opacity: idx === total - 1 ? 0.3 : 1,
            boxShadow: c.L ? '0 2px 10px rgba(3,105,161,0.35)' : `0 0 16px ${c.ACCENT}66`,
            transition: 'opacity .2s, box-shadow .2s',
          }}
        >{chevron(true)}</button>
      </div>
    </div>
  )
}
