type Props = {
  current: Date
  today: Date
  onSelect: (date: Date) => void
  onNavigate: (delta: number) => void
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

export function MiniCalendar({ current, today, onSelect, onNavigate }: Props) {
  const year = current.getFullYear()
  const month = current.getMonth()

  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())

  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }

  const isToday = (d: Date) =>
    d.toDateString() === today.toDateString()
  const isCurrent = (d: Date) =>
    d.toDateString() === current.toDateString()
  const isThisMonth = (d: Date) => d.getMonth() === month

  return (
    <div style={styles.wrap}>
      {/* ミニヘッダー */}
      <div style={styles.header}>
        <button style={styles.navBtn} onClick={() => onNavigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={styles.monthLabel}>
          {year}年 {current.toLocaleDateString('ja-JP', { month: 'short' })}
        </span>
        <button style={styles.navBtn} onClick={() => onNavigate(1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div style={styles.grid}>
        {DOW.map((d, i) => (
          <div key={d} style={{ ...styles.cell, color: i === 0 ? 'var(--color-sun)' : i === 6 ? 'var(--color-sat)' : 'var(--text-sub)', fontSize: 10, fontWeight: 600 }}>
            {d}
          </div>
        ))}

        {days.map((d, i) => {
          const isS = i % 7 === 0
          const isSat = i % 7 === 6
          const active = isCurrent(d)
          const td = isToday(d)
          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              style={{
                ...styles.cell,
                ...styles.dayBtn,
                color: active ? 'rgba(255,255,255,0.95)' : !isThisMonth(d) ? 'var(--text-dim)' : isS ? 'var(--color-sun)' : isSat ? 'var(--color-sat)' : 'var(--text)',
                background: active ? 'var(--accent-glass, rgba(59,130,246,0.75))' : td ? 'rgba(0,0,60,0.06)' : undefined,
                borderRadius: 999,
                fontWeight: td || active ? 700 : 400,
              }}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    padding: '12px 8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: '0 4px',
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 6,
    color: 'var(--text-sub)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 1,
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    fontSize: 11,
  },
  dayBtn: {
    transition: 'background 0.1s',
  },
}
