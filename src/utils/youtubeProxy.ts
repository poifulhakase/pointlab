export type Video = { id: string; title: string; published: string }

const YT_NS       = 'http://www.youtube.com/xml/schemas/2015'
const CACHE_TTL   = 21 * 24 * 60 * 60 * 1000   // 3週間
const CACHE_PREFIX = 'poical-yt-videos-'

interface VideoCache { fetchedAt: number; videos: Video[] }

function readCache(channelId: string): VideoCache | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + channelId)
    if (!raw) return null
    const cache: VideoCache = JSON.parse(raw)
    if (Date.now() - cache.fetchedAt > CACHE_TTL) return null
    return cache
  } catch { return null }
}

function writeCache(channelId: string, videos: Video[]) {
  try {
    const cache: VideoCache = { fetchedAt: Date.now(), videos }
    localStorage.setItem(CACHE_PREFIX + channelId, JSON.stringify(cache))
  } catch { /* localStorage 容量超過時は無視 */ }
}

/** タイムアウト付き fetch */
async function fetchWithTimeout(input: string, ms: number): Promise<Response> {
  const ac = new AbortController()
  const t  = setTimeout(() => ac.abort(), ms)
  try {
    return await fetch(input, { signal: ac.signal })
  } finally {
    clearTimeout(t)
  }
}

/** プロキシ経由でテキスト取得（allorigins → corsproxy.io フォールバック） */
export async function proxyFetch(url: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, 5000
    )
    if (res.ok) {
      const json = await res.json() as { contents?: string }
      if (json.contents) return json.contents
    }
  } catch { /* fallthrough */ }

  const res2 = await fetchWithTimeout(
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`, 5000
  )
  if (!res2.ok) throw new Error('取得失敗')
  return res2.text()
}

/** RSS XML を取得して Document を返す */
export async function fetchFeed(feedUrl: string): Promise<Document> {
  const contents = await proxyFetch(feedUrl)
  const doc = new DOMParser().parseFromString(contents, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('フィードの解析に失敗しました')
  return doc
}

/** channel_id からチャンネル名を取得 */
export async function fetchChannelName(channelId: string): Promise<string> {
  const doc   = await fetchFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
  const title = doc.getElementsByTagName('title')[0]?.textContent?.trim()
  if (!title) throw new Error('チャンネル名が取得できませんでした')
  return title
}

/** @ハンドル → user= RSS から channelId + name を解決 */
async function resolveHandle(handle: string): Promise<{ id: string; name: string }> {
  const doc  = await fetchFeed(`https://www.youtube.com/feeds/videos.xml?user=${handle}`)
  const id   = doc.getElementsByTagNameNS(YT_NS, 'channelId')[0]?.textContent?.trim()
             ?? doc.getElementsByTagName('channelId')[0]?.textContent?.trim()
  const name = doc.getElementsByTagName('title')[0]?.textContent?.trim()
  if (!id || !name) throw new Error(
    'チャンネルが見つかりませんでした。チャンネルURLまたはIDを直接入力してください'
  )
  return { id, name }
}

/** 任意の入力文字列を { id, name } に解決 */
export async function resolveChannel(raw: string): Promise<{ id: string; name: string }> {
  const trimmed = raw.trim()

  // /channel/UCxxxx
  const mChannel = trimmed.match(/\/channel\/(UC[A-Za-z0-9_-]+)/)
  if (mChannel) {
    const id   = mChannel[1]
    const name = await fetchChannelName(id)
    return { id, name }
  }

  // /@handle URL or @handle 直接入力
  const mHandle = trimmed.match(/\/@([A-Za-z0-9_.-]+)/)
  const handle  = mHandle ? mHandle[1]
    : trimmed.startsWith('@') ? trimmed.slice(1)
    : null
  if (handle) return resolveHandle(handle)

  // UCxxxx 直接入力
  const name = await fetchChannelName(trimmed)
  return { id: trimmed, name }
}

/** channel_id からエントリ一覧をネットワーク取得 */
async function fetchVideoListRaw(channelId: string): Promise<Video[]> {
  const doc     = await fetchFeed(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
  const entries = Array.from(doc.getElementsByTagName('entry'))
  return entries.map(e => {
    let id: string | undefined = e.getElementsByTagNameNS(YT_NS, 'videoId')[0]?.textContent?.trim() ?? undefined
    if (!id) {
      const raw = e.getElementsByTagName('id')[0]?.textContent?.trim() ?? ''
      id = raw.match(/yt:video:([A-Za-z0-9_-]+)/)?.[1] ?? undefined
    }
    if (!id) {
      const href = Array.from(e.getElementsByTagName('link'))
        .find(l => l.getAttribute('rel') === 'alternate')?.getAttribute('href') ?? ''
      id = href.match(/[?&]v=([A-Za-z0-9_-]+)/)?.[1] ?? undefined
    }
    return {
      id:        id ?? '',
      title:     e.getElementsByTagName('title')[0]?.textContent?.trim()     ?? '',
      published: e.getElementsByTagName('published')[0]?.textContent?.trim() ?? '',
    }
  }).filter(v => v.id)
}

/**
 * channel_id から動画一覧を取得（localStorage キャッシュ付き・TTL 1時間）
 * force=true のときはキャッシュを無視してネットワーク取得
 */
export async function fetchVideoList(channelId: string, force = false): Promise<Video[]> {
  if (!force) {
    const cached = readCache(channelId)
    if (cached) return cached.videos
  }
  const videos = await fetchVideoListRaw(channelId)
  writeCache(channelId, videos)
  return videos
}

/** キャッシュの取得日時を返す（null = キャッシュなし or 期限切れ） */
export function getVideoCacheInfo(channelId: string): { fetchedAt: Date } | null {
  const cache = readCache(channelId)
  return cache ? { fetchedAt: new Date(cache.fetchedAt) } : null
}
