const SESSION_KEY = 'poical-session'

export function isGuestAuthed(): boolean {
  return localStorage.getItem(SESSION_KEY) === 'guest'
}

export function guestLogin(id: string, password: string): boolean {
  const validId = import.meta.env.VITE_GUEST_ID?.trim()
  const validPw = import.meta.env.VITE_GUEST_PASSWORD?.trim()
  if (id === validId && password === validPw) {
    localStorage.setItem(SESSION_KEY, 'guest')
    return true
  }
  return false
}

export function guestLogout(): void {
  localStorage.removeItem(SESSION_KEY)
}
