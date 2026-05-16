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
      { key: 'january_effect',   label: '1月効果',         sub: '年初1〜5営業日' },
      { key: 'setsubun_top',     label: '節分天井',         sub: '節分（2/3）前後2営業日' },
      { key: 'nisa_day',         label: 'NISAの日',         sub: '2月13日 前後1営業日' },
      { key: 'higan_bottom',     label: '彼岸底',           sub: '春分の日の前5営業日' },
      { key: 'new_fiscal_year',  label: '新年度入り',       sub: '4月第1〜3営業日' },
      { key: 'sell_in_may',      label: 'セルインメイ',     sub: '5月第1〜第2金曜日' },
      { key: 'investment_day',   label: '投資の日',         sub: '10月4日 前後1営業日' },
      { key: 'xmas_rally',       label: 'クリスマスラリー', sub: '12月25日〜年内受渡最終日' },
      { key: 'tax_loss_selling', label: 'タックスロスセリング', sub: '12月25日〜年内受渡最終日' },
    ],
  },
]

const CY_ACCENT  = 'rgba(0,230,255,0.95)'
const CY_DIM     = 'rgba(0,220,255,0.75)'
const CY_FAINT   = 'rgba(0,200,255,0.40)'
const CY_BORDER  = 'rgba(0,242,255,0.35)'
const CY_FAINT2  = 'rgba(0,200,255,0.12)'
const CY_DOT     = 'rgba(0,242,255,0.7)'
const CY_BG      = 'linear-gradient(160deg, rgba(0,12,32,0.98) 0%, rgba(0,6,20,0.98) 100%)'
const CY_FONT    = 'monospace' as const

export function PoiroboAlertModal({ isOpen, config, onSave, onClose }: Props) {
  const [local, setLocal] = useState<PoiroboAlertConfig>(config)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 600)

  useEffect(() => {
    if (isOpen) setLocal(config)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 600)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  if (!isOpen) return null

  const toggle = (key: keyof PoiroboAlertConfig) =>
    setLocal(prev => ({ ...prev, [key]: !prev[key] }))

  const renderGroupItems = (group: GroupDef) =>
    group.items.map(({ key, label, sub }) => {
      const checked = local[key]
      return (
        <label
          key={key}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none', padding: '5px 0' }}
          onClick={() => toggle(key)}
        >
          <span style={{
            width: 15, height: 15, borderRadius: 3, flexShrink: 0, marginTop: 2,
            border: `1.5px solid ${checked ? CY_ACCENT : CY_FAINT}`,
            background: checked ? 'rgba(0,200,255,0.15)' : 'transparent',
            boxShadow: checked ? '0 0 8px rgba(0,200,255,0.45), inset 0 0 4px rgba(0,200,255,0.1)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
            {checked && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={CY_ACCENT} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: checked ? CY_ACCENT : CY_DIM, fontFamily: CY_FONT, letterSpacing: '0.03em', lineHeight: 1.3 }}>{label}</div>
            <div style={{ fontSize: 10, color: CY_FAINT, marginTop: 2, fontFamily: CY_FONT, letterSpacing: '0.02em' }}>{sub}</div>
          </div>
        </label>
      )
    })

  const renderGroup = (group: GroupDef, showDivider: boolean) => (
    <div key={group.label}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: CY_DIM, fontFamily: CY_FONT, marginBottom: 8, paddingLeft: 2 }}>
        {group.label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {renderGroupItems(group)}
      </div>
      {showDivider && <div style={{ height: 1, background: CY_FAINT2, margin: '14px 0' }} />}
    </div>
  )

  return createPortal(
    <>
      {/* オーバーレイ */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,4,16,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* パネル */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 901,
          transform: 'translate(-50%,-50%)',
          width: isDesktop ? 'min(680px, calc(100vw - 32px))' : 'min(380px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column',
          background: CY_BG,
          border: `1px solid ${CY_BORDER}`,
          borderRadius: 16,
          boxShadow: '0 0 40px rgba(0,180,255,0.12), 0 24px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: `1px solid ${CY_FAINT2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: CY_DOT,
              boxShadow: '0 0 8px rgba(0,242,255,0.9)',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: CY_DIM, fontFamily: CY_FONT, letterSpacing: '0.2em' }}>
              POI-ROBO RADAR
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${CY_FAINT2}`,
              color: CY_FAINT, padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 説明文 */}
        <div style={{ padding: '10px 18px 10px', borderBottom: `1px solid ${CY_FAINT2}`, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: CY_FAINT, fontFamily: CY_FONT, letterSpacing: '0.04em', lineHeight: 1.7 }}>
            監視するイベントを選択してください。対象日付パネルを
            <span style={{ color: CY_ACCENT, fontWeight: 700 }}>グリーン</span>
            でハイライト表示します。
          </span>
        </div>

        {/* チェックボックス */}
        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
          {isDesktop ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0', alignItems: 'start' }}>
              <div style={{ paddingRight: 22, borderRight: `1px solid ${CY_FAINT2}` }}>
                {renderGroup(GROUPS[0], true)}
                {renderGroup(GROUPS[3], false)}
              </div>
              <div style={{ paddingLeft: 22 }}>
                {renderGroup(GROUPS[1], true)}
                {renderGroup(GROUPS[2], false)}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {GROUPS.map((group, gi) => renderGroup(group, gi < GROUPS.length - 1))}
            </div>
          )}
        </div>

        {/* ボタン */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 18px 18px', flexShrink: 0, borderTop: `1px solid ${CY_FAINT2}` }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(180,200,220,0.7)', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
            }}
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(local)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(0,160,255,0.25) 0%, rgba(0,100,200,0.18) 100%)',
              border: `1px solid rgba(0,200,255,0.5)`,
              color: CY_ACCENT, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
              boxShadow: '0 0 16px rgba(0,180,255,0.15)',
            }}
          >
            保存して反映
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
