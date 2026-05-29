import { useState, useEffect, useCallback } from 'react'
import { listMembers, addMember, removeMember, type CommunityMember } from '../utils/communityAccess'

type Props = { theme: 'dark' | 'light'; onClose?: () => void }

const CY_BG     = 'linear-gradient(160deg, rgba(0,10,26,0.98) 0%, rgba(0,5,16,0.98) 100%)'
const CY_ACCENT = 'rgba(0,229,255,0.95)'
const CY_DIM    = 'rgba(0,229,255,0.55)'
const CY_FAINT  = 'rgba(0,229,255,0.18)'
const CY_BORDER = 'rgba(0,229,255,0.25)'
const CY_FONT   = "'Courier New', Courier, monospace" as const

function fmtDate(iso: string) {
  return iso.slice(0, 10)
}

export function CommunityMembersPanel({ theme: _theme, onClose }: Props) {
  const [members, setMembers]     = useState<CommunityMember[]>([])
  const [loading, setLoading]     = useState(true)
  const [inputEmail, setInputEmail] = useState('')
  const [inputName,  setInputName]  = useState('')
  const [adding,  setAdding]  = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMembers(await listMembers())
    } catch (e) {
      setError('メンバー一覧の取得に失敗しました: ' + String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    const email = inputEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) { setError('有効なメールアドレスを入力してください'); return }
    if (members.some(m => m.email === email)) { setError('このメールはすでに登録されています'); return }
    setAdding(true); setError('')
    try {
      await addMember(email, inputName.trim())
      setInputEmail(''); setInputName('')
      setSuccess(`${email} を追加しました`)
      setTimeout(() => setSuccess(''), 3000)
      await load()
    } catch (e) { setError('追加に失敗しました: ' + String(e)) }
    finally { setAdding(false) }
  }

  const handleRemove = async (email: string) => {
    if (!window.confirm(`${email} をメンバーから削除しますか？`)) return
    setRemoving(email); setError('')
    try {
      await removeMember(email)
      setSuccess(`${email} を削除しました`)
      setTimeout(() => setSuccess(''), 3000)
      await load()
    } catch (e) { setError('削除に失敗しました: ' + String(e)) }
    finally { setRemoving(null) }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: CY_BG,
      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.012) 3px,rgba(0,229,255,0.012) 4px)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px',
        borderBottom: `1px solid ${CY_BORDER}`,
        background: 'rgba(0,229,255,0.04)',
        flexShrink: 0,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: CY_ACCENT, boxShadow: `0 0 7px ${CY_ACCENT}` }} />
        <span style={{ fontFamily: CY_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: CY_DIM, flex: 1 }}>
          POIROBO_OS ▸ COMMUNITY MEMBERS
        </span>
        <span style={{ fontFamily: CY_FONT, fontSize: 10, color: 'rgba(0,229,255,0.35)', marginRight: 8 }}>
          {members.length} members
        </span>
        {onClose && (
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: CY_DIM, fontSize: 16, lineHeight: 1, padding: '2px 4px',
          }} aria-label="閉じる">×</button>
        )}
      </div>

      {/* スクロール領域 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* 追加フォーム */}
        <div style={{
          background: CY_FAINT, border: `1px solid ${CY_BORDER}`,
          borderRadius: 10, padding: '16px', marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontFamily: CY_FONT, fontSize: 9, letterSpacing: '0.18em', color: CY_DIM, marginBottom: 2 }}>
            ▸ ADD MEMBER
          </div>
          <input
            value={inputEmail}
            onChange={e => setInputEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="メールアドレス（必須）"
            style={{
              padding: '8px 12px', borderRadius: 7,
              background: 'rgba(0,229,255,0.06)', border: `1px solid ${CY_BORDER}`,
              color: CY_ACCENT, fontFamily: CY_FONT, fontSize: 12,
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              placeholder="表示名（任意）"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7,
                background: 'rgba(0,229,255,0.06)', border: `1px solid ${CY_BORDER}`,
                color: CY_ACCENT, fontFamily: CY_FONT, fontSize: 12,
                outline: 'none',
              }}
            />
            <button
              onClick={handleAdd}
              disabled={adding}
              style={{
                padding: '8px 18px', borderRadius: 7,
                background: adding ? 'rgba(0,229,255,0.06)' : 'rgba(0,229,255,0.14)',
                border: `1px solid ${CY_BORDER}`,
                color: CY_ACCENT, fontFamily: CY_FONT, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.10em', cursor: adding ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {adding ? '追加中...' : '[ 追加 ]'}
            </button>
          </div>
        </div>

        {/* メッセージ */}
        {error   && <div style={{ fontFamily: CY_FONT, fontSize: 11, color: 'rgba(255,100,100,0.9)', marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ fontFamily: CY_FONT, fontSize: 11, color: CY_ACCENT, marginBottom: 12 }}>{success}</div>}

        {/* メンバー一覧 */}
        {loading ? (
          <div style={{ textAlign: 'center', color: CY_DIM, fontFamily: CY_FONT, fontSize: 10, padding: 40 }}>
            LOADING...
          </div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(0,229,255,0.3)', fontFamily: CY_FONT, fontSize: 10, padding: 40 }}>
            NO MEMBERS
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* ヘッダー行 */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              gap: 12, padding: '6px 12px',
              fontFamily: CY_FONT, fontSize: 9, letterSpacing: '0.12em', color: 'rgba(0,229,255,0.40)',
              borderBottom: `1px solid ${CY_FAINT}`,
            }}>
              <span>EMAIL</span>
              <span>ADDED</span>
              <span></span>
            </div>
            {members.map(m => (
              <div key={m.email} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                gap: 12, alignItems: 'center',
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(0,229,255,0.04)',
                border: `1px solid ${CY_FAINT}`,
              }}>
                <div>
                  <div style={{ fontFamily: CY_FONT, fontSize: 12, color: CY_ACCENT }}>{m.email}</div>
                  {m.displayName && (
                    <div style={{ fontFamily: CY_FONT, fontSize: 10, color: CY_DIM, marginTop: 2 }}>{m.displayName}</div>
                  )}
                </div>
                <div style={{ fontFamily: CY_FONT, fontSize: 10, color: 'rgba(0,229,255,0.40)', whiteSpace: 'nowrap' }}>
                  {fmtDate(m.addedAt)}
                </div>
                <button
                  onClick={() => handleRemove(m.email)}
                  disabled={removing === m.email}
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid rgba(255,80,80,0.35)',
                    color: 'rgba(255,100,100,0.75)',
                    fontFamily: CY_FONT, fontSize: 10,
                    cursor: removing === m.email ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {removing === m.email ? '削除中' : '削除'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
