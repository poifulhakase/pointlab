/**
 * トークルームの壁紙を「いまの天気」に合わせるための取得と判定（2026-09-13 新設）。
 *
 * 🔵 運用者の指示＝**地点は東京で決め打ち**。位置情報の許可を求めない
 *    （許可の画面を出さずに済み、二人とも同じ景色になる）。
 * 🔵 取得元は Open-Meteo。申し込みも鍵も要らず、ブラウザから直接叩ける。
 * 🔴 取れなかったら**何もしない**（前の見た目のまま）。壁紙のために会話を止めない。
 */

/** 東京（都庁）。 */
const LAT = 35.6895
const LON = 139.6917

const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  '&current=weather_code,is_day&timezone=Asia%2FTokyo'

/** 読み直す間隔。天気は分単位では変わらないので長めでよい。 */
export const REFRESH_MS = 30 * 60 * 1000

/** 壁紙で描き分ける5種類。 */
export type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'storm'

export type Weather = {
  kind: WeatherKind
  /** 昼か（晴れのとき、太陽と月を描き分ける）。 */
  day: boolean
}

/**
 * WMO の天気コードを5種類に寄せる（純粋関数・テスト対象）。
 *
 * 🔵 表は https://open-meteo.com/en/docs の weather_code。
 *    細かく分かれているが、壁紙で描き分けられるのは5つまで。
 * 🔴 **霧（45・48）はくもり扱い**。白くかすませる絵を別に作っても、
 *    小さい画面では「くもり」との区別がつかない。
 */
export function kindOf(code: number): WeatherKind {
  if (code >= 95) return 'storm'                 // 95-99 雷雨
  if (code >= 71 && code <= 77) return 'snow'    // 71-77 雪
  if (code >= 85 && code <= 86) return 'snow'    // 85-86 にわか雪
  if (code >= 80 && code <= 82) return 'rain'    // 80-82 にわか雨
  if (code >= 51 && code <= 67) return 'rain'    // 51-67 霧雨・雨・着氷性の雨
  if (code >= 45 && code <= 48) return 'cloudy'  // 45-48 霧
  if (code >= 1 && code <= 3) return 'cloudy'    // 1-3 晴れ時々くもり〜くもり
  return 'sunny'                                 // 0 快晴（範囲外もここへ落とす）
}

/**
 * 雨・雪の強さを、コードから3段階で返す（純粋関数・テスト対象）。
 *
 * 🔵 粒の数と流れる頻度に使う。強い雨をいつもの量で描くと、外を見た感じと合わない。
 */
export function strengthOf(code: number): 'weak' | 'normal' | 'heavy' {
  // 霧雨（51-57）と弱いにわか雨（80）は弱い
  if ((code >= 51 && code <= 57) || code === 80 || code === 71 || code === 85) return 'weak'
  // 強い雨（65・67・82）と大雪（75・86）と雷雨（95-99）は強い
  if (code === 65 || code === 67 || code === 82 || code === 75 || code === 86 || code >= 95) return 'heavy'
  return 'normal'
}

/**
 * 実際に描く壁紙は3種類（2026-09-13 運用者の採用＝晴れ・くもり・雨）。
 *
 * 🔵 雪と雷の絵はまだ作っていないので、近いものへ寄せる：
 *    **雪はくもり／雷は雨**。東京では年に数日なので、まずはこれで足りる。
 */
export type Wallpaper = 'sunny' | 'cloudy' | 'rain'

/** 天気の種類 → 実際に描く壁紙（純粋関数・テスト対象）。 */
export function wallpaperOf(kind: WeatherKind): Wallpaper {
  if (kind === 'rain' || kind === 'storm') return 'rain'
  if (kind === 'cloudy' || kind === 'snow') return 'cloudy'
  return 'sunny'
}

/**
 * いまの天気を取りに行く。取れなければ null。
 *
 * 🔴 呼ぶ側は null を「変えない」と読むこと。既定値へ戻すと、
 *    通信が不安定なときに壁紙が行ったり来たりする。
 */
export async function fetchWeather(signal?: AbortSignal): Promise<(Weather & { code: number }) | null> {
  try {
    const res = await fetch(URL, { signal })
    if (!res.ok) return null
    const json = await res.json() as { current?: { weather_code?: number, is_day?: number } }
    const code = json.current?.weather_code
    if (typeof code !== 'number') return null
    return { code, kind: kindOf(code), day: json.current?.is_day !== 0 }
  } catch {
    // 圏外・遮断・中断。黙って諦める（会話には関係がない）
    return null
  }
}
