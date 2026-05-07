import type React from 'react'

export const darkVars: React.CSSProperties = {
  background: '#0f0f0f',
  ['--text'                as string]: '#f1f1f1',
  ['--text-sub'            as string]: '#aaaaaa',
  ['--text-dim'            as string]: '#717171',
  ['--glass-bg'            as string]: 'rgba(255,255,255,0.05)',
  ['--glass-border'        as string]: 'rgba(255,255,255,0.1)',
  ['--border-dim'          as string]: 'rgba(255,255,255,0.1)',
  ['--bg-subtle'           as string]: 'rgba(255,255,255,0.07)',
  ['--bg-item'             as string]: 'rgba(255,255,255,0.05)',
  ['--modal-bg'            as string]: '#212121',
  ['--accent'              as string]: '#3ea6ff',
  ['--view-btn-active-bg'  as string]: 'rgba(62,166,255,0.2)',
  ['--view-btn-active-color' as string]: '#3ea6ff',
}

export const lightVars: React.CSSProperties = {
  background: '#f0f4f8',
  ['--text'                as string]: '#111827',
  ['--text-sub'            as string]: '#4b5563',
  ['--text-dim'            as string]: '#6b7280',
  ['--glass-bg'            as string]: 'rgba(255,255,255,0.96)',
  ['--glass-border'        as string]: 'rgba(0,0,0,0.10)',
  ['--border-dim'          as string]: 'rgba(0,0,0,0.09)',
  ['--bg-subtle'           as string]: 'rgba(0,0,0,0.04)',
  ['--bg-item'             as string]: 'rgba(0,0,0,0.04)',
  ['--modal-bg'            as string]: '#ffffff',
  ['--accent'              as string]: '#2563eb',
  ['--view-btn-active-bg'  as string]: 'rgba(37,99,235,0.12)',
  ['--view-btn-active-color' as string]: '#1d4ed8',
}

export const themeVars = (theme: 'dark' | 'light') =>
  theme === 'dark' ? darkVars : lightVars
