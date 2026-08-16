// ロボ口座画面（内部識別子 'shield'・旧「エンジン」）のタブの並び順（単一情報源）。
//
// 🔴 **ブンセキ画面と同じ約束**（`quantTabs.ts` 参照）＝並び順はここ1か所で決め、
//    パネルを JSX に書く順もこれに合わせる。2か所に持つと、内容は正しいのに
//    **スライドが左右逆に動く**という壊れ方をする（2026-08-11 に実際に踏んだ）。
//
// 🔵 中身は元の3カラムをそのまま割り当てたもの：
//    account = 口座の状態＋資産推移 ／ perf = 成績＋YOUR CALL ／ log = 約定履歴

export const ENGINE_TABS = ['account', 'perf', 'log'] as const

export type EngineTabKey = typeof ENGINE_TABS[number]

// 🔴 2026-08-16: 画面名が「エンジン」→**ロボ口座**になったので、先頭タブは
//    画面名と同じにならないよう**口座**にした（中身は口座の状態そのもの）。
export const ENGINE_LABELS: Record<EngineTabKey, string> = {
  account: '口座',
  perf:    '成績',
  log:     '履歴',
}
