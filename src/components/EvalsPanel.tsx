import { useState } from 'react'
import { AI_PROMPT_TEMPLATE } from '../utils/enginePrompt'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

type ScoreItem = { label: string; pass: boolean }
type ScoreResult = { items: ScoreItem[]; total: number; passed: number }

const mono = "'Courier New', Courier, monospace" as const

function makeC(theme: 'dark' | 'light') {
  const L = theme === 'light'
  return {
    L,
    BG:     L ? 'rgba(240,248,255,0.72)' : 'rgba(4,10,22,0.55)',
    HDRBG:  L ? 'rgba(248,252,255,0.90)' : 'rgba(4,10,22,0.80)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.42)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.18)'   : 'rgba(0,229,255,0.18)',
    CARD:   L ? 'rgba(255,255,255,0.72)' : 'rgba(0,20,50,0.55)',
    WIN:    L ? '#15803d'                : '#4ade80',
    LOSS:   L ? '#dc2626'                : '#f87171',
    WARN:   L ? '#d97706'                : '#fbbf24',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
  }
}

// ── シナリオデータ ──────────────────────────────────────────────────────────

const SCENARIO_1_JSON = {
  analysis_date: "2026-01-15",
  tev_analysis: {
    tev: 42.3,
    tev_for_execution: 42.3,
    status: "慣性航行中",
    confidence_pct: 72,
    confidence_pct_is_fixed: false,
    decay_factor: 0.91,
    decay_reasons: ["信用買い残が中程度の水準"],
    sanity_warnings: [],
    sanity_ok: true,
  },
  deviation_score: { score: 1.8, acc: 0.4 },
  positioning: {
    credit_margin: {
      long_bal_t: 3.2,
      eval_ratio_pct: -3.8,
      ratio_percentile_26w: 52,
      dead_mass_risk: { phase: "低リスク", score: 25 },
    },
    arbitrage: { long_bal_t: 1.6, percentile_26w: 45 },
  },
  price_structure: {
    nikkei225: { ma20_dev_pct: 2.1, ma60_dev_pct: 3.5, high_20d: 39500, low_20d: 37200 },
  },
  flows: {
    cot: { leveraged_funds: { net: 22000 } },
    foreign: { cumulative_trillion: { w4: 1.4 }, percentile_4w_vs26w: 74 },
  },
  internal_structure: null,
  events: {
    sq: {
      days_remaining: 20,
      gravity: { pressure_phase: "積み上げ優勢" },
      credit_ratio: { phase: "中立" },
      credit_long_t: { phase: "蓄積中" },
      week_deltas: [0.08, 0.12, 0.05],
    },
    upcoming: [],
  },
  weekly_history: [
    { date: "2026-01-10", credit_data_as_of: "2026-01-08", foreign_net_t: 0.35, credit_ratio: 2.5, cot_lf_net: 22000, ad_25d: 108 },
    { date: "2026-01-03", credit_data_as_of: "2026-01-01", foreign_net_t: 0.28, credit_ratio: 2.4, cot_lf_net: 19000, ad_25d: 103 },
  ],
}

