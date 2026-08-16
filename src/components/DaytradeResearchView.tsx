// 地下室 ＞ デイトレード（2026-08-13 計測 ／ 2026-08-16 結論ベースに作り直し）
//
// 🔴 このページは「デイトレのやり方」ではなく**測った結果の記録**。
//    ぽいロボの思想＝まず研究する。効かなかったことも、効かなかったと書いて残す。
// 🔴 **結論が先・数字が主役・説明の地の文は書かない**（2026-08-16 ユーザー指示）。
//    数字を足すときも配列に1行足すだけにして、解説を書かないこと。
// 🔵 数字はすべて `scripts/analyze-intraday-bias.mjs` の実行結果。
//    条件を変えて測り直したら、ここも書き換える（測っていないことは書かない）。

import { basementColors, BASEMENT_MONO, basementVeil, type BasementRoomKey } from './basementTheme'
import {
  BasementKeyframes, BasementBackdrop, BasementHead, VerdictHero, BigStat, StatGrid, JudgeList,
  BasementRoomSwitch, BasementNextRoom,
  type JudgeRow,
} from './basementKit'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
  /** 地下室の別の部屋へ移る（🔵 地下室はひと続きなので、DATA に戻らず行き来できる） */
  onSwitchRoom?: (key: BasementRoomKey) => void
}

/** 測った条件と、その判定。🔵 strength は t 値の目安（2で満タン） */
const FINDINGS: JudgeRow[] = [
  { verdict: 'trap', label: '寄りギャップの順張り（日経平均で計測）', value: 'n=1,446　+0.257%　勝率57.3%　t=8.12', strength: 1 },
  { verdict: 'no', label: '同じ条件を 1321（実物ETF）で計測', value: 'n=1,179　−0.010%　勝率47.7%　t=−0.35', strength: 0.18 },
  { verdict: 'no', label: '上位足が上の日に買う', value: 'n=2,352　+0.010%　勝率49.0%　t=0.57', strength: 0.29 },
  { verdict: 'no', label: '25日線の上／下で分ける', value: 'n=1,693 / 1,101　t<1', strength: 0.4 },
  { verdict: 'no', label: '前日が大きく動いた翌日', value: 'n=1,044 / 918　t<1', strength: 0.4 },
  { verdict: 'no', label: '寄り1時間の動き → その後（1時間足3年）', value: 'n=728　+0.007%　t=0.25', strength: 0.13 },
]

/** 1日の「型」の内訳（20年）。🔴 終わってから分かる分類＝予測ではない */
const DAY_TYPES = [
  { name: 'もみ合い（寄り＝引け付近）', share: 23.2, mean: '±0.00%' },
  { name: '寄り底（寄って上げる）', share: 22.8, mean: '+1.15%' },
  { name: '寄り天（寄って下げる）', share: 20.7, mean: '−1.22%' },
  { name: '一本調子の上げ（高値引け）', share: 7.0, mean: '+0.58%' },
  { name: '一本調子の下げ（安値引け）', share: 5.7, mean: '−0.59%' },
]

/** そのほかの実測（説明はしない。数字だけ置く） */
const NUMBERS = [
  { name: 'オーバーナイト ／ 日中（26年・1倍）', value: '+11.07% ／ −4.90%' },
  { name: '大きく上に窓を開けた日の寄り天率', value: '20.7% → 8.1%（1321では取り分にならず）' },
  { name: '5分足の保存（60日しか遡れないため）', value: '2026-08-13 から毎日・平日16:30' },
]

