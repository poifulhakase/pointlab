// ぽいロボが自動で動く時刻（2026-08-13）
//
// 🔵 なぜカレンダーに出すか＝**PCを開けておく必要がある時間**があるため（ユーザー要望）。
//    チャート撮影だけはローカルPCのタスクスケジューラで動くので、PCが落ちていると撮れない。
//    それ以外は GitHub Actions なので、PCの状態に関係なく動く。
//
// 🔴 ここは**実際の設定の写し**。時刻を書き換えるときは必ず両方を直すこと。
//    - `.github/workflows/fetch-data.yml`（判断・データ更新・週次）
//    - `.github/workflows/archive-intraday.yml`（5分足アーカイブ）
//    - Windows タスクスケジューラ `poirobo-capture-chart`（チャート撮影）
//
// 🔴 judge（判断）の 15:00 は **13:00 に起動してジョブの中で待っている**。
//    GitHub の schedule は時刻を保証せず、実測で1時間41分ずれたことがあるため
//    （詳細は fetch-data.yml のコメント）。カレンダーには**判断が出る時刻**を書く。

export type RoboJobKind = 'judge' | 'capture' | 'archive' | 'data' | 'weekly'

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
    id: 'judge', kind: 'judge', title: 'AI判断（ロボ口座）', startTime: '15:00', minutes: 25, needsPc: false,
    desc: '需給データと日足・週足のチャートを見て、翌営業日の建玉を決めて Chatwork に通知する。'
      + '🔴 執行は引成なので、通知を見て 15:25 までに発注する。',
  },
  {
    id: 'capture', kind: 'capture', title: 'チャート撮影', startTime: '16:00', minutes: 10, needsPc: true,
    desc: '🔴 **PCを開けておく必要がある**（ローカルのタスクスケジューラで動く）。'
      + 'TradingView から日経225先物の日足・週足を撮って Chatwork に送る。'
      + 'この画像は**翌営業日の判断**で読まれる。落ちていた場合は次に起動したときに撮る。',
  },
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
  judge:   { icon: '🤖', label: '判断' },
  capture: { icon: '📷', label: '撮影' },
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