const SCENARIO_2_JSON = {
  analysis_date: "2026-02-10",
  tev_analysis: {
    tev: -61.4,
    tev_for_execution: -61.4,
    status: "真空落下",
    confidence_pct: 78,
    confidence_pct_is_fixed: false,
    decay_factor: 1.0,
    decay_reasons: [],
    sanity_warnings: [],
    sanity_ok: true,
  },
  deviation_score: { score: -2.6, acc: -0.9 },
  positioning: {
    credit_margin: {
      long_bal_t: 4.1,
      eval_ratio_pct: -14.2,
      ratio_percentile_26w: 88,
      dead_mass_risk: { phase: "高危険", score: 78 },
    },
    arbitrage: { long_bal_t: 2.3, percentile_26w: 82 },
  },
  price_structure: {
    nikkei225: { ma20_dev_pct: -4.8, ma60_dev_pct: -6.2, high_20d: 40200, low_20d: 36800 },
  },
  flows: {
    cot: { leveraged_funds: { net: -35000 } },
    foreign: { cumulative_trillion: { w4: -2.1 }, percentile_4w_vs26w: 12 },
  },
  internal_structure: null,
  events: {
    sq: {
      days_remaining: 6,
      gravity: { pressure_phase: "清算優勢" },
      credit_ratio: { phase: "高危険" },
      credit_long_t: { phase: "清算圧力大" },
      week_deltas: [-0.25, -0.18, -0.31],
    },
    upcoming: [{ event: "FOMC", date: "2026-02-12", days_until: 2 }],
  },
  weekly_history: [
    { date: "2026-02-07", credit_data_as_of: "2026-02-05", foreign_net_t: -0.82, credit_ratio: 0.72, cot_lf_net: -35000, ad_25d: 68 },
    { date: "2026-01-31", credit_data_as_of: "2026-01-29", foreign_net_t: -0.61, credit_ratio: 0.88, cot_lf_net: -28000, ad_25d: 76 },
  ],
}

const SCENARIO_3_JSON = {
  analysis_date: "2026-03-05",
  tev_analysis: {
    tev: null,
    tev_for_execution: null,
    status: "限界膨張",
    confidence_pct: 50,
    confidence_pct_is_fixed: true,
    decay_factor: 1.0,
    decay_reasons: [],
    sanity_warnings: [
      "価格基準日乖離: 先物終値と分析基準日の乖離が5%超",
      "USD/JPY 鮮度注意: ドル円データが48時間以上前の値",
    ],
    sanity_ok: false,
  },
  deviation_score: { score: 0.3, acc: 0.1 },
  positioning: {
    credit_margin: {
      long_bal_t: 3.5,
      eval_ratio_pct: -7.1,
      ratio_percentile_26w: 61,
      dead_mass_risk: { phase: "中程度", score: 48 },
    },
    arbitrage: { long_bal_t: 1.9, percentile_26w: 55 },
  },
  price_structure: {
    nikkei225: { ma20_dev_pct: 0.8, ma60_dev_pct: 1.2, high_20d: 38900, low_20d: 37100 },
  },
  flows: {
    cot: { leveraged_funds: { net: 5000 } },
    foreign: { cumulative_trillion: { w4: 0.1 }, percentile_4w_vs26w: 48 },
  },
  internal_structure: null,
  events: {
    sq: {
      days_remaining: 12,
      gravity: { pressure_phase: "中立" },
      credit_ratio: { phase: "中立" },
      credit_long_t: { phase: "中立" },
      week_deltas: [0.02, -0.05, 0.03],
    },
    upcoming: [],
  },
  weekly_history: [
    { date: "2026-03-01", credit_data_as_of: "2026-02-26", foreign_net_t: 0.04, credit_ratio: 1.9, cot_lf_net: 5000, ad_25d: 98 },
  ],
}

