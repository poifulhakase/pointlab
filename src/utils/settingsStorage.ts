export type AppSettings = {
  browserNotifEnabled: boolean
  theme: 'dark' | 'light'
  showPrivate: boolean
}

const KEY = 'poical-settings'

const DEFAULTS: AppSettings = {
  browserNotifEnabled: false,
  theme: 'dark',
  showPrivate: true,
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
