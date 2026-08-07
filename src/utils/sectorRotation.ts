// セクターローテーション（景気循環のどこにいるかで物色対象が回る、という見方）。
//
// 🔵 分類の単位は **TOPIX-17（東証17業種）**。銘柄マスタ（JPX 上場銘柄一覧）が
//    33業種と17業種の両方を持っているので、銘柄 → 17業種 → 局面 が一本の線で繋がる。
// 🔴 **局面の判定は行わない**。ここが持つのは
//    ①「理論上どの局面でどのセクターが強いとされるか」という**教科書的な対応表**と、
//    ②業種別ETFから計算した**実測の騰落率**、の2つだけ。
//    「いまは◯◯相場だ」と決めつけると投資助言に寄るので、
//    画面では①と②を**並べて見せ、食い違いはそのまま出す**（CLAUDE.md の方針）。

/** 景気の4局面。金融相場→業績相場→逆金融相場→逆業績相場 の順に回る。 */
export type SectorPhaseId = 'financial' | 'performance' | 'reverseFinancial' | 'reversePerformance'

/** TOPIX-17 の業種コード（1〜17）と名前。JPX 上場銘柄一覧の「17業種区分」と一致。 */
export const SECTOR17: readonly { code: number; label: string }[] = [
  { code: 1,  label: '食品' },
  { code: 2,  label: 'エネルギー資源' },
  { code: 3,  label: '建設・資材' },
  { code: 4,  label: '素材・化学' },
  { code: 5,  label: '医薬品' },
  { code: 6,  label: '自動車・輸送機' },
  { code: 7,  label: '鉄鋼・非鉄' },
  { code: 8,  label: '機械' },
  { code: 9,  label: '電機・精密' },
  { code: 10, label: '情報通信・サービスその他' },
  { code: 11, label: '電力・ガス' },
  { code: 12, label: '運輸・物流' },
  { code: 13, label: '商社・卸売' },
  { code: 14, label: '小売' },
  { code: 15, label: '銀行' },
  { code: 16, label: '金融（除く銀行）' },
  { code: 17, label: '不動産' },
] as const

export function sector17Label(code: number): string {
  return SECTOR17.find(s => s.code === code)?.label ?? `業種${code}`
}

export type SectorPhase = {
  id: SectorPhaseId
  /** 局面名（画面に出す） */
  label: string
  /** 景気の位置づけ（回復・好況・後退・不況） */
  economy: string
  /** その局面で相対的に強くなりやすい**とされる**TOPIX-17 の業種コード */
  sectors17: readonly number[]
  /** 局面の説明（1〜2文・状態の記述にとどめる） */
  note: string
  /** 円環上の角度（0度＝真上、時計回り） */
  angle: number
  /** 表示色 */
  color: string
}

/**
 * 4局面と、その局面で強いとされる業種。
 *
 * 🔵 並びは一般的な「景気循環と物色の順番」（金融→業績→逆金融→逆業績）。
 * 🔴 **17業種すべてをどこか1つに割り当てている**（余りを作ると、その業種の銘柄を
 *    検索したときに行き場が無くなるため）。TOPIX-17 は粒度が粗く、
 *    たとえば「運輸・物流」は海運（景気敏感）と陸運（ディフェンシブ）が同居する。
 *    ここでは海運側を重く見て業績相場に置いているが、**割り切りである**ことを画面にも書く。
 */
export const PHASES: readonly SectorPhase[] = [
  {
    id: 'financial',
    label: '金融相場',
    economy: '不況〜回復',
    // 電機・精密 / 情報通信・サービスその他 / 金融（除く銀行）＝証券 / 不動産
    sectors17: [9, 10, 16, 17],
    note: '景気はまだ弱いが、金利低下と資金供給を背景に株価が先に動きやすいとされる局面。',
    angle: 0,
    color: '#38bdf8',
  },
  {
    id: 'performance',
    label: '業績相場',
    economy: '回復〜好況',
    // 建設・資材 / 素材・化学 / 自動車・輸送機 / 鉄鋼・非鉄 / 機械 / 運輸・物流
    sectors17: [3, 4, 6, 7, 8, 12],
    note: '企業業績の改善が数字で確認され、景気に連動しやすいセクターへ資金が向かうとされる局面。',
    angle: 90,
    color: '#22c55e',
  },
  {
    id: 'reverseFinancial',
    label: '逆金融相場',
    economy: '好況〜後退',
    // エネルギー資源 / 商社・卸売 / 銀行
    sectors17: [2, 13, 15],
    note: '金利上昇や引き締めが意識され、株価が業績より先に頭打ちになりやすいとされる局面。',
    angle: 180,
    color: '#f59e0b',
  },
  {
    id: 'reversePerformance',
    label: '逆業績相場',
    economy: '後退〜不況',
    // 食品 / 医薬品 / 電力・ガス / 小売
    sectors17: [1, 5, 11, 14],
    note: '業績の悪化が数字に出る局面。景気に左右されにくいとされるセクターが相対的に残りやすい。',
    angle: 270,
    color: '#a78bfa',
  },
] as const