type Scenario = {
  id: number
  name: string
  badge: string
  badgeColor: string
  description: string
  expectedBehavior: string
  json: object
  specificCheck: (output: string) => ScoreItem
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    name: '強気相場',
    badge: '慣性航行中',
    badgeColor: '#4ade80',
    description: 'TEV+42・確信度72%・外国人4週+1.4兆・評価損益-3.8%（健全）。典型的な上昇継続局面。',
    expectedBehavior: 'ブル：打診 or 本命 / ベア：購入禁止',
    json: SCENARIO_1_JSON,
    specificCheck: (output) => {
      const bullSection = output.split('■ ベア')[0] ?? ''
      const bullDecision = bullSection.match(/判定：(.+)/)?.[1] ?? ''
      const pass = /打診|本命|継続保持/.test(bullDecision)
      return { label: 'ブル判定が打診/本命/継続保持になっているか', pass }
    },
  },
  {
    id: 2,
    name: '恐怖相場',
    badge: '真空落下',
    badgeColor: '#f87171',
    description: 'TEV-61・確信度78%・評価損益-14.2%（臨界）・外国人4週-2.1兆・SQ残6日。',
    expectedBehavior: 'ベア：打診 or 本命 / ブル：購入禁止',
    json: SCENARIO_2_JSON,
    specificCheck: (output) => {
      const bearSection = output.split('■ ベア')[1] ?? ''
      const bearDecision = bearSection.match(/判定：(.+)/)?.[1] ?? ''
      const pass = /打診|本命|継続保持/.test(bearDecision)
      return { label: 'ベア判定が打診/本命/継続保持になっているか', pass }
    },
  },
  {
    id: 3,
    name: 'データ品質問題',
    badge: 'tev=null',
    badgeColor: '#fbbf24',
    description: 'TEV計算不能・sanity_warnings 2件（価格乖離・ドル円鮮度）。執行停止局面。',
    expectedBehavior: '執行停止宣言 + 【データメモ】両方出力',
    json: SCENARIO_3_JSON,
    specificCheck: (output) => {
      const hasStop = /需給推進力・執行停止/.test(output)
      const hasMemo = /【データメモ】/.test(output)
      const pass = hasStop && hasMemo
      return { label: '執行停止宣言と【データメモ】が両方出力されているか', pass }
    },
  },
]

// ── 採点ロジック ────────────────────────────────────────────────────────────

const ENGLISH_VAR_PATTERN = /tev_analysis|confidence_pct|tev_for_execution|deviation_score|sanity_warnings|dead_mass_risk|credit_margin|cot_lf_net|foreign_net_t|ad_25d/

function scoreOutput(output: string, scenario: Scenario): ScoreResult {
  const items: ScoreItem[] = [
    {
      label: '確信度が「確信度：〇〇%」の形式で出力されているか',
      pass: /確信度[：:]\s*\d+(\.\d+)?%/.test(output),
    },
    {
      label: 'マークダウン記法（**・###・行頭ハイフン）がないか',
      pass: !/\*\*|^#{1,3} |^- /m.test(output),
    },
    {
      label: '「需給推進力：」が出力されているか',
      pass: /需給推進力[：:]/.test(output),
    },
    {
      label: '「需給ステータス：」が出力されているか',
      pass: /需給ステータス[：:]/.test(output),
    },
    {
      label: '「指令：」が出力されているか',
      pass: /指令[：:]/.test(output),
    },
    {
      label: '「■ ブル」と「■ ベア」の両セクションが含まれるか',
      pass: /■\s*ブル/.test(output) && /■\s*ベア/.test(output),
    },
    {
      label: '英語変数名（tev_analysis等）が出力に含まれていないか',
      pass: !ENGLISH_VAR_PATTERN.test(output),
    },
    {
      label: '「慣性持続性：」が出力されているか（強持続/中持続/枯渇圏）',
      pass: /慣性持続性[：:]/.test(output),
    },
    scenario.specificCheck(output),
  ]

  const passed = items.filter(i => i.pass).length
  return { items, total: items.length, passed }
}

// ── スコアゲージ ────────────────────────────────────────────────────────────

function ScoreGauge({ result, c }: { result: ScoreResult; c: ReturnType<typeof makeC> }) {
  const pct = result.passed / result.total
  const color = pct === 1 ? c.WIN : pct >= 0.625 ? c.WARN : c.LOSS
  const status = pct === 1 ? 'PASS' : pct >= 0.625 ? 'WARN' : 'FAIL'
  const filled = Math.round(pct * 10)
  const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled)

  return (
    <div style={{
      background: color + '14',
      border: `1px solid ${color}55`,
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 'bold', letterSpacing: 3,
          color, fontFamily: mono,
        }}>{status}</span>
        <span style={{ color, fontSize: 20, fontWeight: 'bold', fontFamily: mono, lineHeight: 1 }}>
          {result.passed}
          <span style={{ fontSize: 11, opacity: 0.55 }}>/{result.total}</span>
        </span>
      </div>
      <div style={{ color, fontSize: 12, letterSpacing: 1, fontFamily: mono }}>{bar}</div>
    </div>
  )
}

