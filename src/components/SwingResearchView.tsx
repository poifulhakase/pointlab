// 地下室 ＞ スイングトレード（2026-08-13 時点 ／ 2026-08-16 結論ベースに作り直し）
//
// 🔴 ぽいロボ本体が扱っているのがこの時間軸。デイトレードと違い、**材料も検証も既にある**。
// 🔴 **結論が先・数字が主役・説明の地の文は書かない**（2026-08-16 ユーザー指示）。
//    数字を足すときも配列に1行足すだけにして、解説を書かないこと。
// 🔵 数字の出どころ＝`scripts/backtest-robo.mjs`（対照群）／`scripts/backtest-tev.mjs`（需給シグナル）／
//    20年R&D（`analyze-*.mjs`）。測り直したらここも書き換える。

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

/** 分かっていること（数字が出ているもの） */
const KNOWN: JudgeRow[] = [
  { verdict: 'ok', label: '対照群（決定論ルール）／ETF実データ・約11年', value: '72トレード　勝率46%　CAGR 13.09%　DD −46.15%', strength: 1 },
  { verdict: 'ok', label: 'リターンが出る時間帯', value: 'オーバーナイト +11.07% ／ 日中 −4.90%', strength: 0.9 },
  { verdict: 'ok', label: '引成で建てる（vs 翌朝の寄り）', value: 'CAGR +8.00% → +10.33%', strength: 0.7 },
  { verdict: 'ok', label: '確信度の較正', value: '相関 +0.35／52%以下は出さない', strength: 0.5 },
  { verdict: 'trap', label: '需給シグナル（TEV）52週・五分五分ゲート後', value: 'シグナル24週　勝率63%（in-sample）', strength: 0.6 },
  { verdict: 'trap', label: 'レバレッジと成績', value: 'CAGR15〜20% と DD−40% は両立しない', strength: 0.6 },
]

/** まだ分かっていないこと（＝判定できていないもの） */
const UNKNOWN: JudgeRow[] = [
  { verdict: 'trap', label: 'AIの判断が対照群を上回るか', value: '実トレード2 / 30件（約7ヶ月先）', strength: 0.07 },
  { verdict: 'trap', label: '確信度63%が実運用でも出るか', value: 'in-sample' },
  { verdict: 'trap', label: 'チャート画像が判断に効いているか', value: '未検証' },
  { verdict: 'trap', label: '運用者の保有を読ませる意味があるか', value: '2026-08-13 から' },
]

export default function SwingResearchView({ theme, isMobile, onClose, onSwitchRoom }: Props) {
  const c = basementColors(theme)
  const pad = isMobile ? 14 : 24
  const mono = BASEMENT_MONO

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.bg, color: c.text, position: 'relative' }}>
      <BasementKeyframes />
      <BasementBackdrop c={c} />

      <div style={{ position: 'sticky', top: 0, zIndex: 3, ...basementVeil(c.dark), borderBottom: `1px solid ${c.border}`, padding: `${pad / 2}px ${pad}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono, fontSize: isMobile ? 10 : 11, letterSpacing: '0.14em', color: c.accent }}>
          <span aria-hidden className="bsmt-glow" style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffd79a', boxShadow: '0 0 8px 3px rgba(255,205,130,0.5)', display: 'inline-block' }} />
          地下室{!isMobile && ' / スイングトレード'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onSwitchRoom && <BasementRoomSwitch c={c} isMobile={isMobile} current="swing" onSwitch={onSwitchRoom} />}
          <button type="button" onClick={onClose} aria-label="閉じる"
            style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${c.border}`, background: 'transparent', color: c.text, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', padding: pad, position: 'relative' }}>
        <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, margin: '4px 0 4px' }}>スイングは成立するか</h1>
        <div style={{ fontFamily: mono, fontSize: 11, color: c.sub, marginBottom: 14 }}>
          2026-08-13 時点 ／ 対照群は約11年・需給シグナルは52週
        </div>

        <VerdictHero
          c={c} isMobile={isMobile} mark="○" tone="ok"
          verdict="ルールとしては成立している。AIが上回るかは未判定。"
          note="対照群 CAGR 13.09%（11年）　／　AI優位の判定は 2 / 30 件"
        />

        <StatGrid isMobile={isMobile} cols={3}>
          <BigStat c={c} isMobile={isMobile} value={13.09} decimals={2} suffix="%" tone="ok"
            label="対照群の CAGR（ETF実データ・約11年）" />
          <BigStat c={c} isMobile={isMobile} value={-46.15} decimals={2} suffix="%" tone="trap" delay={90}
            label="最大ドローダウン（100万円 → 一時54万円）" />
          <BigStat c={c} isMobile={isMobile} value={2} decimals={0} suffix=" / 30" tone="no" delay={180}
            label="Go/No-Go までの実トレード（約7ヶ月先）" />
        </StatGrid>

        <BasementHead c={c} isMobile={isMobile}>分かっていること</BasementHead>
        <JudgeList c={c} isMobile={isMobile} rows={KNOWN} />

        <BasementHead c={c} isMobile={isMobile}>まだ分かっていないこと</BasementHead>
        <JudgeList c={c} isMobile={isMobile} rows={UNKNOWN} />

        <div style={{
          marginTop: 20, padding: isMobile ? '16px 14px' : '20px 18px',
          border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.accent}`,
          borderRadius: 12, background: c.card,
          fontSize: isMobile ? 14 : 17, fontWeight: 800, color: c.accent, letterSpacing: '0.01em',
        }}>
          30トレード貯まるまで、設計は動かさない。
        </div>

        {onSwitchRoom && <BasementNextRoom c={c} isMobile={isMobile} current="swing" onSwitch={onSwitchRoom} />}

        <div style={{ marginTop: 24, padding: pad, border: `1px dashed ${c.border}`, borderRadius: 10, fontSize: isMobile ? 11 : 12, lineHeight: 1.9, color: c.sub }}>
          🔴 このページは研究の記録であり、売買の推奨ではありません。数値は特定期間の過去データにもとづくもので、将来の成果を示すものではありません。
        </div>
      </div>
    </div>
  )
}
