// ぽいロボ サイバー配色（テーマ対応）。ShieldView / EnginePanel など「ぽいロボ系」UI で共有。
export function cy(theme: 'dark' | 'light') {
  const L = theme === 'light'
  return {
    BG:     L ? '#f0f7ff' : '#050e1a',
    GREEN:  L ? '#0369a1' : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.75)' : 'rgba(0,229,255,0.55)',
    DESC:   L ? 'rgba(3,105,161,0.90)' : 'rgba(200,240,255,0.88)',
    FAINT:  L ? 'rgba(3,105,161,0.38)' : 'rgba(0,229,255,0.22)',
    BORDER: L ? 'rgba(3,105,161,0.28)' : 'rgba(0,229,255,0.22)',
    BORDBR: L ? 'rgba(3,105,161,0.55)' : 'rgba(0,229,255,0.45)',
    NOTICE: L ? 'rgba(3,105,161,0.95)' : 'rgba(0,229,255,0.92)',
    SCAN:   L ? 'none' : 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,229,255,0.022) 3px, rgba(0,229,255,0.022) 4px)',
    LOGBG:  L ? 'rgba(3,105,161,0.06)' : 'rgba(0,0,0,0.45)',
    HDBG:   L ? 'rgba(3,105,161,0.06)' : 'rgba(0,229,255,0.06)',
    TAREA:  L ? 'rgba(3,105,161,0.07)' : 'rgba(0,229,255,0.04)',
    TXTCLR: L ? 'var(--text)' : 'rgba(255,255,255,0.88)',
    FONT:   "'Courier New', Courier, monospace" as const,
  } as const
}

export type CyColors = ReturnType<typeof cy>