/** 円環の角度から、その位置の局面を返す（0〜360度・境界は次の局面に含める）。 */
export function phaseAt(angle: number): SectorPhase {
  const a = ((angle % 360) + 360) % 360
  const i = Math.floor(a / 90) % 4
  return PHASES[i]
}

export function phaseById(id: SectorPhaseId): SectorPhase {
  return PHASES.find(p => p.id === id) ?? PHASES[0]
}

/** 次の局面（時計回り）。 */
export function nextPhase(id: SectorPhaseId): SectorPhase {
  const i = PHASES.findIndex(p => p.id === id)
  return PHASES[(i + 1) % PHASES.length]
}

/** 17業種コードが属する局面。未知のコードでも落ちないよう null を返す。 */
export function phaseOfSector17(code: number): SectorPhase | null {
  return PHASES.find(p => p.sectors17.includes(code)) ?? null
}

/** 局面の中央角度（円環にマーカーを置く位置）。 */
export function phaseMidAngle(id: SectorPhaseId): number {
  return phaseById(id).angle + 45
}

// ── 実測データ（public/data/sector_perf.json）─────────────────

/**
 * 業種別の騰落率。
 * 🔴 中身は**業種別ETF（TOPIX-17連動）の調整後終値**から計算した代用値で、
 *    業種別株価指数そのものではない（指数の配信は有料）。
 */
export type SectorPerfRow = {
  sector17: number
  label:    string
  /** 代用に使ったETFの銘柄コード（1617〜1633） */
  etf:      string
  time:     string
  close:    number
  chg1m:    number | null
  chg3m:    number | null
  chg6m:    number | null
  /**
   * 直近1か月の**手前**の2か月（重ならない区間）の騰落率。
   * 🔴 「その前はどうだったか」に 3か月を使ってはいけない。直近1か月を含むので、
   *    窓の中で主役が交代していると古い局面と今の局面を混ぜた数字になる（ユーザー指摘・2026-08-07）。
   */
  chgPrev2m?: number | null
  rank1m:   number | null
  rank3m:   number | null
  rank6m:   number | null
}

export type PerfKey = 'chg1m' | 'chg3m' | 'chg6m'

export const PERF_LABELS: Record<PerfKey, string> = {
  chg1m: '1か月',
  chg3m: '3か月',
  chg6m: '6か月',
}

/**
 * 画面に出す言い方。
 * 🔴 「1か月」「6か月」だけだと**何のための期間か伝わらない**（ユーザー指摘・2026-08-07）。
 *    知りたいのは「いまどの業種がいいか」なので、**主役は直近1か月＝いまの勢い**。
 * 🔵 3か月は「その勢いが前から続いているのか、下げたあとの戻りなのか」を見分けるためだけに添える。
 *    実例＝鉄鋼・非鉄は1か月 +6.0%（上位）だが3か月 −19.1%（最下位）＝戻り。
 *    1か月だけ見ると「いま強い業種」として拾ってしまう。
 * 🔵 6か月は用途が薄いので画面には出さない（データは取り続ける）。
 */
export const PERF_PLAIN: Record<PerfKey, string> = {
  chg1m: 'いまの勢い',
  chg3m: 'その前からの流れ',
  chg6m: '長い流れ',
}

/** 期間の実日付（`sector_perf.json` の periods）。 */
export type PerfPeriod = { days: number; from: string | null; to: string | null }
/** 🔵 `prev2m` は「直近1か月の手前の2か月」＝重ならない区間。騰落率のキーではないので別枠。 */
export type PeriodKey = PerfKey | 'prev2m'
export type PerfPeriods = Partial<Record<PeriodKey, PerfPeriod>>

export type PhaseStrength = {
  phase: SectorPhase
  /** その局面に属する業種の騰落率の平均（%）。1つも取れなければ null。 */
  avg:   number | null
  /** 4局面の中での順位（1＝いちばん強い）。avg が null なら null。 */
  rank:  number | null
  /** その局面に属する業種の実測（強い順） */
  members: SectorPerfRow[]
}

/**
 * 局面ごとに「属する業種の平均騰落率」を出す（純粋関数・テスト対象）。
 *
 * 🔴 これは**測っただけ**で、局面の判定ではない。
 *    「平均が一番高いグループ＝いまその局面」ではないことを画面側でも明示する。
 * 🔵 単純平均。時価総額加重にしないのは、加重すると数銘柄の巨大企業で
 *    グループの色が決まってしまい、「物色がどこに向いたか」が見えなくなるため。
 */
