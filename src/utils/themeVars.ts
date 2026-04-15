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
  background: '#ffffff',
  ['--text'                as string]: '#111111',
  ['--text-sub'            as string]: '#555555',
  ['--text-dim'            as string]: '#999999',
  ['--glass-bg'            as string]: 'rgba(0,0,0,0.03)',
  ['--glass-border'        as string]: 'rgba(0,0,0,0.1)',
  ['--border-dim'          as string]: 'rgba(0,0,0,0.1)',
  ['--bg-subtle'           as string]: 'rgba(0,0,0,0.04)',
  ['--bg-item'             as string]: 'rgba(0,0,0,0.03)',
  ['--modal-bg'            as string]: '#f5f5f5',
  ['--accent'              as string]: '#1a73e8',
  ['--view-btn-active-bg'  as string]: 'rgba(26,115,232,0.12)',
  ['--view-btn-active-color' as string]: '#1a73e8',
}

export const themeVars = (theme: 'dark' | 'light') =>
  theme === 'dark' ? darkVars : lightVars
