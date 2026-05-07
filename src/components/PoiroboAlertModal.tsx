import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { PoiroboAlertConfig } from '../utils/settingsStorage'

type Props = {
  isOpen:  boolean
  config:  PoiroboAlertConfig
  theme:   'dark' | 'light'
  onSave:  (config: PoiroboAlertConfig) => void
  onClose: () => void
}

type GroupDef = {
  label: string
  items: { key: keyof PoiroboAlertConfig; label: string; sub: string }[]
}

const GROUPS: GroupDef[] = [
  {
    label: 'SQ日',
    items: [
      { key: 'majorSq', label: 'メジャーSQ',  sub: '3・6・9・12月の第2金曜日' },
      { key: 'miniSq',  label: 'ミニSQ',      sub: '上記以外の月の第2金曜日' },
    ],
  },
  {
    label: '米国イベント',
    items: [
      { key: 'fomc',   label: 'FOMC',    sub: 'FRB政策金利決定（年8回）' },
      { key: 'nfp',    label: '雇用統計', sub: '非農業部門雇用者数（毎月第1金曜）' },
      { key: 'cpi',    label: 'CPI',     sub: '消費者物価指数（毎月中旬）' },
      { key: 'pce',    label: 'PCE',     sub: '個人消費支出（毎月下旬）' },
      { key: 'gdp',    label: 'GDP',     sub: 'GDP速報値（四半期）' },
    ],
  },
  {
    label: '日本イベント',
    items: [
      { key: 'boj',     label: '日銀',        sub: '金融政策決定会合（年8回）' },
      { key: 'tankan',  label: '短観',        sub: '日銀短期経済観測（四半期）' },
      { key: 'saishu',  label: '権利付最終日', sub: '3・6・9・12月末の2営業日前' },
      { key: 'ochi',    label: '権利落ち日',   sub: '3・6・9・12月末の1営業日前' },
      { key: 'kakutei', label: '権利確定日',   sub: '3・6・9・12月の最終営業日' },
    ],
  },
  {
    label: 'アノマリー',
    items: [
      { key: 'january_effect',  label: '1月効果',       sub: '年初1〜5営業日' },
      { key: 'setsubun_top',    label: '節分天井',       sub: '節分（2/3）前後2営業日' },
      { key: 'nisa_day',        label: 'NISAの日',       sub: '2月13日 前後1営業日' },
      { key: 'higan_bottom',    label: '彼岸底',         sub: '春分の日の前5営業日' },
      { key: 'new_fiscal_year', label: '新年度入り',     sub: '4月第1〜3営業日' },
      { key: 'sell_in_may',     label: 'セルインメイ',   sub: '5月第1〜第2金曜日' },
      { key: 'investment_day',  label: '投資の日',       sub: '10月4日 前後1営業日' },
      { key: 'xmas_rally',      label: "X'masラリー",    sub: '12月25日〜年内受渡最終日' },
      { key: 'tax_loss_selling', label: '損出し売り',    sub: '12月25日〜年内受渡最終日' },
    ],
  },
]

export function PoiroboAlertModal({ isOpen, config, theme, onSave, onClose }: Props) {
  const [local, setLocal] = useState<PoiroboAlertConfig>(config)
  const isLight = theme === 'light'

  useEffect(() => {
    if (isOpen) setLocal(config)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const toggle = (key: keyof PoiroboAlertConfig) =>
    setLocal(prev => ({ ...prev, [key]: !prev[key] }))

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(4px)',
  }
  const panel: React.CSSProperties = {
    position: 'fixed', top: '50%', left: '50%', zIndex: 901,
    transform: 'translate(-50%,-50%)',
    width: 'min(380px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
    background: isLight ? '#fff' : 'rgba(22,22,26,0.97)',
    border: '1px solid var(--glass-border)',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
  }

  return createPortal(
    <>
      <div style={overlay} onClick={onClose} />
      <div style={panel} onClick={e => e.stopPropagation()}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border-dim)', position: 'sticky', top: 0, background: isLight ? '#fff' : 'rgba(22,22,26,0.97)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            ぽいロボ スキャン
          </div>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: 'var(--text-sub)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 説明文 */}
        <div style={{ padding: '14px 18px 10px', fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.65, borderBottom: '1px solid var(--border-dim)' }}>
          ハイライトしたいイベントを選択してください。
          チェックした種類のイベントがある日付パネルを<span style={{ color: '#f87171', fontWeight: 600 }}>薄い赤</span>でハイライト表示します。
        </div>

        {/* グループ別チェックボックス */}
        <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {GROUPS.map((group, gi) => (
            <div key={group.label} style={{ marginTop: gi > 0 ? 12 : 0 }}>
              {/* グループラベル */}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 2 }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.items.map(({ key, label, sub }) => {
                  const checked = local[key]
                  return (
                    <label
                      key={key}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => toggle(key)}
                    >
                      <span style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${checked ? '#f87171' : 'var(--text-dim)'}`,
                        background: checked ? '#f87171' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: checked ? 'var(--text)' : 'var(--text-sub)' }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{sub}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
              {gi < GROUPS.length - 1 && (
                <div style={{ height: 1, background: 'var(--border-dim)', marginTop: 12 }} />
              )}
            </div>
          ))}
        </div>

        {/* ボタン */}
        <div style={{ padding: '10px 18px 18px', display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: isLight ? '#fff' : 'rgba(22,22,26,0.97)' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', background: 'var(--bg-medium)', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(local)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#fff', background: '#f87171', border: 'none', cursor: 'pointer' }}
          >
            保存して反映
          </button>
        </div>

      </div>
    </>,
    document.body
  )
}