export function phaseStrengths(rows: readonly SectorPerfRow[], key: PerfKey): PhaseStrength[] {
  const out: PhaseStrength[] = PHASES.map(phase => {
    const members = rows
      .filter(r => phase.sectors17.includes(r.sector17))
      .sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity))
    const vals = members.map(m => m[key]).filter((v): v is number => v != null)
    const avg  = vals.length === 0 ? null
      : Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) / 100
    return { phase, avg, rank: null, members }
  })

  out.filter(s => s.avg != null)
    .sort((a, b) => b.avg! - a.avg!)
    .forEach((s, i) => { s.rank = i + 1 })

  return out
}

/** 平均がいちばん高い局面グループ。全部 null なら null。 */
export function strongestPhase(strengths: readonly PhaseStrength[]): PhaseStrength | null {
  return strengths.find(s => s.rank === 1) ?? null
}

// ── 局面の「型」との一致度 ──────────────────────────────

export type FitMember = {
  row: SectorPerfRow
  /** 17業種の中での順位（1＝いちばん強い） */
  rank: number
  /** 上位1/3＝支持 / 下位1/3＝矛盾 / それ以外＝どちらでもない */
  role: 'support' | 'contradict' | 'neutral'
}

export type PhaseFit = {
  phase: SectorPhase
  /** 0〜100。その局面で強いとされる業種が実際に上位に並んでいるほど高い。 */
  score: number | null
  /** 属する業種の平均順位（小さいほど上位） */
  meanRank: number | null
  /** 順位順のメンバー */
  members: FitMember[]
}

/**
 * 「いまの業種の並びが、どの局面の型にどれだけ近いか」を 0〜100 で出す（純粋関数・テスト対象）。
 *
 * 考え方はごく単純で、**その局面で強いとされる業種が実際に何位にいるか**だけを見る。
 *   ・その局面の業種が上位を独占（1位,2位,…）  → 100
 *   ・下位を独占                                 → 0
 *   ・ばらけて真ん中                             → 50 付近
 * 局面ごとに業種数が違う（3〜6）ので、取りうる最良・最悪の平均順位で正規化して揃えている。
 *
 * 🔴 **これは「確率」ではない**。単に型との一致度。
 *    局面には正解ラベルが存在せず、当たったかどうかを後から検証できないため、
 *    %を確率として名乗らせない（過去に確信度が自信過剰かつ反転していた反省・第25セッション）。
 * 🔴 使う側は **4局面すべてを並べて出すこと**。1位だけ出すと断定に見える。
 * 🔵 平均騰落率（`phaseStrengths`）ではなく**順位**を使うのは、
 *    銀行 +20% のような突出した1業種にグループ全体の評価を持っていかれないため。
 */
export function phaseFits(rows: readonly SectorPerfRow[], key: PerfKey): PhaseFit[] {
  const ranked = [...rows]
    .filter(r => r[key] != null)
    .sort((a, b) => b[key]! - a[key]!)
  const n = ranked.length
  const rankOf = new Map(ranked.map((r, i) => [r.sector17, i + 1]))

  // 上位1/3を「支持」、下位1/3を「矛盾」とみなす
  const topCut    = Math.max(1, Math.ceil(n / 3))
  const bottomCut = n - topCut + 1

  return PHASES.map(phase => {
    const members: FitMember[] = phase.sectors17
      .map(code => {
        const row  = ranked.find(r => r.sector17 === code)
        const rank = rankOf.get(code)
        if (!row || rank == null) return null
        const role: FitMember['role'] =
          rank <= topCut ? 'support' : rank >= bottomCut ? 'contradict' : 'neutral'
        return { row, rank, role }
      })
      .filter((m): m is FitMember => m !== null)
      .sort((a, b) => a.rank - b.rank)

    const k = members.length
    // 🔴 n が小さいと正規化の分母が潰れるので、比較にならない場合は出さない
    if (k === 0 || n < 4 || k >= n) return { phase, score: null, meanRank: null, members }

    const meanRank = members.reduce((s, m) => s + m.rank, 0) / k
    const best     = (k + 1) / 2          // 上位を独占したときの平均順位
    const worst    = n - (k - 1) / 2      // 下位を独占したときの平均順位
    const score    = Math.round((worst - meanRank) / (worst - best) * 1000) / 10

    return {
      phase,
      score: Math.min(100, Math.max(0, score)),
      meanRank: Math.round(meanRank * 100) / 100,
      members,
    }
  })
}

