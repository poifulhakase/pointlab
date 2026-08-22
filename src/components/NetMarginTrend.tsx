import type { MarginGauge } from '../utils/marginGauge'

/**
 * 差引の買い越し（買残−売残）の推移を小さな棒グラフで見せる（2026-08-22 新設）。
 *
 * 🔴 運用者の要望＝「信用買い残の推移が見たい」「グラフにできるか」。
 *    数字を横に並べるだけだと、増えているのか減っているのかが読み取りにくい。
 *
 * 🔵 なぜ「差引」を描くか＝残高そのものより **買残−売残の動き** が上値の重さの変化を表す。
 *    実例（2026-08）＝ハーモニックは +50.6億 → +14.9億 と1ヶ月で3分の1に軽くなり、
 *    同じ時期にファナックは買い越しを2週で+38%積み増した。向きが正反対だった。
 *
 * 🔴 予測は書かない。**量の推移という事実だけ**を描く（2026-08-22 の方針）。
 * 🔵 JPXは直近5週ぶんしか公開しないので、棒は最大5本にしかならない。
 */

type Props = {
  gauge: MarginGauge
  theme: 'dark' | 'light'
  isMobile: boolean
}

export function NetMarginTrend({ gauge, theme, isMobile }: Props) {
  const dark = theme === 'dark'
  const rows = gauge.series
  if (rows.length < 2) return null

  // 🔵 億円が出せない銘柄（株価が無い）は万株で描く。単位は下に必ず書く。
  const useOku = rows.every(r => r.netOku != null)
  const val = (r: typeof rows[number]) => (useOku ? (r.netOku as number) : r.net / 10000)
  const unit = useOku ? '億円' : '万株'

  const vals = rows.map(val)
  const max = Math.max(...vals.map(Math.abs), 1)
  const H = isMobile ? 34 : 40

  const plus = dark ? '#ff6b6b' : '#dc2626'   // 買い越し（＝これから出てくる売り物）
  const minus = dark ? '#4dabf7' : '#2563eb'  // 売り越し
  const dim = dark ? 'rgba(0,229,255,0.55)' : 'rgba(3,105,161,0.75)'

  return (
    <div style={{ marginTop: 6 }}>
      {/* 🔴 ラベルを言い換えた（2026-08-22・運用者の指摘「信用倍率とは違う？分かるような分からないような」）。
          倍率＝買残÷売残の**比率**、ここ＝買残−売残の**量**。倍率は割合なので規模が消える
          （買残1億・売残0.05億でも20倍）。「差引の買い越し」では何のことか伝わらないので、
          **これから市場に出てくる売り物の正味の量**という中身の言葉にする。 */}
      <div style={{ fontSize: 10, color: dim, marginBottom: 4 }}>
        これから出てくる売り物（{unit}）
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 6 : 10 }}>
        {rows.map((r, i) => {
          const v = val(r)
          const h = Math.max(2, Math.round((Math.abs(v) / max) * H))
          const last = i === rows.length - 1
          return (
            <div key={r.w} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9.5, color: last ? (v >= 0 ? plus : minus) : dim, fontWeight: last ? 800 : 400 }}>
                {v >= 0 ? '+' : ''}{Math.round(v * 10) / 10}
              </span>
              <div style={{ height: H, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                <div
                  title={`${r.w}：${v >= 0 ? '+' : ''}${Math.round(v * 10) / 10}${unit}${r.netDays != null ? `（${r.netDays}日分）` : ''}`}
                  style={{
                    width: '100%', height: h, borderRadius: 2,
                    background: v >= 0 ? plus : minus,
                    opacity: last ? 1 : 0.45,
                  }}
                />
              </div>
              <span style={{ fontSize: 9, color: dim }}>{r.w.slice(5).replace('-', '/')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default NetMarginTrend
