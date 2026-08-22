// 個別銘柄の需給ゲージ（信用残から「重い／軽い」を出す）。2026-08-17 追加。
//
// 何のために（ユーザー要望）: 主力・候補の各銘柄に「軽くなってきた」「重い」程度のゲージを出したい。
//
// 🔴 **信用倍率だけで決めない**。ファナックは倍率19.8倍（＝買い一辺倒）だが、買残は1日の商いの
//    0.56日分しかない。倍率だけ見ると「詰まっている」と読むが、実際は出来高で流せる量しかない。
//    逆に商いの薄い銘柄は、倍率が低くても買残が何日分も積み上がっていることがある。
//    → **水準（どれだけ重いか）＝倍率 と 日数 の合成**にする。
//
// 🔴 **向き（軽くなってきたか）を分ける**。同じ「重い」でも、買残が減っている最中と
//    増えている最中では意味が逆。人が知りたいのは「いま重いか」より「軽くなってきたか」なので、
//    ゲージ（水準）とは別に矢印（向き）を出す。
//
// 🔵 出すのは**状態の記述だけ**。売買の推奨はしない（アプリ全体の方針）。

/** 週次の信用残（JPX「銘柄別信用取引週末残高」由来） */
export type MarginWeek = {
  /** 週末日 YYYY-MM-DD */
  w: string
  /** 買残（株） */
  long: number
  /** 前週比（株） */
  longChg: number
  /** 売残（株） */
  short: number
  shortChg: number
}

export type MarginGauge = {
  /** 0=とても軽い 〜 100=とても重い（画面のゲージはこの値を使う） */
  score: number
  /**
   * 1週前の点数。画面では「どこから動いてきたか」の軌跡に使う。
   * 🔵 数字だけだと「重い」しか伝わらない。動いた幅が見えると、同じ「重い」でも意味が違うと分かる。
   */
  prevScore: number | null
  /** 重さの区分 */
  level: 'light' | 'normal' | 'heavy' | 'very_heavy'
  /** 人に見せる短い言葉 */
  label: string
  /** 向き（買残が増えているか減っているか） */
  trend: 'lighter' | 'flat' | 'heavier'
  /** 向きの言葉 */
  trendLabel: string
  /** 信用倍率（買残÷売残）。売残0なら null */
  ratio: number | null
  /** 買残が平常の何日分の商いに相当するか。出来高不明なら null */
  days: number | null
  /** 売残が平常の何日分の商いに相当するか。出来高不明なら null */
  shortDays: number | null
  /**
   * 踏み上げの燃料（売り方がどれだけ残っているか）。
   * 🔴 「軽い」には2種類ある＝①誰も信用で持っていない（閑散）②**売り方が積み上がっている**。
   *    ②は上昇時に買い戻しが入るので、同じ「軽い」でも意味がまるで違う（2026-08-17 ユーザー指摘）。
   */
  squeeze: 'none' | 'some' | 'strong'
  /**
   * 🔴 1行で言い切る要約（2026-08-22 追加・運用者の指摘）。
   *    それまで画面には「14 軽い ▸ 重くなってきた （踏み上げ余地）」と**3つの判定が並んで**いて、
   *    軽いのか重いのか読めなかった。専門語（軽い／重い／踏み上げ）を使わず、
   *    **信用買残＝これから出てくる売り物**という中身の言葉で1文にする。
   */
  summary: string
  /** 差引の買い越し（株数）。買残−売残 */
  netShares: number
  /** 差引の買い越しが平常の商いの何日分か。🔴 銘柄をまたいで比べられる唯一の数字 */
  netDays: number | null
  /** 金額（億円）。株価を渡したときだけ入る */
  longOku: number | null
  shortOku: number | null
  netOku: number | null
  /** 週ごとの推移（古い順）。運用者の要望＝「信用買い残の推移が見たい」（2026-08-22） */
  series: { w: string; long: number; short: number; net: number; netDays: number | null; netOku: number | null }[]
  /** 踏み上げの言葉（none のときは空文字） */
  squeezeLabel: string
  /** 直近1週の買残の増減率（%） */
  chgPct: number | null
  /** 4週前と比べた買残の増減率（%）。履歴が足りなければ null */
  chg4wPct: number | null
  /** 画面のツールチップ用の一行 */
  note: string
}