// ── 「いま強い業種」の並び ────────────────────────────

export type SectorRankRow = {
  row: SectorPerfRow
  /** 直近1か月の順位（1＝いちばん強い） */
  rank: number
  /** 所属する局面（未分類なら null） */
  phase: SectorPhase | null
  /**
   * 直近1か月はプラスだが、**その前の2か月**はマイナス＝下げたあとに動き出した業種。
   *
   * 🔵 これは警告ではない。「まだ上がりきっていないものを買う」のが目的なら、
   *    底を打った直後はむしろ探しているもの。ただの事実として印を付ける。
   *    🔴 それが底なのか一時的な反発なのかは**判定できない**（区別を示すところまで）。
   * 🔴 判定に **3か月を使わない**。3か月は直近1か月を含むので、
   *    窓の中で主役が交代していると古い局面と混ざる（ユーザー指摘・2026-08-07）。
   *    実例＝2026-08-07 の型の一致度は 1か月=逆金融83.3 / 3か月=金融67.3 で1位が食い違っていた
   *    ＝3か月の窓の中で交代が起きている証拠。
   */
  rebound: boolean
}

/**
 * 「いまどの業種がいいか」に答えるための並び（純粋関数・テスト対象）。
 * 直近1か月の強い順。その前の2か月（重ならない区間）がマイナスなら `rebound`。
 */
export function sectorRanking(rows: readonly SectorPerfRow[]): SectorRankRow[] {
  return [...rows]
    .filter(r => r.chg1m != null)
    .sort((a, b) => b.chg1m! - a.chg1m!)
    .map((row, i) => ({
      row,
      rank: i + 1,
      phase: phaseOfSector17(row.sector17),
      rebound: row.chg1m! > 0 && row.chgPrev2m != null && row.chgPrev2m < 0,
    }))
}

/** 一致度がいちばん高い局面。全部 null なら null。 */
export function bestFit(fits: readonly PhaseFit[]): PhaseFit | null {
  const scored = fits.filter(f => f.score != null)
  if (scored.length === 0) return null
  return scored.reduce((a, b) => (b.score! > a.score! ? b : a))
}

// ── 銘柄マスタ（public/data/stock_master.json）────────────────

export type StockRow = {
  code:     string
  name:     string
  /** 33業種区分（表示用） */
  sector33: string
  /** TOPIX-17 の業種コード */
  sector17: number
}

/**
 * 銘柄コード・銘柄名・業種名で探す（純粋関数・テスト対象）。
 *
 * 🔵 コードは前方一致（「67」で 6758 等を拾う）。
 *    投資家はコードの途中まで打って探すことが多いので、数字は前方一致にしている。
 * 🔴 文字は**関連度順に並べる**。単純な部分一致だと「銀行」で
 *    17業種名「金融（除く銀行）」が先に何百件も出てしまい、銀行株にたどり着けない
 *    （実際に起きた・2026-08-07）。業種名の**前方一致**を最優先にして避けている。
 * 🔴 マスタは約3700銘柄あるので **件数を必ず打ち切る**。
 *    「銀」のような1文字でも数百件当たり、そのまま描くと画面が固まる。
 */
const NO_MATCH = 99

/** 小さいほど「探していたもの」に近い。 */
function matchScore(s: StockRow, lower: string): number {
  const name = s.name.toLowerCase()
  const s33  = s.sector33.toLowerCase()
  const s17  = sector17Label(s.sector17).toLowerCase()

  if (s33.startsWith(lower) || s17.startsWith(lower)) return 0  // 「銀行」→ 銀行業
  if (name.startsWith(lower))                         return 1  // 「ソニー」→ ソニーグループ
  if (s33.includes(lower) || s17.includes(lower))     return 2  // 「銀行」→ 金融（除く銀行）
  if (name.includes(lower))                           return 3
  return NO_MATCH
}

export function searchStocks(
  query: string,
  stocks: readonly StockRow[],
  limit = 40
): { hits: StockRow[]; total: number } {
  const q = query.trim()
  if (q === '') return { hits: [], total: 0 }
  const lower = q.toLowerCase()

  if (/^[0-9]+$/.test(q)) {
    const all = stocks.filter(s => s.code.startsWith(q))
    return { hits: all.slice(0, limit), total: all.length }
  }

  const scored: { s: StockRow; score: number }[] = []
  for (const s of stocks) {
    const score = matchScore(s, lower)
    if (score !== NO_MATCH) scored.push({ s, score })
  }
  // 🔵 スコアが同じなら元の並び（コード昇順）のまま＝Array#sort は安定
  scored.sort((a, b) => a.score - b.score)

  return { hits: scored.slice(0, limit).map(x => x.s), total: scored.length }
}
