import { cy } from '../utils/cyberTheme'

// ── AI リンク定義（ぽいロボ シールド / イベント 共通）─────────────────
export const SHIELD_AI_LINKS = [
  {
    name: 'ChatGPT', url: 'https://chatgpt.com/', hint: 'o3以上推奨',
    bg: '#10a37f',
    icon: (
      <svg width="24" height="24" viewBox="0 0 41 41" fill="none">
        <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.498v4.996l-4.331 2.5-4.331-2.5V18z" fill="white"/>
      </svg>
    ),
  },
  {
    name: 'Gemini', url: 'https://gemini.google.com/?hl=ja', hint: '思考モード推奨',
    bg: 'linear-gradient(135deg,#4285f4,#34a853,#fbbc04,#ea4335)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
        <path d="M14 2 C14 2 15.6 9.4 20 14 C15.6 18.6 14 26 14 26 C14 26 12.4 18.6 8 14 C12.4 9.4 14 2 14 2Z" fill="white"/>
        <path d="M2 14 C2 14 9.4 12.4 14 8 C18.6 12.4 26 14 26 14 C26 14 18.6 15.6 14 20 C9.4 15.6 2 14 2 14Z" fill="white" opacity="0.85"/>
      </svg>
    ),
  },
  {
    name: 'Claude', url: 'https://claude.ai/new', hint: 'ぽいロボ推奨',
    bg: '#d97757',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 3 C8 3 5 6 5 10 C5 12.5 6.2 14.7 8 16 L7 21 L12 18.5 L17 21 L16 16 C17.8 14.7 19 12.5 19 10 C19 6 16 3 12 3Z" fill="white" opacity="0.95"/>
      </svg>
    ),
  },
  {
    name: 'DeepSeek', url: 'https://chat.deepseek.com/', hint: 'R1モデル推奨',
    bg: 'linear-gradient(135deg,#4B6EF5,#1AC4C4)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M6 4h6c5 0 8 3 8 8s-3 8-8 8H6V4zm4 4v8h2c3 0 5-1.8 5-4s-2-4-5-4h-2z"/>
      </svg>
    ),
  },
]

/** AI起動リンク列（ShieldPanel / NewsPanel 共通）。Gemini/Claude/ChatGPT/DeepSeek の円形リンク。 */
export function AILaunchRow({ theme }: { theme: 'dark' | 'light' }) {
  const c = cy(theme)
  return (
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly' }}>
      {SHIELD_AI_LINKS.map(ai => (
        <div key={ai.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 86 }}>
          <a
            href={ai.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(ai.url, '_blank', 'noopener,noreferrer') }}
            style={{
              width: 70, height: 70, borderRadius: '50%',
              background: `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.06)`,
              border: `2px solid ${c.BORDER}`,
              boxShadow: `0 0 16px ${c.FAINT}, inset 0 0 10px ${c.FAINT}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', textDecoration: 'none',
              transition: 'box-shadow 0.2s, background 0.2s',
            }}
          >
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: ai.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {ai.icon}
            </div>
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <span style={{ fontFamily: c.FONT, fontSize: 13, color: c.GREEN, letterSpacing: '0.04em', fontWeight: 700 }}>{ai.name}</span>
            <span style={{ fontFamily: c.FONT, fontSize: 11, color: c.DIM, letterSpacing: '0.02em' }}>{ai.hint}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
