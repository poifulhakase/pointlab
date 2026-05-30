// localStorage キーの単一情報源。文字列リテラルの散在によるタイプミスを防ぐ。
// ★2026-05-30 新設。まず新しいフック/ユーティリティ分を集約。
// 既存の各パネル（vix/margin/investor 等のキャッシュキーや stock-cal-notes 等）は
// 段階移行のため未集約。新規コードは必ずここを参照すること。
export const LS = {
  previewNonMember: 'poical-preview-non-member',
  pushEnabled:      'poical-push-enabled',
  notifyRadar:      'poical-notify-radar',
  notifyDataReady:  'poical-notify-data-ready',
  maintenance:      'poical-maintenance',
} as const
