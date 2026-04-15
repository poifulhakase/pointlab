const RSS_URL  = 'https://www3.nhk.or.jp/rss/news/cat0.xml'
const CACHE_KEY = 'poical-nhk-news'
const CACHE_TTL = 30 * 60 * 1000 // 30分

export type NhkNewsItem = {
  title: string
  pubDate: string  // ISO 8601 (JST)
  description: string
}

export async function fetchNhkNews(): Promise<NhkNewsItem[]> {
  // キャッシュ確認
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const { ts, items } = JSON.parse(raw) as { ts: number; items: NhkNewsItem[] }
      if (Date.now() - ts < CACHE_TTL) return items
    }
  } catch { /* ignore */ }

  const res  = await fetch(RSS_URL)
  const text = await res.text()
  const doc  = new DOMParser().parseFromString(text, 'text/xml')

  const items: NhkNewsItem[] = Array.from(doc.querySelectorAll('item'))
    .slice(0, 5)
    .map(el => ({
      title:       el.querySelector('title')?.textContent?.trim()       ?? '',
      pubDate:     el.querySelector('pubDate')?.textContent?.trim()     ?? '',
      description: el.querySelector('description')?.textContent?.trim() ?? '',
    }))

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items }))
  } catch { /* ignore */ }

  return items
}