// ── コンポーネント ──────────────────────────────────────────────────────────

export function EvalsPanel({ theme, isMobile, onClose }: Props) {
  const c = makeC(theme)
  const [outputs, setOutputs] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, ScoreResult>>({})
  const [copied,  setCopied]  = useState<number | null>(null)

  const handleCopy = (scenario: Scenario) => {
    const text = AI_PROMPT_TEMPLATE + JSON.stringify(scenario.json, null, 2)
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
    setCopied(scenario.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleScore = (scenario: Scenario) => {
    const output = outputs[scenario.id] ?? ''
    if (!output.trim()) return
    setResults(prev => ({ ...prev, [scenario.id]: scoreOutput(output, scenario) }))
  }

  const totalPassed   = Object.values(results).reduce((s, r) => s + r.passed, 0)
  const totalChecks   = Object.values(results).reduce((s, r) => s + r.total, 0)
  const scenariosDone = Object.keys(results).length
  const allDone       = scenariosDone === SCENARIOS.length
  const globalPct     = totalChecks > 0 ? totalPassed / totalChecks : null
  const globalColor   = globalPct === null ? c.ACCENT
    : globalPct === 1 ? c.WIN
    : globalPct >= 0.7 ? c.WARN
    : c.LOSS

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column',
      background: c.BG, backdropFilter: 'blur(24px)',
      backgroundImage: c.SCAN,
      fontFamily: mono,
      overflowY: 'auto',
    }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: c.HDRBG,
        borderBottom: `1px solid ${c.RULE}`, flexShrink: 0,
      }}>
        <div>
          <span style={{ color: c.ACCENT, fontSize: 12, letterSpacing: 2 }}>PROMPT EVALS</span>
          <div style={{ color: c.SUB, fontSize: 10, marginTop: 2 }}>
            ① コピー → ② AIへ貼付・生成 → ③ 出力をペースト → ④ 採点
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {allDone && globalPct !== null && (
            <div style={{
              fontSize: 12, fontWeight: 'bold', color: globalColor,
              letterSpacing: 1,
            }}>
              TOTAL {totalPassed}/{totalChecks}
            </div>
          )}
          {!allDone && scenariosDone > 0 && (
            <div style={{ color: c.SUB, fontSize: 11 }}>
              {totalPassed}/{totalChecks}（{scenariosDone}/3）
            </div>
          )}
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${c.RULE}`,
            color: c.SUB, cursor: 'pointer', fontSize: 18, lineHeight: 1,
            width: 32, height: 32, borderRadius: 6, fontFamily: mono,
          }}>×</button>
        </div>
      </div>

      {/* シナリオカード */}
      <div style={{
        padding: 16, display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 16, alignItems: 'flex-start',
        flex: 1,
      }}>
        {SCENARIOS.map(scenario => {
          const result   = results[scenario.id]
          const output   = outputs[scenario.id] ?? ''
          const isCopied = copied === scenario.id

          const pct = result ? result.passed / result.total : null
          const borderColor = pct === null ? c.RULE
            : pct === 1 ? c.WIN + '88'
            : pct >= 0.625 ? c.WARN + '88'
            : c.LOSS + '88'

          return (
            <div key={scenario.id} style={{
              flex: 1, background: c.CARD,
              border: `1px solid ${borderColor}`,
              borderRadius: 10,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              transition: 'border-color 0.3s',
              boxShadow: pct === 1 ? `0 0 16px ${c.WIN}22` : 'none',
            }}>
              {/* カードヘッダー */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${c.RULE}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: c.TEXT, fontWeight: 'bold' }}>
                    S{scenario.id}. {scenario.name}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: scenario.badgeColor + '22',
                    color: scenario.badgeColor, border: `1px solid ${scenario.badgeColor}55`,
                  }}>{scenario.badge}</span>
                </div>
                <div style={{ fontSize: 10, color: c.SUB, lineHeight: 1.6 }}>{scenario.description}</div>
                <div style={{ fontSize: 10, color: c.DIM, marginTop: 4 }}>
                  期待: {scenario.expectedBehavior}
                </div>
              </div>

              {/* コピーボタン */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${c.RULE}` }}>
                <button onClick={() => handleCopy(scenario)} style={{
                  width: '100%', padding: '8px 0',
                  background: isCopied ? c.ACCENT + '22' : 'transparent',
                  border: `1px solid ${isCopied ? c.ACCENT : c.DIM}`,
                  color: isCopied ? c.ACCENT : c.SUB,
                  borderRadius: 6, cursor: 'pointer', fontSize: 11,
                  fontFamily: mono, transition: 'all 0.2s',
                }}>
                  {isCopied ? '▶ コピー完了' : '① プロンプト＋データをコピー'}
                </button>
              </div>

              {/* 出力貼り付けエリア */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${c.RULE}` }}>
                <div style={{ fontSize: 10, color: c.SUB, marginBottom: 6 }}>
                  ③ AIが出力したテキストを貼り付け
                </div>
                <textarea
                  value={output}
                  onChange={e => setOutputs(prev => ({ ...prev, [scenario.id]: e.target.value }))}
                  placeholder={'AIの出力のみをペーストしてください\n（プロンプトやJSONは不要です）'}
                  style={{
                    width: '100%', height: 110, resize: 'vertical',
                    background: c.L ? 'rgba(255,255,255,0.8)' : 'rgba(0,10,30,0.6)',
                    border: `1px solid ${c.RULE}`, borderRadius: 6,
                    color: c.TEXT, fontSize: 10, padding: 8, boxSizing: 'border-box',
                    fontFamily: mono, lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={() => handleScore(scenario)}
                  disabled={!output.trim()}
                  style={{
                    marginTop: 8, width: '100%', padding: '8px 0',
                    background: output.trim() ? c.ACCENT + '18' : 'transparent',
                    border: `1px solid ${output.trim() ? c.ACCENT : c.RULE}`,
                    color: output.trim() ? c.ACCENT : c.SUB,
                    borderRadius: 6, cursor: output.trim() ? 'pointer' : 'default',
                    fontSize: 11, fontFamily: mono,
                    fontWeight: output.trim() ? 'bold' : 'normal',
                    letterSpacing: output.trim() ? 1 : 0,
                  }}
                >
                  ④ 採点する
                </button>
              </div>

              {/* スコア結果 */}
              {result && (
                <div style={{ padding: '10px 14px' }}>
                  <ScoreGauge result={result} c={c} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {result.items.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                        padding: '4px 8px', borderRadius: 5,
                        background: item.pass
                          ? (c.L ? 'rgba(21,128,61,0.06)' : 'rgba(74,222,128,0.06)')
                          : (c.L ? 'rgba(220,38,38,0.06)' : 'rgba(248,113,113,0.06)'),
                      }}>
                        <span style={{
                          fontSize: 11, flexShrink: 0, marginTop: 1,
                          color: item.pass ? c.WIN : c.LOSS,
                          fontWeight: 'bold',
                        }}>
                          {item.pass ? '✓' : '✗'}
                        </span>
                        <span style={{ fontSize: 10, color: item.pass ? c.SUB : c.LOSS, lineHeight: 1.5 }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 全完了バナー */}
      {allDone && globalPct !== null && (
        <div style={{
          margin: '0 16px 16px', padding: '12px 16px',
          background: globalColor + '14',
          border: `1px solid ${globalColor}55`,
          borderRadius: 8, textAlign: 'center',
        }}>
          <div style={{ color: globalColor, fontSize: 13, fontWeight: 'bold', letterSpacing: 2, marginBottom: 4 }}>
            {globalPct === 1 ? '全チェック合格' : globalPct >= 0.7 ? '一部改善が必要' : 'プロンプト修正を推奨'}
          </div>
          <div style={{ color: c.SUB, fontSize: 10 }}>
            合計 {totalPassed}/{totalChecks} 合格（{Math.round(globalPct * 100)}%）
          </div>
        </div>
      )}
    </div>
  )
}
