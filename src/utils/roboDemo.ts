// ロボ口座のデモデータ（デザイン確認用）。
// 🔴 開発時（`import.meta.env.DEV`）だけ有効。本番ビルドでは呼び出し側ごと落ちる。
// 使い方: http://localhost:5173/calendar/?demo=1      … 建玉あり・履歴たっぷり
//         http://localhost:5173/calendar/?demo=empty  … 保有なし・履歴なし
//         http://localhost:5173/calendar/?demo=loss   … 負けが込んでいる状態
import type { RoboAccount } from './roboAccount'

/** URL から demo モードを読む。DEV 以外では常に null */
export function demoMode(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    const v = new URLSearchParams(window.location.search).get('demo')
    return v === null ? null : (v || '1')
  } catch {
    return null
  }
}

const BASE: Omit<RoboAccount, 'trades' | 'position' | 'stats' | 'equity_curve' | 'cash'> = {
  generated_at: '2026-08-09T10:30:00.000Z',
  logic_version: 'robo-v1-llm',
  decider: { type: 'llm', model: 'claude-opus-5', effort: 'high' },
  universe: ['1321.T', '1570.T', '1571.T', '1357.T'],
  initial_cash: 1000000,
  baseline: null,
  divergences: [
    {
      date: '2026-07-22', source_file_id: 'f001', equity: 1000000, matched: true,
      kind: 'same', note: 'ブル1倍（1321）24口のまま（変化なし）',
    },
    {
      date: '2026-07-29', source_file_id: 'f002', equity: 974320, matched: true,
      kind: 'closed', note: 'ブル1倍（1321）24口 を全部手仕舞い（保有なしに）',
    },
    {
      date: '2026-08-04', source_file_id: 'f003', equity: 978100, matched: true,
      kind: 'opened', note: 'ブル2倍（1570）を新規で 30口 建てた',
    },
    {
      date: '2026-08-08', source_file_id: 'f004', equity: 1053820, matched: false,
      kind: 'decreased', note: 'ブル2倍（1570）を 30口 → 18口 に減らした（−12口）',
    },
    {
      date: '2026-08-09', source_file_id: '2130086442', equity: 1049600, matched: false,
      kind: 'switched',
      note: 'ブル2倍（1570）30口 を手仕舞い、ベア2倍（1357）を 320口 建てた（乗り換え）',
    },
  ],
  last_synced_file_id: '2130086442',
}

/** 建玉あり・履歴たっぷり（既定） */
const FULL: RoboAccount = {
  ...BASE,
  cash: 62400,
  position: {
    symbol: '1357', qty: 320, avg_price: 2805,
    stop_price: 2610, stop_rule: 'atr20x2.5', opened_on: '2026-08-09',
  },
  trades: [
    {
      id: '2026-07-21-open', decided_on: '2026-07-21', executed_on: '2026-07-22',
      side: 'buy', symbol: '1321', qty: 24, price: 41250, confidence_pct: 52,
      reason: '価格は25日線の上で推移しているが高安構造はレンジ。需給は中立で確信が持てないため1倍にとどめた。',
      counter: '25日線を割ってレンジ下限を試す動きが出たら外れ。',
      stop_price: 39100, stop_rule: 'atr20x2.0',
    },
    {
      id: '2026-07-28-close', decided_on: '2026-07-28', executed_on: '2026-07-29',
      side: 'sell', symbol: '1321', qty: 24, price: 40180, entry_price: 41250,
      pnl: -25680, exit_reason: 'stop',
    },
    {
      id: '2026-08-01-open', decided_on: '2026-08-01', executed_on: '2026-08-04',
      side: 'buy', symbol: '1570', qty: 30, price: 29800, confidence_pct: 71,
      reason: '20日高値を更新し200日線からの乖離も拡大中。外国人が3週連続で買い越しに転じており、価格と需給が揃った。2倍で取りにいく。',
      counter: '25日線を明確に割り込んだら読みが外れる。VIXが20を超える急変も想定外。',
      stop_price: 27900, stop_rule: 'atr20x2.0',
    },
    {
      id: '2026-08-07-close', decided_on: '2026-08-07', executed_on: '2026-08-08',
      side: 'sell', symbol: '1570', qty: 30, price: 32450, entry_price: 29800,
      pnl: 79500, exit_reason: 'signal',
    },
    {
      id: '2026-08-09-open', decided_on: '2026-08-09', executed_on: '2026-08-12',
      side: 'buy', symbol: '1357', qty: 320, price: 2805, confidence_pct: 55,
      reason: '20日高値から失速して高安構造がレンジに戻った。信用買い残が厚く戻り売りが出やすい。確信は高くないので数量を抑えた。対照群はブルだが、価格の失速を重く見て外した。',
      counter: '25日線を回復して高値を再更新したら外れ。CFTCのネット買いが続いている点は逆風。',
      stop_price: 2610, stop_rule: 'atr20x2.5',
    },
  ],
  equity_curve: [
    { date: '2026-07-22', equity: 1000000 },
    { date: '2026-07-25', equity: 991200 },
    { date: '2026-07-29', equity: 974320 },
    { date: '2026-08-04', equity: 978100 },
    { date: '2026-08-06', equity: 1012400 },
    { date: '2026-08-08', equity: 1053820 },
    { date: '2026-08-09', equity: 1049600 },
  ],
  stats: {
    closed_trades: 2, win_rate: 0.5, expectancy: 26910, max_drawdown_pct: -2.57,
    stop_then_reversed: 1,
    baseline: { win_rate: 0.4, expectancy: 12800, max_drawdown_pct: -4.1 },
  },
}

/** 保有なし・履歴なし（動き始めの状態） */
const EMPTY: RoboAccount = {
  ...BASE,
  cash: 1000000,
  position: null,
  trades: [],
  equity_curve: [{ date: '2026-08-09', equity: 1000000 }],
  stats: { closed_trades: 0, win_rate: null, expectancy: null, max_drawdown_pct: null, stop_then_reversed: 0, baseline: null },
  divergences: [],
  last_synced_file_id: null,
}

/** 負けが込んでいる状態（マイナス表示・対照群に負けている見た目の確認用） */
const LOSS: RoboAccount = {
  ...FULL,
  cash: 148200,
  position: { symbol: '1571', qty: 620, avg_price: 298, stop_price: 274, stop_rule: 'atr20x3.0', opened_on: '2026-08-09' },
  equity_curve: [
    { date: '2026-07-22', equity: 1000000 },
    { date: '2026-07-29', equity: 942000 },
    { date: '2026-08-04', equity: 901500 },
    { date: '2026-08-08', equity: 878300 },
    { date: '2026-08-09', equity: 883960 },
  ],
  stats: {
    closed_trades: 7, win_rate: 0.29, expectancy: -16600, max_drawdown_pct: -12.17,
    stop_then_reversed: 3,
    baseline: { win_rate: 0.43, expectancy: 9400, max_drawdown_pct: -8.8 },
  },
}

export function demoAccount(mode: string): RoboAccount {
  if (mode === 'empty') return EMPTY
  if (mode === 'loss') return LOSS
  return FULL
}
