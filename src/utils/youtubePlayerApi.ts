declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement | string, cfg: YTPlayerConfig) => YTPlayer
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 }
    }
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setVolume(vol: number): void
  getVolume(): number
  mute(): void
  unMute(): void
  isMuted(): boolean
  loadVideoById(id: string, start?: number): void
  cueVideoById(id: string, start?: number): void
  destroy(): void
}

interface YTPlayerConfig {
  videoId?: string
  width?: number | string
  height?: number | string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: YTPlayer }) => void
    onStateChange?: (e: { data: number; target: YTPlayer }) => void
    onError?: (e: { data: number }) => void
  }
}

let apiReady = false
let apiLoading = false
const waiters: (() => void)[] = []

export function loadYouTubeApi(): Promise<void> {
  if (apiReady) return Promise.resolve()
  return new Promise(resolve => {
    waiters.push(resolve)
    if (apiLoading) return
    apiLoading = true

    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      apiReady = true
      prev?.()
      waiters.forEach(cb => cb())
      waiters.length = 0
    }

    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
}
