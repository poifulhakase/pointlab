export type AppSettings = {
  browserNotifEnabled: boolean
  emailEnabled: boolean
  email: string
  emailjsServiceId: string
  emailjsTemplateId: string
  emailjsPublicKey: string
  theme: 'dark' | 'light'
}

const KEY = 'poical-settings'

const DEFAULTS: AppSettings = {
  browserNotifEnabled: false,
  emailEnabled: false,
  email: '',
  emailjsServiceId: '',
  emailjsTemplateId: '',
  emailjsPublicKey: '',
  theme: 'dark',
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
