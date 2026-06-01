export type PoiroboAlertConfig = {
  majorSq:         boolean
  miniSq:          boolean
  fomc:            boolean
  boj:             boolean
  nfp:             boolean
  adp:             boolean
  cpi:             boolean
  pce:             boolean
  ism:             boolean
  tankan:          boolean
  saishu:          boolean
  ochi:            boolean
  kakutei:         boolean
  january_effect:  boolean
  setsubun_top:    boolean
  nisa_day:        boolean
  higan_bottom:    boolean
  new_fiscal_year: boolean
  sell_in_may:     boolean
  investment_day:  boolean
  xmas_rally:      boolean
  tax_loss_selling: boolean
}

export const POIROBO_ALERT_CONFIG_DEFAULT: PoiroboAlertConfig = {
  majorSq:         true,
  miniSq:          true,
  fomc:            false,
  boj:             false,
  nfp:             false,
  adp:             false,
  cpi:             false,
  pce:             false,
  ism:             false,
  tankan:          false,
  saishu:          false,
  ochi:            false,
  kakutei:         false,
  january_effect:  false,
  setsubun_top:    false,
  nisa_day:        false,
  higan_bottom:    false,
  new_fiscal_year: false,
  sell_in_may:     false,
  investment_day:  false,
  xmas_rally:      false,
  tax_loss_selling: false,
}

export type AppSettings = {
  theme: 'dark' | 'light'
  darkStyle: 'neutral' | 'blue'
  showPrivate: boolean
  showAnomaly: boolean
  showPoiroboAlert: boolean
  poiroboAlertConfig: PoiroboAlertConfig
}

const KEY = 'poical-settings'

const DEFAULTS: AppSettings = {
  theme: 'dark',
  darkStyle: 'neutral',
  showPrivate: true,
  showAnomaly: false,
  showPoiroboAlert: false,
  poiroboAlertConfig: POIROBO_ALERT_CONFIG_DEFAULT,
}

export function getSettings(): AppSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
