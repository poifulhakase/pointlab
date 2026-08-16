// 地下室ページの動き。
//
// 🔵 中身は画面共通の `src/hooks/useMotion.ts` に移した（2026-08-16）。
//    モメンタム銘柄の画面でも同じ動きを使うため、実装を2つに増やさない。
//    ここは地下室側の入口として残してある（import 先を変えて回らないように）。

export { reduceMotion, useInView, useCountUp } from '../hooks/useMotion'
