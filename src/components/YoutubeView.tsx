import { useState, useEffect, useRef } from 'react'
import { themeVars } from '../utils/themeVars'
import { loadYouTubeApi, type YTPlayer } from '../utils/youtubePlayerApi'
import { type Video, fetchVideoList, getVideoCacheInfo, resolveChannel, fetchChannelName } from '../utils/youtubeProxy'
import { type YtPlayInfo } from './MiniPlayer'

type Channel = { id: string; name: string }

const MAX_CHANNELS = 5
const STORAGE_KEY = 'poical-yt-channels'

function loadChannels(): Channel[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') }
  catch { return [] }
}
function saveChannels(chs: Channel[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chs))
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function YoutubeView({
  theme, isMobile, isVisible = true, onPlayStateChange, onChannelsSaved,
}: {
  theme: 'dark' | 'light'
  isMobile: boolean
  isVisible?: boolean
  onPlayStateChange?: (info: YtPlayInfo | null) => void
  onChannelsSaved?: (channels: Channel[]) => void
}) {
  const v = themeVars(theme)

  // ── channels ──────────────────────────────────────────────
  const [channels, setChannels]         = useState<Channel[]>(loadChannels)
  const [activeIdx, setActiveIdx]       = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newId, setNewId]               = useState('')
  const [resolving, setResolving]       = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [manualMode, setManualMode]         = useState(false)
  const [manualChannelId, setManualChannelId] = useState('')

  const active = channels[activeIdx] ?? null

  // ── videos ────────────────────────────────────────────────
  const [videos, setVideos]                   = useState<Video[]>([])
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [loadingVideos, setLoadingVideos]     = useState(false)
  const [videoError, setVideoError]           = useState('')
  const [cacheTime, setCacheTime]             = useState<Date | null>(null)
  const [hoveredVideoId, setHoveredVideoId]   = useState<string | null>(null)
  const [failedThumbs, setFailedThumbs]       = useState<Set<string>>(() => new Set())

  // ── YT player ─────────────────────────────────────────────
  const playerRef        = useRef<YTPlayer | null>(null)
  const playerDivRef     = useRef<HTMLDivElement>(null)
  const [apiReady, setApiReady]       = useState(false)
  const [ytState, setYtState]         = useState(-1) // YT.PlayerState
  const currentTimeRef   = useRef(0)
  const playingVideoRef  = useRef<string | null>(null)
  const prevVisibleRef   = useRef(isVisible)
  // 常に最新値を参照するための ref（クロージャ stale 回避）
  const videosRef           = useRef(videos)
  const onPlayStateChangeRef = useRef(onPlayStateChange)
  useEffect(() => { videosRef.current = videos }, [videos])
  useEffect(() => { onPlayStateChangeRef.current = onPlayStateChange }, [onPlayStateChange])

  // Load IFrame API once
  useEffect(() => {
    loadYouTubeApi().then(() => setApiReady(true))
  }, [])

  // Fetch videos when channel changes
  useEffect(() => {
    if (!active) { setVideos([]); setSelectedVideoId(null); setVideoError(''); setCacheTime(null); return }
    const ac = new AbortController()
    setLoadingVideos(true); setVideos([]); setSelectedVideoId(null); setVideoError('')

    // Destroy old player on channel change
    playerRef.current?.destroy()
    playerRef.current = null
    playingVideoRef.current = null
    onPlayStateChange?.(null)

    fetchVideoList(active.id)
      .then(vids => {
        if (ac.signal.aborted) return
        setVideos(vids)
        if (vids.length > 0) setSelectedVideoId(vids[0].id)
        setCacheTime(getVideoCacheInfo(active.id)?.fetchedAt ?? new Date())
        setFailedThumbs(new Set())
      })
      .catch(e => { if (!ac.signal.aborted) setVideoError(e instanceof Error ? e.message : '動画を取得できませんでした') })
      .finally(() => { if (!ac.signal.aborted) setLoadingVideos(false) })

    return () => ac.abort()
  }, [active?.id])

  // YT プレイヤー作成（videoId 変化時）
  useEffect(() => {
    if (!selectedVideoId || !apiReady || !playerDivRef.current) return

    if (playerRef.current && playingVideoRef.current) {
      // 既存プレイヤーに新しい動画をロード（再生成不要）
      playerRef.current.loadVideoById(selectedVideoId)
      playingVideoRef.current = selectedVideoId
      return
    }

    // 新規プレイヤー作成
    playerDivRef.current.innerHTML = ''
    const div = document.createElement('div')
    playerDivRef.current.appendChild(div)

    const player = new window.YT.Player(div, {
      width: '100%',
      height: '100%',
      videoId: selectedVideoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        enablejsapi: 1,
      },
      events: {
        onStateChange: (e) => {
          setYtState(e.data)
          const vid = playingVideoRef.current
          if (e.data === 1) { // PLAYING
            const t = e.target.getCurrentTime()
            currentTimeRef.current = t
            const title = vid ? (videosRef.current.find(v => v.id === vid)?.title ?? '') : ''
            if (vid) onPlayStateChangeRef.current?.({ videoId: vid, title, time: t })
          } else if (e.data === 0) { // ENDED
            onPlayStateChangeRef.current?.(null)
          }
        },
      },
    })
    playerRef.current = player
    playingVideoRef.current = selectedVideoId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId, apiReady])

  // 再生中は2秒ごとに現在位置を親に通知
  useEffect(() => {
    if (ytState !== 1) return
    const t = setInterval(() => {
      if (!playerRef.current) return
      const time = playerRef.current.getCurrentTime()
      currentTimeRef.current = time
      const vid = playingVideoRef.current
      if (vid) {
        const title = videosRef.current.find(v => v.id === vid)?.title ?? ''
        onPlayStateChangeRef.current?.({ videoId: vid, title, time })
      }
    }, 2000)
    return () => clearInterval(t)
  }, [ytState])

  // ビュー切替時: ポーズ / レジューム
  useEffect(() => {
    if (prevVisibleRef.current === isVisible) return
    prevVisibleRef.current = isVisible

    if (!playerRef.current) return

    if (!isVisible) {
      const state = playerRef.current.getPlayerState()
      if (state === 1) { // 再生中 → ポーズして位置を親に通知
        const time = playerRef.current.getCurrentTime()
        currentTimeRef.current = time
        playerRef.current.pauseVideo()
        const vid = playingVideoRef.current
        if (vid) {
          const title = videosRef.current.find(v => v.id === vid)?.title ?? ''
          onPlayStateChangeRef.current?.({ videoId: vid, title, time })
        }
      }
    } else {
      // ムービービューに戻った → 自動レジューム
      const state = playerRef.current.getPlayerState()
      if (state === 2) playerRef.current.playVideo()
    }
  }, [isVisible])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

  // ── channel actions ───────────────────────────────────────
  async function retryLoad() {
    if (!active) return
    setVideoError(''); setLoadingVideos(true)
    try {
      const vids = await fetchVideoList(active.id, true)
      setVideos(vids)
      if (vids.length > 0) setSelectedVideoId(vids[0].id)
      setCacheTime(new Date())
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : '取得失敗')
    } finally {
      setLoadingVideos(false)
    }
  }

  async function addChannel() {
    if (!newId.trim() || channels.length >= MAX_CHANNELS) return
    setResolving(true); setResolveError('')
    try {
      const { id, name } = await resolveChannel(newId)
      if (channels.some(c => c.id === id)) {
        setResolveError('このチャンネルはすでに登録済みです')
        return
      }
      const updated = [...channels, { id, name }]
      setChannels(updated); saveChannels(updated); onChannelsSaved?.(updated)
      setActiveIdx(updated.length - 1); setNewId('')
    } catch {
      setManualMode(true); setManualChannelId('')
    } finally {
      setResolving(false)
    }
  }

  function deriveNameFromInput(channelId: string): string {
    const m = newId.match(/\/@?([A-Za-z0-9_.-]+)/)
    if (m) return `@${m[1]}`
    if (newId.trim().startsWith('@')) return newId.trim()
    return channelId
  }

  async function addChannelManual() {
    const id = manualChannelId.trim()
    if (!id) return
    setResolving(true)
    let name: string
    try { name = await fetchChannelName(id) }
    catch { name = deriveNameFromInput(id) }
    finally { setResolving(false) }
    if (channels.some(c => c.id === id)) { setResolveError('このチャンネルはすでに登録済みです'); return }
    const updated = [...channels, { id, name }]
    setChannels(updated); saveChannels(updated); onChannelsSaved?.(updated)
    setActiveIdx(updated.length - 1); setManualMode(false); setManualChannelId(''); setNewId('')
  }

  async function refreshChannelName(idx: number) {
    const ch = channels[idx]
    try {
      const name = await fetchChannelName(ch.id)
      const updated = channels.map((c, i) => i === idx ? { ...c, name } : c)
      setChannels(updated); saveChannels(updated); onChannelsSaved?.(updated)
    } catch { /* ignore */ }
  }

  function removeChannel(idx: number) {
    const updated = channels.filter((_, i) => i !== idx)
    setChannels(updated); saveChannels(updated); onChannelsSaved?.(updated)
    setActiveIdx(prev => Math.min(prev, Math.max(0, updated.length - 1)))
  }

  const canAddChannel = channels.length < MAX_CHANNELS

  // ── video list click ──────────────────────────────────────
  function selectVideo(id: string) {
    if (id === selectedVideoId && playerRef.current) {
      // Already selected – toggle play/pause
      const state = playerRef.current.getPlayerState()
      if (state === 1) playerRef.current.pauseVideo()
      else playerRef.current.playVideo()
      return
    }
    setSelectedVideoId(id)
  }

  // ── layout parts ──────────────────────────────────────────
  const tabBar = (
    <>
      <div style={s.tabGroup} className="glass">
        {channels.map((ch, i) => (
          <button
            key={ch.id}
            style={{ ...s.tab, ...(i === activeIdx ? s.tabActive : {}) }}
            onClick={() => setActiveIdx(i)}
          >
            {ch.name}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {active && (
          <button
            style={{ ...s.iconBtn, opacity: loadingVideos ? 0.4 : 1 }}
            onClick={retryLoad}
            disabled={loadingVideos}
            title="新着動画を取得"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={loadingVideos ? { animation: 'spin 0.8s linear infinite' } : {}}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        )}
        <button style={s.iconBtn} onClick={() => setSettingsOpen(true)} title="チャンネル設定">
          <GearIcon />
        </button>
      </div>
    </>
  )

  const playerArea = (
    <div style={s.playerDiv} ref={playerDivRef}>
      {!selectedVideoId && (
        <div style={s.placeholder}>
          <div style={s.placeholderIcon}>▶</div>
          <p style={s.placeholderText}>{loadingVideos ? '読み込み中…' : '動画を選択してください'}</p>
        </div>
      )}
    </div>
  )

  const videoList = (
    <>
      {loadingVideos ? (
        <div style={s.listMsg}>読み込み中…</div>
      ) : videoError ? (
        <div style={s.listMsg}>
          <p>動画を取得できませんでした</p>
          <button style={s.retryBtn} onClick={retryLoad}>再試行</button>
        </div>
      ) : videos.map(v => (
        <button
          key={v.id}
          style={{
            ...s.videoItem,
            ...(v.id === selectedVideoId ? s.videoItemActive : {}),
            ...(v.id === hoveredVideoId && v.id !== selectedVideoId ? s.videoItemHover : {}),
          }}
          onClick={() => selectVideo(v.id)}
          onMouseEnter={() => setHoveredVideoId(v.id)}
          onMouseLeave={() => setHoveredVideoId(null)}
        >
          <div style={s.thumbWrap}>
            {failedThumbs.has(v.id) ? (
              <div style={s.thumbFallback}>▶</div>
            ) : (
              <img
                src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                style={s.thumb}
                alt={v.title}
                loading="lazy"
                onError={() => setFailedThumbs(prev => { const n = new Set(prev); n.add(v.id); return n })}
              />
            )}
            {v.id === selectedVideoId && ytState === 1 && (
              <div style={s.playingBadge}>▶ 再生中</div>
            )}
          </div>
          <div style={s.videoInfo}>
            <span style={s.videoTitle}>{v.title}</span>
            <span style={s.videoDate}>{formatDate(v.published)}</span>
          </div>
        </button>
      ))}
      {cacheTime && !loadingVideos && !videoError && (
        <div style={s.cacheInfo}>
          取得: {cacheTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </>
  )

  return (
    <div style={{ ...s.wrap, ...v }}>
      {isMobile ? (
        <>
          <div style={s.mobileScroll}>
            {channels.length === 0 ? (
              <div style={{ ...s.empty, minHeight: 300 }}>
                <EmptyChannels onAdd={() => setSettingsOpen(true)} />
              </div>
            ) : (
              <>
                <div style={s.mobilePlayer}>
                  <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', position: 'relative' as const }}>
                    {playerArea}
                  </div>
                </div>
                {selectedVideoId && (
                  <div style={s.mobileTitle}>
                    {videos.find(v => v.id === selectedVideoId)?.title ?? ''}
                  </div>
                )}
                <div style={{ ...s.videoListWrap, borderLeft: 'none', borderTop: '1px solid var(--border-dim)' }}>
                  {videoList}
                </div>
              </>
            )}
          </div>
          <div style={s.mobileTabBar} className="glass">{tabBar}</div>
        </>
      ) : (
        <>
          <div style={s.tabBarRow} className="glass">{tabBar}</div>
          <div style={s.main}>
            {channels.length === 0 ? (
              <div style={s.empty}>
                <EmptyChannels onAdd={() => setSettingsOpen(true)} />
              </div>
            ) : (
              <>
                <div style={s.playerCol}>
                  <div style={s.playerWrap}>{playerArea}</div>
                  {selectedVideoId && (
                    <div style={s.playerTitle}>
                      {videos.find(v => v.id === selectedVideoId)?.title ?? ''}
                    </div>
                  )}
                </div>
                <div style={s.videoListWrap}>{videoList}</div>
              </>
            )}
          </div>
        </>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <div style={s.overlay} onClick={() => setSettingsOpen(false)}>
          <div style={s.modal} className="glass" onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>YouTubeチャンネル設定</span>
              <button style={s.closeBtn} onClick={() => setSettingsOpen(false)}>✕</button>
            </div>

            {/* Registered channels */}
            {channels.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionLabel}>
                  登録済みチャンネル
                  <span style={{ fontWeight: 400, color: 'var(--text-dim)', marginLeft: 8 }}>
                    {channels.length} / {MAX_CHANNELS}
                  </span>
                </div>
                {channels.map((ch, i) => (
                  <div key={ch.id} style={s.channelRow}>
                    <div style={s.channelInfo}>
                      <span style={s.channelName}>{ch.name}</span>
                      <span style={s.channelId}>{ch.id}</span>
                    </div>
                    <button style={s.refreshBtn} onClick={() => refreshChannelName(i)} title="チャンネル名を再取得">↻</button>
                    <button style={s.deleteBtn} onClick={() => removeChannel(i)}>削除</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add channel */}
            <div style={s.section}>
              <div style={s.sectionLabel}>チャンネルを追加</div>
              {!canAddChannel ? (
                <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.9)' }}>
                  登録上限（{MAX_CHANNELS}チャンネル）に達しています。削除してから追加してください。
                </p>
              ) : !manualMode ? (
                <>
                  <div style={s.inputRow}>
                    <input
                      style={{ ...s.input, flex: 1 }}
                      value={newId}
                      onChange={e => { setNewId(e.target.value); setResolveError('') }}
                      placeholder="チャンネルURL・ID・@ハンドル"
                      onKeyDown={e => e.key === 'Enter' && !resolving && addChannel()}
                      disabled={resolving}
                    />
                    <button
                      style={{ ...s.addBtn, ...(!newId.trim() || resolving ? s.addBtnDisabled : {}) }}
                      onClick={addChannel}
                      disabled={!newId.trim() || resolving}
                    >
                      {resolving ? '取得中…' : '追加'}
                    </button>
                  </div>
                  {resolveError && <p style={s.errorText}>{resolveError}</p>}
                  <p style={s.hint}>チャンネルID（UCxxxx）・URL・@ハンドルに対応。チャンネル名を自動取得します。</p>
                </>
              ) : (
                <>
                  <p style={s.manualNote}>自動取得に失敗しました。チャンネルIDを直接入力してください。</p>
                  <div style={s.inputRow}>
                    <input
                      style={{ ...s.input, flex: 1 }}
                      value={manualChannelId}
                      onChange={e => setManualChannelId(e.target.value)}
                      placeholder="チャンネルID（UCxxxxxxxxxxxxxxxx）"
                      onKeyDown={e => e.key === 'Enter' && addChannelManual()}
                      autoFocus
                    />
                    <button
                      style={{ ...s.addBtn, ...(!manualChannelId.trim() ? s.addBtnDisabled : {}) }}
                      onClick={addChannelManual}
                      disabled={!manualChannelId.trim()}
                    >
                      追加
                    </button>
                    <button style={s.cancelBtn} onClick={() => { setManualMode(false); setManualChannelId(''); setResolveError('') }}>
                      キャンセル
                    </button>
                  </div>
                  {resolveError && <p style={s.errorText}>{resolveError}</p>}
                  <p style={s.hint}>チャンネルページ →「概要」→「チャンネル情報」→「チャンネル ID をコピー」</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyChannels({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      <div style={{ fontSize: 48, opacity: 0.25 }}>▶</div>
      <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>チャンネルが登録されていません</p>
      <button
        style={{ padding: '8px 20px', borderRadius: 20, background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.32)', color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}
        onClick={onAdd}
      >
        + チャンネルを追加
      </button>
    </>
  )
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' },
  mobileScroll: {
    flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
    display: 'flex', flexDirection: 'column', paddingBottom: 56,
  },
  mobilePlayer: { width: '100%', flexShrink: 0, background: '#000' },
  mobileTitle: {
    padding: '8px 12px', fontSize: 14, fontWeight: 600,
    color: 'var(--text)', lineHeight: 1.4,
  },
  mobileTabBar: {
    position: 'fixed', bottom: 'var(--header-height)', left: 0, right: 0, zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px', gap: 6, borderTop: '1px solid var(--border-dim)',
    userSelect: 'none', background: 'var(--modal-bg)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  },
  tabBarRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px', gap: 6, flexShrink: 0,
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
    userSelect: 'none',
  },
  tabGroup: { display: 'flex', borderRadius: 10, overflow: 'hidden', padding: 3, gap: 2 },
  tab: {
    padding: '5px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500,
    color: 'var(--text-sub)', transition: 'background 0.15s, color 0.15s', cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)',
    boxShadow: '0 2px 8px rgba(100,120,200,0.15)',
  },
  iconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8, color: 'var(--text-sub)', flexShrink: 0,
  },
  main: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', padding: '10px 14px 14px', gap: 8 },
  playerCol: {
    flex: '1 1 60%', maxWidth: 1300, minWidth: 0, minHeight: 0,
    display: 'flex', flexDirection: 'column',
  },
  playerWrap: {
    flex: '1 1 0', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#000', borderRadius: 10, overflow: 'hidden', position: 'relative',
  },
  playerDiv: {
    width: '100%', height: '100%', position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  placeholder: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  placeholderIcon: { fontSize: 48, opacity: 0.2 },
  placeholderText: { color: 'var(--text-dim)', fontSize: 14 },
  playerTitle: {
    padding: '10px 16px', flexShrink: 0, fontSize: 20, fontWeight: 600,
    color: 'var(--text)', background: 'var(--glass-bg)', borderTop: '1px solid var(--border-dim)',
    lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  videoListWrap: {
    flex: '1 1 0', minWidth: 260, overflowY: 'auto', overflowX: 'hidden',
    borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column',
  },
  listMsg: {
    padding: 20, fontSize: 13, color: 'var(--text-dim)',
    textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10,
  },
  retryBtn: {
    padding: '5px 14px', borderRadius: 20, fontSize: 12, margin: '0 auto',
    background: 'var(--bg-subtle)', border: '1px solid var(--border-dim)',
    color: 'var(--text-sub)', cursor: 'pointer',
  },
  videoItem: {
    display: 'flex', flexDirection: 'row', gap: 10, padding: '8px 10px',
    textAlign: 'left', borderBottom: '1px solid var(--border-dim)',
    cursor: 'pointer', transition: 'background 0.12s', alignItems: 'flex-start',
  },
  videoItemActive: { background: 'var(--bg-subtle)' },
  videoItemHover:  { background: 'var(--glass-bg)' },
  thumbWrap: { width: 120, aspectRatio: '16/9', overflow: 'hidden', borderRadius: 5, flexShrink: 0, position: 'relative' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbFallback: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', fontSize: 20,
  },
  playingBadge: {
    position: 'absolute', bottom: 3, left: 3,
    fontSize: 9, fontWeight: 700, color: '#fff',
    background: 'rgba(255,0,0,0.85)', borderRadius: 3, padding: '1px 4px',
  },
  videoInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  videoTitle: {
    fontSize: 13, fontWeight: 600, color: 'var(--text)',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    overflow: 'hidden', lineHeight: 1.4,
  },
  videoDate: { fontSize: 11, color: 'var(--text-dim)' },
  cacheInfo: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    padding: '6px 10px', borderTop: '1px solid var(--border-dim)',
    fontSize: 10, color: 'var(--text-dim)',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    flex: 1, gap: 16,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)', zIndex: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: 460, maxWidth: 'calc(100vw - 32px)', borderRadius: 16, padding: '20px 24px',
    background: 'var(--modal-bg)', display: 'flex', flexDirection: 'column', gap: 16,
    maxHeight: 'calc(100vh - 64px)', overflowY: 'auto',
  },
  modalHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle:   { fontSize: 16, fontWeight: 700, color: 'var(--text)' },
  closeBtn: {
    width: 28, height: 28, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-sub)', fontSize: 15,
  },
  section:      { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
    color: 'var(--text-sub)', textTransform: 'uppercase', display: 'flex', alignItems: 'center',
  },
  channelRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
    background: 'var(--bg-item)', border: '1px solid var(--border-dim)',
  },
  channelInfo:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  channelName:  { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  channelId: {
    fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  refreshBtn: {
    padding: '3px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.12)',
    border: '1px solid rgba(96,165,250,0.25)', color: 'var(--accent)',
    fontSize: 14, fontWeight: 600, flexShrink: 0, cursor: 'pointer',
  },
  deleteBtn: {
    padding: '3px 10px', borderRadius: 6, background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.25)', color: 'rgba(248,113,113,0.85)',
    fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  inputRow: { display: 'flex', gap: 8, alignItems: 'center' },
  input: {
    padding: '8px 12px', background: 'var(--bg-subtle)', border: '1px solid var(--border-dim)',
    borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
    outline: 'none', minWidth: 0,
  },
  addBtn: {
    padding: '8px 16px', borderRadius: 8, flexShrink: 0,
    background: 'rgba(96,165,250,0.18)', border: '1px solid rgba(96,165,250,0.35)',
    color: 'var(--accent)', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
  },
  addBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  cancelBtn: {
    padding: '8px 16px', borderRadius: 8, flexShrink: 0,
    background: 'var(--bg-subtle)', border: '1px solid var(--border-dim)',
    color: 'var(--text-sub)', fontSize: 13, fontWeight: 600,
  },
  errorText:  { fontSize: 12, color: 'rgba(248,113,113,0.85)' },
  manualNote: { fontSize: 12, color: 'rgba(251,191,36,0.9)', lineHeight: 1.5 },
  hint:       { fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 },
}