export default function DaytradeResearchView({ theme, isMobile, onClose, onSwitchRoom }: Props) {
  const c = basementColors(theme)
  const pad = isMobile ? 14 : 24
  const mono = BASEMENT_MONO

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.bg, color: c.text, position: 'relative' }}>
      <BasementKeyframes />
      <BasementBackdrop c={c} />

      <div style={{ position: 'sticky', top: 0, zIndex: 3, ...basementVeil(c.dark), borderBottom: `1px solid ${c.border}`, padding: `${pad / 2}px ${pad}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono, fontSize: isMobile ? 10 : 11, letterSpacing: '0.14em', color: c.accent }}>
          <span aria-hidden className="bsmt-glow" style={{
            width: 8, height: 8, borderRadius: '50%', background: '#ffd79a',
            boxShadow: '0 0 8px 3px rgba(255,205,130,0.5)', display: 'inline-block',
          }} />
          地下室{!isMobile && ' / デイトレード'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onSwitchRoom && <BasementRoomSwitch c={c} isMobile={isMobile} current="daytrade" onSwitch={onSwitchRoom} />}
          <button type="button" onClick={onClose} aria-label="閉じる"
            style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${c.border}`, background: 'transparent', color: c.text, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', padding: pad, position: 'relative' }}>
        <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, margin: '4px 0 4px' }}>デイトレは成立するか</h1>
        <div style={{ fontFamily: mono, fontSize: 11, color: c.sub, marginBottom: 14 }}>
          2026-08-13 計測 ／ 日経225・1321 の20年＋1時間足3年
        </div>

        <VerdictHero
          c={c} isMobile={isMobile} mark="×" tone="no"
          verdict="日計りの根拠は、見つからなかった。"
          note="検証6本 → 採用0本　／　唯一効いた1本は約定できない価格での幻"
        />

        <StatGrid isMobile={isMobile} cols={3}>
          <BigStat c={c} isMobile={isMobile} value={0.257} decimals={3} prefix="+" suffix="%" tone="trap"
            label="日経平均で測った寄りギャップ順張り（t=8.12）" />
          <BigStat c={c} isMobile={isMobile} value={-0.010} decimals={3} suffix="%" tone="no" delay={90}
            label="同じ条件を 1321（実物）で測ると消える" />
          <BigStat c={c} isMobile={isMobile} value={47.7} decimals={1} suffix="%" tone="no" delay={180}
            label="1321 寄り→引けの勝率（20年・平均 −0.001%）" />
        </StatGrid>

        <BasementHead c={c} isMobile={isMobile}>判定</BasementHead>
        <JudgeList c={c} isMobile={isMobile} rows={FINDINGS} />
        <div style={{ fontFamily: mono, fontSize: 11, color: c.sub, marginTop: 8 }}>t&lt;2 は誤差として不採用</div>

        <BasementHead c={c} isMobile={isMobile}>1日の型（20年）</BasementHead>
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', background: c.card, backdropFilter: 'blur(8px)' }}>
          {DAY_TYPES.map((d, i) => (
            <div key={d.name} style={{
              position: 'relative', padding: '11px 14px',
              background: i % 2 ? 'transparent' : (c.dark ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.022)'),
              borderTop: i ? `1px solid ${c.border}` : 'none',
              display: 'flex', justifyContent: 'space-between', gap: 12,
              fontSize: isMobile ? 12 : 13,
            }}>
              {/* 🔵 出現率を地に敷く（数字を読まなくても比が見える）*/}
              <div aria-hidden style={{
                position: 'absolute', inset: 0, width: `${d.share * 3}%`,
                background: c.accent, opacity: c.dark ? 0.075 : 0.09,
              }} />
              <span style={{ position: 'relative' }}>{d.name}</span>
              <span style={{ position: 'relative', fontFamily: mono, fontSize: 11, color: c.sub, whiteSpace: 'nowrap' }}>
                {d.share.toFixed(1)}%{'　'}寄→引 {d.mean}
              </span>
            </div>
          ))}
        </div>

        <BasementHead c={c} isMobile={isMobile}>そのほかの実測</BasementHead>
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', background: c.card, backdropFilter: 'blur(8px)' }}>
          {NUMBERS.map((d, i) => (
            <div key={d.name} style={{
              display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between',
              gap: isMobile ? 2 : 12, padding: '10px 14px',
              background: i % 2 ? 'transparent' : (c.dark ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.022)'),
              borderTop: i ? `1px solid ${c.border}` : 'none', fontSize: isMobile ? 12 : 13,
            }}>
              <span>{d.name}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: c.sub }}>{d.value}</span>
            </div>
          ))}
        </div>

        {onSwitchRoom && <BasementNextRoom c={c} isMobile={isMobile} current="daytrade" onSwitch={onSwitchRoom} />}

        <div style={{ marginTop: 24, padding: pad, border: `1px dashed ${c.border}`, borderRadius: 10, fontSize: isMobile ? 11 : 12, lineHeight: 1.9, color: c.sub }}>
          🔴 このページは研究の記録であり、売買の推奨ではありません。数値は特定期間の過去データにもとづくもので、将来の成果を示すものではありません。
        </div>
      </div>
    </div>
  )
}
