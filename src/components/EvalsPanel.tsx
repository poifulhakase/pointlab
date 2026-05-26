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
    description: 'TEV+42・確信度72%・外国人4週累計+1.4兆・信用評価損益-3.8%（健全水準）。典型的な上昇トレンド継続局面。',
    expectedBehavior: 'ブル判定：打診 or 本命 / ベア判定：購入禁止',
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
    description: 'TEV-61・確信度78%・信用評価損益-14.2%（臨界水準）・外国人4週-2.1兆・ヘッジファンドネット-35000枚・SQ残6日。',
    expectedBehavior: 'ベア判定：打診 or 本命 / ブル判定：購入禁止',
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
    badge: 'tev_for_execution=null',
    badgeColor: '#fbbf24',
    description: 'TEV計算不能・sanity_warnings 2件（価格乖離・ドル円鮮度）。データ品質起因で執行停止となるべき局面。',
    expectedBehavior: '「需給推進力・執行停止」出力 + 【データメモ】出力',
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
      pass: /確信度：\d+(\.\d+)?%/.test(output),
    },
    {
      label: 'マークダウン記法（**・###・行頭ハイフン）がないか',
      pass: !/\*\*|^#{1,3} |^- /m.test(output),
    },
    {
      label: '「需給推進力：」が出力されているか',
      pass: /需給推進力：/.test(output),
    },
    {
      label: '「需給ステータス：」が出力されているか',
      pass: /需給ステータス：/.test(output),
    },
    {
      label: '「指令：」が出力されているか',
      pass: /指令：/.test(output),
    },
    {
      label: '「■ ブル」と「■ ベア」の両セクションが含まれるか',
      pass: /■ ブル/.test(output) && /■ ベア/.test(output),
    },
    {
      label: '英語変数名（tev_analysis等）が出力に含まれていないか',
      pass: !ENGLISH_VAR_PATTERN.test(output),
    },
    scenario.specificCheck(output),
  ]

  const passed = items.filter(i => i.pass).length
  return { items, total: items.length, passed }
}

// ── コンポーネント ──────────────────────────────────────────────────────────

export function EvalsPanel({ theme, isMobile, onClose }: Props) {
  const c = makeC(theme)
  const [outputs,  setOutputs]  = useState<Record<number, string>>({})
  const [results,  setResults]  = useState<Record<number, ScoreResult>>({})
  const [copied,   setCopied]   = useState<number | null>(null)

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

  const totalPassed  = Object.values(results).reduce((s, r) => s + r.passed, 0)
  const totalChecks  = Object.values(results).reduce((s, r) => s + r.total, 0)
  const scenariosDone = Object.keys(results).length

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
          <div style={{ color: c.TEXT, fontSize: 11, marginTop: 2 }}>プロンプト品質テスト — 3シナリオ</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {scenariosDone > 0 && (
            <div style={{ color: totalPassed === totalChecks ? c.WIN : c.ACCENT, fontSize: 13 }}>
              {totalPassed}/{totalChecks} 合格（{scenariosDone}/3 実施）
            </div>
          )}
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${c.RULE}`,
            color: c.SUB, cursor: 'pointer', fontSize: 18, lineHeight: 1,
            width: 32, height: 32, borderRadius: 6,
          }}>×</button>
        </div>
      </div>

      {/* 説明 */}
      <div style={{ padding: '10px 16px 0', color: c.SUB, fontSize: 11, flexShrink: 0 }}>
        各シナリオのデータをAIに渡し、出力を貼り付けて採点します。
        プロンプトの出力品質（フォーマット・ロジック）を測定するものであり、相場予測の精度とは別です。
      </div>

      {/* シナリオカード */}
      <div style={{
        padding: 16, display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 16, alignItems: 'flex-start',
      }}>
        {SCENARIOS.map(scenario => {
          const result = results[scenario.id]
          const output = outputs[scenario.id] ?? ''
          const isCopied = copied === scenario.id

          return (
            <div key={scenario.id} style={{
              flex: 1, background: c.CARD,
              border: `1px solid ${c.RULE}`, borderRadius: 10,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
                  {isCopied ? '▶ コピー完了' : 'プロンプト＋シナリオデータをコピー'}
                </button>
              </div>

              {/* 出力貼り付けエリア */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${c.RULE}` }}>
                <div style={{ fontSize: 10, color: c.SUB, marginBottom: 6 }}>AIの出力を貼り付け</div>
                <textarea
                  value={output}
                  onChange={e => setOutputs(prev => ({ ...prev, [scenario.id]: e.target.value }))}
                  placeholder="ここにAIの出力をペーストしてください..."
                  style={{
                    width: '100%', height: 120, resize: 'vertical',
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
                    marginTop: 8, width: '100%', padding: '7px 0',
                    background: output.trim() ? c.ACCENT + '18' : 'transparent',
                    border: `1px solid ${output.trim() ? c.ACCENT : c.RULE}`,
                    color: output.trim() ? c.ACCENT : c.SUB,
                    borderRadius: 6, cursor: output.trim() ? 'pointer' : 'default',
                    fontSize: 11, fontFamily: mono,
                  }}
                >
                  採点する
                </button>
              </div>

              {/* スコア結果 */}
              {result && (
                <div style={{ padding: '10px 14px' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: 8, alignItems: 'baseline',
                  }}>
                    <span style={{ fontSize: 11, color: c.SUB }}>採点結果</span>
                    <span style={{
                      fontSize: 16,
                      color: result.passed === result.total ? c.WIN : result.passed >= result.total / 2 ? c.ACCENT : c.LOSS,
                      fontWeight: 'bold',
                    }}>
                      {result.passed}/{result.total}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{
                          fontSize: 11, flexShrink: 0, marginTop: 1,
                          color: item.pass ? c.WIN : c.LOSS,
                        }}>
                          {item.pass ? '✓' : '✗'}
                        </span>
                        <span style={{ fontSize: 10, color: item.pass ? c.TEXT : c.LOSS, lineHeight: 1.5 }}>
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
    </div>
  )
}