/**
 * 需給 × 価格の位置（2026-08-17 ユーザー指摘で追加）。
 *
 * きっかけ＝「ファナックは株価的には200日線タッチがある」。
 * このアプリの購入基準の2つ目は「200日線付近か」だが、**同じ200日線タッチでも需給で意味が変わる**。
 *   ・押し目に買残が増えている … 同じ判断をした人が既に大量にいる（戻れば戻り売り、割れば投げ）
 *   ・押し目でも買残が減っている … 同じ判断をした人は少ない
 * 指数側では既に「需給×価格セル」を出しているので（`engineExport.ts`）、個別でも同じ見方を用意する。
 *
 * 🔵 出すのは**状態の記述だけ**。買え・売れは書かない。
 */
export function supplyPriceCell(g: MarginGauge | null, dev200: number | null | undefined): string | null {
  if (!g || dev200 == null) return null

  const near = Math.abs(dev200) <= 5
  const above = dev200 > 5
  const heavy = g.level === 'heavy' || g.level === 'very_heavy'

  if (near && g.trend === 'heavier') return '200日線付近で買残が増えている（同じ判断が既に多い）'
  if (near && g.trend === 'lighter') return '200日線付近で買残は減っている（同じ判断は少ない）'
  if (near) return '200日線付近。買残は横ばい'

  if (above && g.squeeze !== 'none') return '上昇中で、売り方がまだ残っている'
  if (above && heavy) return '上昇中に買残が積み上がっている'
  if (above && g.trend === 'heavier') return '上昇中に買残が増えている'

  if (!above && heavy) return '200日線を下回ったまま買残が残っている'

  // 🔴 どの型にも当てはまらない銘柄で **null を返さない**（2026-08-22・運用者の指摘
  //    「書いてあったり書いてなかったり。どちらかにしたい」）。
  //    以前はここで null を返し、一文だけでなく枠ごと消える銘柄があった。
  //    型に当てはまらないときは、位置と残高の向きを素直に並べる。
  const zone = above ? '200日線の上' : '200日線の下'
  const level = g.level === 'light' ? '上に控える残は少ない'
    : g.level === 'normal' ? '上に控える残はふつう' : '上に控える残が多い'
  const move = g.trend === 'heavier' ? '増えている' : g.trend === 'lighter' ? '減っている' : '横ばい'
  return `${zone}。${level}（${move}）`
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * 「重さ」の点数（0〜100）。倍率と日数の合成。
 *
 * 🔵 倍率は 1倍（拮抗）〜25倍（買い一辺倒）を 0〜100 に写す。
 * 🔵 日数は 0.1日（すぐ流せる）〜2日（積み上がっている）を 0〜100 に写す。
 *    🔴 目盛りは**実データで決めた**（2026-08-17）。主力・候補24銘柄はどれも大型で、
 *       買残は平常の商いの 0.13〜0.98日分に収まる。3日を上限にすると全員が下half に潰れて
 *       見分けが付かなくなった。
 * 🔴 日数が分からない銘柄（出来高が無い）は倍率だけで決める＝**足りない情報を勝手に補わない**。
 */
export function heaviness(ratio: number | null, days: number | null): number {
  const byRatio = ratio == null ? null : clamp(((ratio - 1) / 24) * 100)
  const byDays = days == null ? null : clamp(((days - 0.1) / 1.9) * 100)

  if (byRatio == null && byDays == null) return 50
  if (byDays == null) return Math.round(byRatio as number)
  if (byRatio == null) return Math.round(byDays)

  // 🔵 「実際に流せるか」の方が効くので日数を厚めに見る（6:4）。
  return Math.round(byDays * 0.6 + byRatio * 0.4)
}

/** 信用残の履歴（古い順）から需給ゲージを作る。履歴が空なら null。 */
/**
 * @param price 直近の株価。渡すと金額（億円）も出す。
 *   🔴 **倍率だけでは銘柄を比べられない**（2026-08-22 運用者の指摘）。
 *      ファナックは倍率20.8倍・差引284億円、ハーモニックは倍率1.6倍・差引17億円で、
 *      倍率で見ると印象が逆になる。**差引の買い越し**を出して初めて量の差が見える。
 */
export function marginGauge(history: MarginWeek[] | null | undefined, vol20: number | null | undefined, price?: number | null): MarginGauge | null {
  if (!history || history.length === 0) return null

  const last = history[history.length - 1]
  const ratio = last.short > 0 ? r1(last.long / last.short) : null
  // 🔵 日数は小数第2位まで（0.56日分のように「1日に満たない」が意味を持つため）
  const days = vol20 && vol20 > 0 ? Math.round((last.long / vol20) * 100) / 100 : null
  const shortDays = vol20 && vol20 > 0 ? Math.round((last.short / vol20) * 100) / 100 : null

  // 🔴 踏み上げの燃料＝**売り方がどれだけ残っているか**（2026-08-17 ユーザー指摘で追加）。
  //    実データ：ハーモニック（売残0.31日分・倍率1.3）とアドバンテスト（0.13日分・1.4）は
  //    上昇の最中に売り方が大量に残っている＝買い戻しが上値を押し上げる側に働く。
  //    一方フジクラは同じく強いが倍率16.5・売残0.03日分＝買い方一辺倒で、上値は重くなりやすい。
  //    🔵 「軽い」だけでは、この2つが同じ顔になってしまう。
  const squeeze: MarginGauge['squeeze'] =
    shortDays == null || ratio == null ? 'none'
      : shortDays >= 0.25 && ratio <= 3 ? 'strong'
        : shortDays >= 0.1 && ratio <= 5 ? 'some'
          : 'none'
  const squeezeLabel = squeeze === 'strong' ? '売り方が多い（踏み上げ余地）'
    : squeeze === 'some' ? '売り方あり' : ''

  const prevLong = last.long - last.longChg
  const chgPct = prevLong > 0 ? r1((last.longChg / prevLong) * 100) : null

  const base4w = history.length >= 5 ? history[history.length - 5].long : null
  const chg4wPct = base4w && base4w > 0 ? r1(((last.long - base4w) / base4w) * 100) : null

  const score = heaviness(ratio, days)

  // 1週前の点数（同じ物差しで測る＝出来高は今の平常値を使う）。履歴が1週しか無ければ出さない。
  const prev = history.length >= 2 ? history[history.length - 2] : null
  const prevScore = prev
    ? heaviness(
      prev.short > 0 ? r1(prev.long / prev.short) : null,
      vol20 && vol20 > 0 ? Math.round((prev.long / vol20) * 100) / 100 : null,
    )
    : null

  const level: MarginGauge['level'] =
    score >= 75 ? 'very_heavy' : score >= 55 ? 'heavy' : score >= 30 ? 'normal' : 'light'
  const label =
    level === 'very_heavy' ? 'かなり重い' : level === 'heavy' ? '重い' : level === 'normal' ? 'ふつう' : '軽い'

  // 🔵 向きは直近1週を主、4週を従で見る（1週だけだと週替わりでぶれる）。
  const move = chgPct ?? 0
  const move4 = chg4wPct ?? 0
  const trend: MarginGauge['trend'] =
    move <= -5 || (move <= 0 && move4 <= -10) ? 'lighter'
      : move >= 5 || (move >= 0 && move4 >= 10) ? 'heavier'
        : 'flat'
  const trendLabel =
    trend === 'lighter' ? '軽くなってきた' : trend === 'heavier' ? '重くなってきた' : '横ばい'

  const parts: string[] = []
  if (ratio != null) parts.push(`信用倍率 ${ratio}倍`)
  const okuOf = (shares: number) => (price && price > 0 ? `${Math.round(shares * price / 1e8 * 10) / 10}億円` : null)
  const longOkuTxt = okuOf(last.long), shortOkuTxt = okuOf(last.short)
  if (days != null) parts.push(`買残${longOkuTxt ? ' ' + longOkuTxt : 'は平常の商いの'} ${longOkuTxt ? `（${days}日分）` : `${days}日分`}`)
  if (shortDays != null) parts.push(`売残${shortOkuTxt ? ' ' + shortOkuTxt : 'は'} ${shortOkuTxt ? `（${shortDays}日分）` : `${shortDays}日分`}`)
  // 🔴 ここが銘柄をまたいで比べられる唯一の数字（2026-08-22 追加）
  // 🔴 符号で呼び名を変える（2026-08-22・運用者の指摘「売り物がマイナスになっている」）。
  //    買残＞売残 なら**いずれ売られる**、売残＞買残 なら**いずれ買い戻される**。
  //    片方の名前で符号だけ反転させると、日本語として意味を成さなくなる。
  {
    const nd = netDaysForNote(vol20, last)
    const net = last.long - last.short
    const okuAbs = price && price > 0 ? `${Math.round(Math.abs(net) * price / 1e8 * 10) / 10}億円` : null
    if (okuAbs || nd != null) {
      const name = net >= 0 ? '将来的に売られる残' : '将来的に買い戻される残'
      parts.push(`${name}${okuAbs ? ' ' + okuAbs : ''}${nd != null ? `（${Math.abs(nd)}日分）` : ''}`)
    }
  }
  if (chgPct != null) parts.push(`買残 前週比 ${chgPct > 0 ? '+' : ''}${chgPct}%`)
  if (chg4wPct != null) parts.push(`4週で ${chg4wPct > 0 ? '+' : ''}${chg4wPct}%`)
  if (squeezeLabel) parts.push(squeezeLabel)

  // 🔴 専門語を使わない1行（2026-08-22）。買残＝将来の売り物、売残＝将来の買い戻し。
  //    🔵 向きも「増えている／減っている」と事実で書き、良し悪しは付けない
  //       （買残の積み上がりが弱気材料かは指数では否定されている＝2026-08-22 の検証）。
  const levelWord =
    level === 'very_heavy' ? '上に控える売り物がかなり多い'
      : level === 'heavy' ? '上に控える売り物が多め'
        : level === 'normal' ? '上に控える売り物はふつう'
          : '上に控える売り物は少なめ'
  const trendWord = trend === 'heavier' ? '（4週で増加）' : trend === 'lighter' ? '（4週で減少）' : ''
  const summary = levelWord + trendWord + (squeeze === 'strong' ? '・売り方も多い' : '')

  // 差引の買い越し（＝将来ほどける向きの正味）。日分にすると銘柄をまたいで比べられる。
  const oku = (shares: number) => (price && price > 0 ? Math.round(shares * price / 1e8 * 10) / 10 : null)
  const netShares = last.long - last.short
  const netDays = vol20 && vol20 > 0 ? Math.round((netShares / vol20) * 100) / 100 : null
  const series = history.map(h => ({
    w: h.w, long: h.long, short: h.short, net: h.long - h.short,
    netDays: vol20 && vol20 > 0 ? Math.round(((h.long - h.short) / vol20) * 100) / 100 : null,
    netOku: oku(h.long - h.short),
  }))

  return {
    score,
    prevScore,
    level,
    label,
    summary,
    netShares,
    netDays,
    longOku: oku(last.long),
    shortOku: oku(last.short),
    netOku: oku(netShares),
    series,
    trend,
    trendLabel,
    ratio,
    days,
    shortDays,
    squeeze,
    squeezeLabel,
    chgPct,
    chg4wPct,
    note: `${last.w} 時点：` + (parts.join('／') || 'データ不足'),
  }
}

/** 差引の買い越しが平常の商いの何日分か（note 用の小さな補助）。 */
function netDaysForNote(vol20: number | null | undefined, last: MarginWeek): number | null {
  if (!vol20 || vol20 <= 0) return null
  return Math.round(((last.long - last.short) / vol20) * 100) / 100
}
