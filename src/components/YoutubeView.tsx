import { useState, useEffect } from 'react'
import { themeVars } from '../utils/themeVars'
import { type Video, fetchChannelName, resolveChannel, fetchVideoList, getVideoCacheInfo } from '../utils/youtubeProxy'

type Channel = { id: string; name: string }

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

export function YoutubeView({ theme, isMobile, onChannelsSaved }: {
  theme: 'dark' | 'light'
  isMobile: boolean
  onChannelsSaved?: (channels: Channel[]) => void
}) {
  const [channels, setChannels]         = useState<Channel[]>(loadChannels)
  const [activeIdx, setActiveIdx]       = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newId, setNewId]               = useState('')
  const [resolving, setResolving]       = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [manualMode, setManualMode]         = useState(false)
  const [manualChannelId, setManualChannelId] = useState('')
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null)
  const [failedThumbs, setFailedThumbs]     = useState<Set<string>>(() => new Set())
  const [thumbErr, setThumbErr]             = useState(false)

  const active = channels[activeIdx] ?? null

  const [videos, setVideos]                   = useState<Video[]>([])
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [loadingVideos, setLoadingVideos]     = useState(false)
  const [videoError, setVideoError]           = useState('')
  const [playing, setPlaying]                 = useState(false)
  const [cacheTime, setCacheTime]             = useState<Date | null>(null)

  useEffect(() => {
    if (!active) { setVideos([]); setSelectedVideoId(null); setVideoError(''); setCacheTime(null); return }

    const ac = new AbortController()
    setLoadingVideos(true)
    setVideos([])
    setSelectedVideoId(null)
    setVideoError('')
    setPlaying(false)

    fetchVideoList(active.id) // localStorageキャッシュ使用（TTL 3週間）
      .then(vids => {
        if (ac.signal.aborted) return
        setVideos(vids)
        if (vids.length > 0) setSelectedVideoId(vids[0].id)
        setCacheTime(getVideoCacheInfo(active.id)?.fetchedAt ?? new Date())
        setFailedThumbs(new Set())
        setThumbErr(false)
      })
      .catch(e => {
        if (ac.signal.aborted) return
        setVideoError(e instanceof Error ? e.message : '動画を取得できませんでした')
      })
      .finally(() => { if (!ac.signal.aborted) setLoadingVideos(false) })

    return () => ac.abort()
  }, [active?.id])

  useEffect(() => { setThumbErr(false) }, [selectedVideoId])

  async function retryLoad() {
    if (!active) return
    setVideoError('')
    setLoadingVideos(true)
    try {
      const vids = await fetchVideoList(active.id, true) // 強制フレッシュ
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
    if (!newId.trim()) return
    setResolving(true)
    setResolveError('')
    try {
      const { id, name } = await resolveChannel(newId)
      const updated = [...channels, { id, name }]
      setChannels(updated)
      saveChannels(updated)
      onChannelsSaved?.(updated)
      setActiveIdx(updated.length - 1)
      setNewId('')
    } catch {
      setManualMode(true)
      setManualChannelId('')
      setResolveError('')
    } finally {
      setResolving(false)
    }
  }

  function deriveNameFromInput(channelId: string): string {
    const mHandle = newId.match(/\/@?([A-Za-z0-9_.-]+)/)
    if (mHandle) return `@${mHandle[1]}`
    if (newId.trim().startsWith('@')) return newId.trim()
    return channelId
  }

  async function addChannelManual() {
    const id = manualChannelId.trim()
    if (!id) return
    setResolving(true)
    let name: string
    try {
      name = await fetchChannelName(id)
    } catch {
      name = deriveNameFromInput(id)
    } finally {
      setResolving(false)
    }
    const updated = [...channels, { id, name }]
    setChannels(updated)
    saveChannels(updated)
    onChannelsSaved?.(updated)
    setActiveIdx(updated.length - 1)
    setManualMode(false)
    setManualChannelId('')
    setNewId('')
  }

  async function refreshChannelName(idx: number) {
    const ch = channels[idx]
    try {
      const name    = await fetchChannelName(ch.id)
      const updated = channels.map((c, i) => i === idx ? { ...c, name } : c)
      setChannels(updated)
      saveChannels(updated)
      onChannelsSaved?.(updated)
    } catch { /* 失敗時は何もしない */ }
  }

  function cancelManual() {
    setManualMode(false)
    setManualChannelId('')
    setResolveError('')
  }

  function removeChannel(idx: number) {
    const updated = channels.filter((_, i) => i !== idx)
    setChannels(updated)
    saveChannels(updated)
    onChannelsSaved?.(updated)
    setActiveIdx(prev => Math.min(prev, Math.max(0, updated.length - 1)))
  }

  // ── 共通パーツ：タブバー内容 ─────────────────────────
  const tabBarContent = (
    <>
      <div style={s.tabGroup} className="glass">
        {channels.map((ch, i) => (
          <button
            key={i}
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
            style={{ ...s.gearBtn, opacity: loadingVideos ? 0.4 : 1 }}
            onClick={retryLoad}
            disabled={loadingVideos}
            title="新着動画を取得"
            aria-label="更新"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={loadingVideos ? { animation: 'spin 0.8s linear infinite' } : {}}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        )}
        <button style={s.gearBtn} onClick={() => setSettingsOpen(true)} title="チャンネル設定">
          <GearIcon />
        </button>
      </div>
    </>
  )

  // ── 共通パーツ：動画プレイヤー内容 ──────────────────
  const playerContent = (
    <div style={s.videoArea}>
      {selectedVideoId && playing ? (
        <iframe
          key={selectedVideoId}
          style={s.iframe}
          src={`https://www.youtube.com/embed/${selectedVideoId}?autoplay=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={videos.find(v => v.id === selectedVideoId)?.title ?? 'YouTube'}
        />
      ) : selectedVideoId ? (
        <div style={s.thumbPlayer} onClick={() => setPlaying(true)}>
          {!thumbErr && (
            <img
              src={`https://i.ytimg.com/vi/${selectedVideoId}/hqdefault.jpg`}
              style={s.thumbPlayerImg}
              alt=""
              onError={() => setThumbErr(true)}
            />
          )}
          <div style={s.playOverlay}>
            <div style={s.playBtn}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="white">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <div style={s.playerPlaceholder}>
          <div style={s.emptyIcon}>▶</div>
          <p style={s.emptyText}>{loadingVideos ? '読み込み中…' : '動画がありません'}</p>
        </div>
      )}
    </div>
  )

  // ── 共通パーツ：動画リスト ───────────────────────────
  const videoListContent = (
    <>
      {loadingVideos ? (
        <div style={s.listLoading}>読み込み中…</div>
      ) : videoError ? (
        <div style={s.listError}>
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
          onClick={() => { setSelectedVideoId(v.id); setPlaying(true) }}
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
          </div>
          <div style={s.videoInfo}>
            <span style={s.videoTitle}>{v.title}</span>
            <span style={s.videoDate}>{formatDate(v.published)}</span>
          </div>
        </button>
      ))}
      {cacheTime && !loadingVideos && !videoError && (
        <div style={s.cacheInfo}>
          <span>取得: {cacheTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </>
  )

  return (
    <div style={{ ...s.wrap, ...themeVars(theme) }}>

      {isMobile ? (
        /* ══ モバイルレイアウト：プレイヤー上・リスト中・タブ下 ══ */
        <>
          {/* スクロールエリア（プレイヤー + リスト） */}
          <div style={s.mobileScroll}>
            {channels.length === 0 ? (
              <div style={{ ...s.empty, minHeight: 300 }}>
                <div style={s.emptyIcon}>▶</div>
                <p style={s.emptyText}>チャンネルが登録されていません</p>
                <button style={s.emptyAddBtn} onClick={() => setSettingsOpen(true)}>
                  + チャンネルを追加
                </button>
              </div>
            ) : (
              <>
                {/* プレイヤー：余白なし・100%幅 */}
                <div style={s.mobilePlayer}>
                  <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', position: 'relative' as const }}>
                    {playerContent}
                  </div>
                </div>
                {/* タイトル */}
                {selectedVideoId && (
                  <div style={{ ...s.playerTitle, fontSize: 15, display: 'block', overflow: 'visible', WebkitLineClamp: 'unset' as unknown as number }}>
                    {videos.find(v => v.id === selectedVideoId)?.title ?? ''}
                  </div>
                )}
                {/* 動画リスト */}
                <div style={{ ...s.videoList, flex: 'none', borderLeft: 'none', borderTop: '1px solid var(--border-dim)' }}>
                  {videoListContent}
                </div>
              </>
            )}
          </div>

          {/* タブバー：画面最下部 */}
          <div style={s.mobileTabBar} className="glass">
            {tabBarContent}
          </div>
        </>
      ) : (
        /* ══ デスクトップレイアウト：従来通り ══ */
        <>
          {/* タブバー */}
          <div style={s.tabBar} className="glass">
            {tabBarContent}
          </div>

          {/* メインエリア */}
          <div style={s.main}>
            {channels.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyIcon}>▶</div>
                <p style={s.emptyText}>チャンネルが登録されていません</p>
                <button style={s.emptyAddBtn} onClick={() => setSettingsOpen(true)}>
                  + チャンネルを追加
                </button>
              </div>
            ) : (
              <>
                {/* 左: プレイヤー列 */}
                <div style={s.playerColumn}>
                  <div style={s.playerWrap}>
                    {playerContent}
                  </div>
                  {selectedVideoId && (
                    <div style={{ ...s.playerTitle, fontSize: 24 }}>
                      {videos.find(v => v.id === selectedVideoId)?.title ?? ''}
                    </div>
                  )}
                </div>

                {/* 右: 動画リスト */}
                <div style={s.videoList}>
                  {videoListContent}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* 設定モーダル */}
      {settingsOpen && (
        <div style={s.overlay} onClick={() => setSettingsOpen(false)}>
          <div style={s.modal} className="glass" onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>YouTubeチャンネル設定</span>
              <button style={s.closeBtn} onClick={() => setSettingsOpen(false)}>✕</button>
            </div>

            {channels.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionLabel}>登録済みチャンネル</div>
                {channels.map((ch, i) => (
                  <div key={i} style={s.channelRow}>
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

            <div style={s.section}>
              <div style={s.sectionLabel}>チャンネルを追加</div>

              {!manualMode ? (
                <>
                  <div style={s.inputRow}>
                    <input
                      style={{ ...s.input, flex: 1 }}
                      value={newId}
                      onChange={e => { setNewId(e.target.value); setResolveError('') }}
                      placeholder="チャンネルID（UCxxxxxxx）またはチャンネルURL"
                      onKeyDown={e => e.key === 'Enter' && !resolving && addChannel()}
                      disabled={resolving}
                    />
                    <button
                      style={{ ...s.addBtnInline, ...((!newId.trim() || resolving) ? s.addBtnDisabled : {}) }}
                      onClick={addChannel}
                      disabled={!newId.trim() || resolving}
                    >
                      {resolving ? '取得中…' : '追加'}
                    </button>
                  </div>
                  {resolveError && <p style={s.errorText}>{resolveError}</p>}
                  <p style={s.hint}>
                    チャンネルID（UCxxxx）・チャンネルURL・@ハンドルURL に対応。チャンネル名は自動取得します。
                  </p>
                </>
              ) : (
                <>
                  <p style={s.manualNote}>
                    自動取得に失敗しました。チャンネルIDを入力してください。
                  </p>
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
                      style={{ ...s.addBtnInline, ...(!manualChannelId.trim() ? s.addBtnDisabled : {}) }}
                      onClick={addChannelManual}
                      disabled={!manualChannelId.trim()}
                    >
                      追加
                    </button>
                    <button style={s.cancelBtn} onClick={cancelManual}>キャンセル</button>
                  </div>
                  <p style={s.hint}>
                    チャンネルIDの調べ方: YouTube チャンネルページ →「概要」→「チャンネル情報」→「チャンネル ID をコピー」
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
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
  // モバイル専用
  mobileScroll: {
    flex: 1, minHeight: 0,
    overflowY: 'auto' as const, overflowX: 'hidden' as const,
    display: 'flex', flexDirection: 'column' as const,
    paddingBottom: 56, // 固定タブバー分の余白
  },
  mobilePlayer: { width: '100%', flexShrink: 0, background: '#000' },
  mobileTabBar: {
    position: 'fixed' as const, bottom: 'var(--header-height)', left: 0, right: 0,
    zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px', gap: 6,
    borderTop: '1px solid var(--border-dim)',
    userSelect: 'none',
    background: 'var(--modal-bg)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  },
  tabBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px', gap: 6, flexShrink: 0,
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
    userSelect: 'none',
  },
  tabGroup: { display: 'flex', borderRadius: 10, overflow: 'hidden', padding: 3, gap: 2 },
  tab: {
    padding: '5px 14px', borderRadius: 7,
    fontSize: 13, fontWeight: 500,
    color: 'var(--text-sub)', transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--view-btn-active-bg)',
    color: 'var(--view-btn-active-color)',
    boxShadow: '0 2px 8px rgba(100,120,200,0.15)',
  },
  gearBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    color: 'var(--text-sub)', flexShrink: 0,
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
    minWidth: 160, borderRadius: 10, overflow: 'hidden',
    zIndex: 100, display: 'flex', flexDirection: 'column',
    background: 'var(--modal-bg)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  },
  dropdownItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', fontSize: 13, fontWeight: 500,
    color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
    background: 'transparent',
  },
  dropdownIcon: { display: 'flex', alignItems: 'center', color: 'var(--text-sub)' },
  dropdownDivider: { height: 1, background: 'var(--border-dim)', margin: '0 12px' },
  main: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', padding: '10px 14px 14px', gap: 8 },
  playerColumn:  { flex: '1 1 60%', maxWidth: 1300, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' as const },
  playerWrap:    { flex: '1 1 0', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: 10, overflow: 'hidden' },
  videoArea:     { width: '100%', aspectRatio: '16/9', maxHeight: '100%', position: 'relative' as const },
  playerPlaceholder: { position: 'absolute' as const, inset: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 16 },
  iframe:        { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', border: 'none', display: 'block' },
  thumbPlayer:   { position: 'absolute' as const, inset: 0, cursor: 'pointer', overflow: 'hidden' },
  thumbPlayerImg:{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' },
  playOverlay: {
    position: 'absolute' as const, inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 80, height: 80, borderRadius: '50%',
    background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.15s',
  },
  playerTitle: {
    padding: '10px 16px', flexShrink: 0,
    fontSize: 26, fontWeight: 600, color: 'var(--text)',
    background: 'var(--glass-bg)',
    borderTop: '1px solid var(--border-dim)',
    lineHeight: 1.4,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  videoList: {
    flex: '1 1 0', minWidth: 260,
    overflowY: 'auto', overflowX: 'hidden',
    borderLeft: '1px solid var(--border-dim)',
    display: 'flex', flexDirection: 'column',
  },
  listLoading: {
    padding: 20, fontSize: 13, color: 'var(--text-dim)',
    textAlign: 'center' as const,
  },
  listError: {
    padding: 20, fontSize: 12, color: 'var(--text-dim)',
    textAlign: 'center' as const, display: 'flex', flexDirection: 'column' as const, gap: 10,
  },
  retryBtn: {
    padding: '5px 14px', borderRadius: 20, fontSize: 12,
    background: 'var(--bg-subtle)', border: '1px solid var(--border-dim)',
    color: 'var(--text-sub)', cursor: 'pointer',
  },
  videoItem: {
    display: 'flex', flexDirection: 'row' as const, gap: 10,
    padding: '8px 10px', textAlign: 'left' as const,
    borderBottom: '1px solid var(--border-dim)',
    cursor: 'pointer', transition: 'background 0.12s', alignItems: 'flex-start',
  },
  videoItemActive: { background: 'var(--bg-subtle)' },
  videoItemHover:  { background: 'var(--glass-bg)' },
  thumbWrap: { width: 120, aspectRatio: '16/9', overflow: 'hidden', borderRadius: 5, flexShrink: 0 },
  thumb: { width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' },
  thumbFallback: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-dim)', fontSize: 20,
  },
  videoInfo: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4, minWidth: 0 },
  videoTitle: {
    fontSize: 13, fontWeight: 600, color: 'var(--text)',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden', lineHeight: 1.4,
  },
  videoDate: { fontSize: 11, color: 'var(--text-dim)' },
  cacheInfo: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 10px', flexShrink: 0,
    borderTop: '1px solid var(--border-dim)',
    fontSize: 10, color: 'var(--text-dim)',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    flex: 1, gap: 16,
  },
  emptyIcon:   { fontSize: 48, opacity: 0.25 },
  emptyText:   { color: 'var(--text-sub)', fontSize: 14 },
  emptyAddBtn: {
    padding: '8px 20px', borderRadius: 20,
    background: 'rgba(96,165,250,0.15)',
    border: '1px solid rgba(96,165,250,0.32)',
    color: 'var(--accent)', fontSize: 13, fontWeight: 600,
  },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
    zIndex: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: 440, maxWidth: 'calc(100vw - 32px)',
    borderRadius: 16, padding: '20px 24px',
    background: 'var(--modal-bg)',
    display: 'flex', flexDirection: 'column', gap: 16,
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
    color: 'var(--text-sub)', textTransform: 'uppercase',
  },
  channelRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8,
    background: 'var(--bg-item)', border: '1px solid var(--border-dim)',
  },
  channelInfo:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  channelName:  { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  channelId: {
    fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  refreshBtn: {
    padding: '3px 8px', borderRadius: 6,
    background: 'rgba(96,165,250,0.12)',
    border: '1px solid rgba(96,165,250,0.25)',
    color: 'var(--accent)',
    fontSize: 14, fontWeight: 600, flexShrink: 0, cursor: 'pointer',
  },
  deleteBtn: {
    padding: '3px 10px', borderRadius: 6,
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.25)',
    color: 'rgba(248,113,113,0.85)',
    fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  inputRow: { display: 'flex', gap: 8, alignItems: 'center' },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-subtle)', border: '1px solid var(--border-dim)',
    borderRadius: 8, color: 'var(--text)', fontSize: 13,
    fontFamily: 'inherit', outline: 'none', minWidth: 0,
  },
  addBtnInline: {
    padding: '8px 16px', borderRadius: 8, flexShrink: 0,
    background: 'rgba(96,165,250,0.18)',
    border: '1px solid rgba(96,165,250,0.35)',
    color: 'var(--accent)', fontSize: 13, fontWeight: 700,
    whiteSpace: 'nowrap',
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
