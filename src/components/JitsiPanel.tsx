import { useEffect, useRef, useState } from 'react'

export type ConnectUser = { uid: string; displayName: string | null; email: string | null; photoURL?: string | null }

type JitsiAPI = {
  dispose(): void
  addListener(event: string, fn: (...args: unknown[]) => void): void
  executeCommand(command: string, ...args: unknown[]): void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, opts: Record<string, unknown>) => JitsiAPI
  }
}

type Props = {
  user: ConnectUser
  isMobile: boolean
  minimized: boolean
  onMinimize: () => void
  onExpand: () => void
  onClose: () => void
}

export function JitsiPanel({ user, isMobile, minimized, onMinimize, onExpand, onClose }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const participantRef = useRef(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'full'>('loading')

  const shortRoom   = `poirobo-${user.uid.substring(0, 12)}`
  const isAdmin     = user.email === 'sushi.ramen.unajyu@gmail.com'
  const displayName = isAdmin ? 'ぽいふる博士' : (user.displayName ?? 'ユーザー')
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const toolbarButtons = isIOS
    ? ['microphone', 'hangup']
    : ['microphone', 'desktop', 'hangup']

  useEffect(() => {
    let api: JitsiAPI | null = null
    let cancelled = false

    const init = async () => {
      if (!window.JitsiMeetExternalAPI) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://8x8.vc/external_api.js'
          s.async = true
          s.onload  = () => resolve()
          s.onerror = () => reject(new Error('Script load failed'))
          document.head.appendChild(s)
        })
      }
      if (cancelled || !containerRef.current) return

      const params = new URLSearchParams({
        room:  shortRoom,
        name:  displayName,
        email: user.email ?? '',
        uid:   user.uid,
      })
      const res = await fetch(`/api/jitsi-token?${params}`)
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
      const { token } = await res.json() as { token: string }
      if (cancelled || !containerRef.current) return

      const appId    = import.meta.env.VITE_JAAS_APP_ID as string
      const roomName = `${appId}/${shortRoom}`
      const avatarUrl = `${window.location.origin}${import.meta.env.BASE_URL}hakase.png`

      api = new window.JitsiMeetExternalAPI!('8x8.vc', {
        roomName,
        jwt: token,
        parentNode: containerRef.current,
        userInfo: { displayName, avatarUrl },
        configOverwrite: {
          startWithVideoMuted: true,
          startWithAudioMuted: false,
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          disableDeepLinking: true,
          enableWelcomePage: false,
          toolbarButtons,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          DISPLAY_WELCOME_FOOTER: false,
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
          TOOLBAR_BUTTONS: toolbarButtons,
        },
      })

      api.addListener('videoConferenceJoined', () => {
        api?.executeCommand('avatarUrl', avatarUrl)
      })
      api.addListener('participantJoined', (...args: unknown[]) => {
        participantRef.current++
        if (participantRef.current > 2) {
          const p = args[0] as { id: string }
          if (isAdmin) {
            api?.executeCommand('kickParticipant', p.id)
          } else {
            setStatus('full')
            api?.executeCommand('hangup')
          }
        }
      })
      api.addListener('participantLeft', () => { participantRef.current-- })
      api.addListener('readyToClose', onClose)

      if (!cancelled) setStatus('ready')
    }

    init().catch(() => { if (!cancelled) setStatus('error') })

    return () => {
      cancelled = true
      api?.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/*
        メインパネル: minimized=true のとき display:none で視覚上非表示。
        containerRef の DOM ノードは残るため WebRTC 接続（音声）は維持される。
      */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: minimized ? 'none' : 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? 0 : '18px 22px',
        userSelect: 'none',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}>
        <div style={{
          width: '100%', height: '100%',
          maxWidth: isMobile ? undefined : 980,
          maxHeight: isMobile ? undefined : 700,
          background: '#050810',
          border: isMobile ? 'none' : '1px solid rgba(0,242,255,0.18)',
          borderRadius: isMobile ? 0 : 14,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: isMobile ? 'none' : '0 0 70px rgba(0,60,200,0.18), 0 24px 80px rgba(0,0,0,0.75)',
        }}>
          {/* ヘッダーバー */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 14px', flexShrink: 0,
            background: 'rgba(0,10,22,0.97)',
            borderBottom: '1px solid rgba(0,242,255,0.10)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: status === 'ready' ? '#00f2ff' : status === 'error' ? '#ff4444' : 'rgba(0,242,255,0.35)',
              boxShadow: status === 'ready' ? '0 0 8px #00f2ff' : 'none',
              flexShrink: 0, transition: 'all 0.4s',
            }} />
            <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: 'rgba(80,190,255,0.80)', letterSpacing: '0.18em' }}>
              POIROBO CONNECT
            </span>
            <code style={{ fontSize: 9, color: 'rgba(0,242,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
              {shortRoom}
            </code>
            {/* 最小化ボタン */}
            <button
              onClick={onMinimize}
              title="最小化（通話を維持したまま他の画面へ）"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(0,180,255,0.08)',
                border: '1px solid rgba(0,200,255,0.30)',
                color: 'rgba(0,220,255,0.80)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              最小化
            </button>
            {/* 切断ボタン */}
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(200,40,40,0.12)',
                border: '1px solid rgba(200,40,40,0.35)',
                color: '#ff6666', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              切断
            </button>
          </div>

          {/* Jitsi エリア */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {status === 'loading' && (
              <div style={{
                position: 'absolute', inset: 0, background: '#050810', zIndex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: '2.5px solid rgba(0,242,255,0.15)',
                  borderTopColor: '#00f2ff',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ color: 'rgba(0,242,255,0.5)', fontSize: 10, letterSpacing: '0.15em' }}>接続中...</span>
              </div>
            )}
            {status === 'error' && (
              <div style={{
                position: 'absolute', inset: 0, background: '#050810', zIndex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
              }}>
                <span style={{ color: '#ff6666', fontSize: 13 }}>接続に失敗しました</span>
                <button onClick={onClose} style={{
                  padding: '6px 18px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(200,40,40,0.15)', border: '1px solid rgba(200,40,40,0.4)',
                  color: '#ff8888', fontSize: 12, fontWeight: 600,
                }}>閉じる</button>
              </div>
            )}
            {status === 'full' && (
              <div style={{
                position: 'absolute', inset: 0, background: '#050810', zIndex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
              }}>
                <span style={{ color: '#fbbf24', fontSize: 13 }}>現在満員です（最大2名）</span>
                <button onClick={onClose} style={{
                  padding: '6px 18px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(200,140,20,0.15)', border: '1px solid rgba(200,140,20,0.4)',
                  color: '#fbbf24', fontSize: 12, fontWeight: 600,
                }}>閉じる</button>
              </div>
            )}
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* フローティングミニバー（最小化中のみ表示） */}
      {minimized && (
        <div style={{
          position: 'fixed',
          top: 'calc(var(--header-height) + env(safe-area-inset-top, 0px) + 8px)',
          right: 12,
          zIndex: 501,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px 7px 12px',
          background: 'rgba(0,8,20,0.94)',
          border: '1px solid rgba(0,220,255,0.35)',
          borderRadius: 10,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 0 20px rgba(0,200,255,0.18), 0 4px 24px rgba(0,0,0,0.55)',
          userSelect: 'none',
        }}>
          {/* ステータスドット */}
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: status === 'ready' ? '#00f2ff' : 'rgba(0,242,255,0.35)',
            boxShadow: status === 'ready' ? '0 0 8px #00f2ff' : 'none',
            animation: status === 'ready' ? 'jitsiPulse 2s ease-in-out infinite' : 'none',
          }} />
          <style>{`
            @keyframes jitsiPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.45; }
            }
          `}</style>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(80,190,255,0.85)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
            POIROBO CONNECT
          </span>
          {/* 展開ボタン */}
          <button
            onClick={onExpand}
            title="研究室に戻って展開"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
              background: 'rgba(0,180,255,0.10)',
              border: '1px solid rgba(0,200,255,0.32)',
              color: 'rgba(0,220,255,0.85)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
            展開
          </button>
          {/* 切断ボタン */}
          <button
            onClick={onClose}
            title="切断"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 5, cursor: 'pointer',
              background: 'rgba(200,40,40,0.10)',
              border: '1px solid rgba(200,40,40,0.30)',
              color: '#ff6666',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
    </>
  )
}
