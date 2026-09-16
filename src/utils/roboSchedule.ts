// ぽいロボが自動で動く時刻（2026-08-13）
//
// 🔵 なぜカレンダーに出すか＝自動処理がいつ動くかを見えるようにするため（ユーザー要望）。
//    当初は「PCを開けておく時間（チャート撮影）」を知らせるのが主目的だった。
//
// 🔴 ここは**実際の設定の写し**。時刻を書き換えるときは必ず両方を直すこと。
//    - `.github/workflows/fetch-data.yml`（データ更新・週次）
//    - `.github/workflows/archive-intraday.yml`（5分足アーカイブ）
//
// 🔴 2026-09-16：ロボ口座を廃止したので「AI判断（15:00）」と「チャート撮影（16:00・PC要）」を外した。
//    いま PC を開けておく必要がある予定は無い（needsPc は将来のために残してある）。
export type RoboJobKind = 'archive' | 'data' | 'weekly'

export type RoboJob = {
  id: string
  kind: RoboJobKind
  /** 予定の名前（カレンダーに出る） */
  title: string
  /** 'HH:MM' */
  startTime: string
  /** 目安の所要時間（分）。ブロックの高さに使うだけ */
  minutes: number
  /** 🔴 PCが起動していないと動かないもの */
  needsPc: boolean
  /** 何をしているか（クリックで出す） */
  desc: string
}

const WEEKDAY_JOBS: RoboJob[] = [
  {
    id: 'archive', kind: 'archive', title: '5分足アーカイブ', startTime: '16:30', minutes: 10, needsPc: false,
    desc: '5分足は60日しか遡れないので、消える前に貯めておく。数日止まっても後から自動で埋まる。',
  },
  {
    id: 'data1', kind: 'data', title: 'データ更新', startTime: '19:30', minutes: 20, needsPc: false,
    desc: 'JPXの日報（前営業日分・16:31〜17:00 公表）の後に、需給・価格をまとめて取り直す。',
  },
  {
    id: 'data2', kind: 'data', title: 'データ更新（保険）', startTime: '21:30', minutes: 20, needsPc: false,
    desc: '1回目が遅れた場合や、あとから埋まった欠損を拾い直す。変更が無ければ何もしない。',
  },
]

const SATURDAY_JOBS: RoboJob[] = [
  {
    id: 'weekly', kind: 'weekly', title: '週次の集計', startTime: '09:00', minutes: 30, needsPc: false,
    desc: '週次COT（CFTCが金曜に公表）・週次集計・バックテストの再計算と、更新通知。',
  },
]

export const ROBO_JOB_META: Record<RoboJobKind, { icon: string; label: string }> = {
  archive: { icon: '🗄', label: '保存' },
  data:    { icon: '⚙️', label: 'データ' },
  weekly:  { icon: '📊', label: '週次' },
}

/**
 * その日にぽいロボが動く予定。
 *
 * 🔴 平日ぶんは**市場が開いている日だけ**。休場日は判断も撮影もしない（スクリプト側で止まる）。
 *    休場かどうかは呼び出し側が知っているので、判定を渡してもらう。
 */
export function getRoboJobsForDate(date: Date, isMarketClosed?: (d: Date) => boolean): RoboJob[] {
  const dow = date.getDay()
  if (dow === 6) return SATURDAY_JOBS
  if (dow === 0) return []
  if (isMarketClosed?.(date)) return []
  return WEEKDAY_JOBS
}
