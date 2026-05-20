import React from "react";

const TEACHER_STAGES = ['ученик', 'пробный месяц', 'тест-драйв']

function daysLeft(endDate) {
  if (!endDate) return null
  const d = Math.ceil((new Date(endDate) - new Date()) / 86400000)
  return d
}

export function TeacherView({ clients, onClientSelect }) {
  const [search, setSearch] = React.useState('')
  const [sortField, setSortField] = React.useState('name')
  const [sortDir, setSortDir] = React.useState('asc')

  const filtered = clients
    .filter(c => TEACHER_STAGES.includes(c.stage) && c.subscription_type)
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      const digits = q.replace(/\D/g, '')
      if (c.name?.toLowerCase().includes(q)) return true
      if (digits && (c.phone||'').replace(/\D/g,'').endsWith(digits)) return true
      return false
    })
    .sort((a, b) => {
      let aVal, bVal
      if (sortField === 'lessons_left') {
        aVal = a.is_unlimited ? 9999 : Math.max(0, (a.lessons_total||0)-(a.lessons_used||0))
        bVal = b.is_unlimited ? 9999 : Math.max(0, (b.lessons_total||0)-(b.lessons_used||0))
      } else if (sortField === 'days_left') {
        aVal = daysLeft(a.subscription_end_with_freeze || a.subscription_end) ?? 9999
        bVal = daysLeft(b.subscription_end_with_freeze || b.subscription_end) ?? 9999
      } else if (sortField === 'last_visit') {
        aVal = a.last_visit || ''
        bVal = b.last_visit || ''
      } else {
        aVal = (a[sortField]||'').toString().toLowerCase()
        bVal = (b[sortField]||'').toString().toLowerCase()
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function SortTh({ field, label }) {
    return (
      <th onClick={() => toggleSort(field)}
        style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', background: '#fafafa' }}>
        {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или номеру..."
          style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          Учеников на абонементах: <strong>{filtered.length}</strong>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <SortTh field="name" label="Имя" />
              <SortTh field="subscription_type" label="Абонемент" />
              <SortTh field="lessons_left" label="Занятий осталось" />
              <SortTh field="days_left" label="До окончания" />
              <SortTh field="last_visit" label="Последнее занятие" />
              <SortTh field="stage" label="Стадия" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const lessonsLeft = c.is_unlimited ? '∞' : Math.max(0, (c.lessons_total||0)-(c.lessons_used||0))
              const endDate = c.subscription_end_with_freeze || c.subscription_end
              const days = daysLeft(endDate)
              const daysColor = days !== null ? (days < 7 ? '#e55' : days < 30 ? '#f90' : '#2a9') : '#aaa'
              const lessonsColor = lessonsLeft !== '∞' && lessonsLeft <= 3 ? '#e55' : '#333'

              return (
                <tr key={c.id} onClick={() => onClientSelect(c.id)}
                  style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                    {c.name}
                    {c.phone && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{c.phone}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#555' }}>{c.subscription_type || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: lessonsColor }}>
                    {c.subscription_type ? lessonsLeft : '—'}
                    {!c.is_unlimited && c.lessons_total > 0 && (
                      <span style={{ color: '#aaa', fontWeight: 400 }}> / {c.lessons_total}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: daysColor, fontWeight: days !== null && days < 14 ? 600 : 400 }}>
                    {days !== null ? `${days} дн` : '—'}
                    {endDate && <div style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>{new Date(endDate).toLocaleDateString('ru-RU')}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#888', fontSize: 12 }}>
                    {c.last_visit ? new Date(c.last_visit).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: c.stage === 'ученик' ? '#e8f5e9' : '#fff3e0', color: c.stage === 'ученик' ? '#2e7d32' : '#e65100' }}>
                      {c.stage}
                    </span>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>Ученики не найдены</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
