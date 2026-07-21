import React from "react";

const TEACHER_STAGES = ['ученик', 'пробный месяц', 'тест-драйв']

const SUB_MONTHS = {
  'Отдыхай': 6, 'Отдыхай с бонусами': 6, 'Отдыхай старый': 6,
  'Изучай': 9, 'Изучай с бонусами': 9, 'Изучай старый': 12, 'Изучай старый с бонусами': 12,
  'Покоряй': 12, 'Покоряй с бонусами': 12, 'Покоряй старый': 12,
  '3 месяца': 3,
}
const SUB_DAYS = {
  'Тест-драйв': 7,
  'Пробный месяц': 30,
  '8 занятий': 30,
}

function calcEndDate(start, type) {
  if (!start || !type) return null
  const d = new Date(start)
  if (SUB_MONTHS[type]) { d.setMonth(d.getMonth() + SUB_MONTHS[type]); return d.toISOString().slice(0,10) }
  if (SUB_DAYS[type])   { d.setDate(d.getDate() + SUB_DAYS[type]);     return d.toISOString().slice(0,10) }
  return null
}

function effectiveEnd(c) {
  if (c.subscription_end_with_freeze) return c.subscription_end_with_freeze;
  if (c.subscription_end) {
    if (c.freeze_days_used > 0) {
      const d = new Date(c.subscription_end);
      d.setDate(d.getDate() + (c.freeze_days_used || 0));
      return d.toISOString().slice(0, 10);
    }
    return c.subscription_end;
  }
  const base = calcEndDate(c.subscription_start, c.subscription_type);
  if (!base) return null;
  if (c.freeze_days_used > 0) {
    const d = new Date(base);
    d.setDate(d.getDate() + (c.freeze_days_used || 0));
    return d.toISOString().slice(0, 10);
  }
  return base;
}

function daysLeft(endDate) {
  if (!endDate) return null
  return Math.ceil((new Date(endDate) - new Date()) / 86400000)
}

export function TeacherView({ clients, onClientSelect }) {
  const [search, setSearch] = React.useState('')
  const [contractSearch, setContractSearch] = React.useState('')
  const [sortField, setSortField] = React.useState('name')
  const [sortDir, setSortDir] = React.useState('asc')
  const [showLost, setShowLost] = React.useState(false)

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
    .filter(c => {
      if (!contractSearch) return true
      return (c.contract_number||'').toString().includes(contractSearch)
    })
    .sort((a, b) => {
      let aVal, bVal
      if (sortField === 'lessons_left') {
        aVal = a.is_unlimited ? 9999 : Math.max(0, (a.lessons_total||0)-(a.lessons_used||0))
        bVal = b.is_unlimited ? 9999 : Math.max(0, (b.lessons_total||0)-(b.lessons_used||0))
      } else if (sortField === 'days_left') {
        aVal = daysLeft(effectiveEnd(a)) ?? 9999
        bVal = daysLeft(effectiveEnd(b)) ?? 9999
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

  function SortTh({ field, label, style: extraStyle }) {
    return (
      <th onClick={() => toggleSort(field)}
        style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', background: '#fafafa', ...extraStyle }}>
        {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  const lostStudents = React.useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return clients
      .filter(c => c.stage === 'ученик')
      .filter(c => {
        if (!c.last_visit) return true;
        const diff = Math.floor((today - new Date(c.last_visit)) / (1000*60*60*24));
        return diff > 7;
      })
      .map(c => {
        const days = c.last_visit ? Math.floor((today - new Date(c.last_visit)) / (1000*60*60*24)) : null;
        return { ...c, _daysSince: days };
      })
      .sort((a, b) => {
        if (a._daysSince === null && b._daysSince === null) return 0;
        if (a._daysSince === null) return -1;
        if (b._daysSince === null) return 1;
        return b._daysSince - a._daysSince;
      });
  }, [clients]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или номеру..."
            style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none' }}
          />
          <input
            value={contractSearch}
            onChange={e => setContractSearch(e.target.value)}
            placeholder="Поиск по № договора..."
            style={{ width: 180, padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none' }}
          />
          <button
            onClick={() => setShowLost(v => !v)}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', background: showLost ? '#e55' : 'white', color: showLost ? 'white' : '#e55', fontWeight: 500 }}
          >
            Потеряшки {lostStudents.length > 0 && <span style={{ background: showLost ? 'rgba(255,255,255,0.3)' : '#ffe0e0', color: showLost ? 'white' : '#e55', borderRadius: 20, padding: '1px 6px', fontSize: 11, marginLeft: 4 }}>{lostStudents.length}</span>}
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>
          {showLost
            ? <>Ученики без занятий более 7 дней: <strong style={{ color: '#e55' }}>{lostStudents.length}</strong></>
            : <>Учеников на абонементах: <strong>{filtered.length}</strong></>
          }
        </div>
      </div>

      {showLost ? (
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid #eee', background: '#fafafa' }}>
                {['Имя', 'Телефон', 'Абонемент', 'Занятий осталось', 'Последнее занятие', 'Дней без занятий'].map(col => (
                  <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap', ...(col === 'Имя' ? { position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 2, borderRight: '1px solid #eee' } : {}) }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lostStudents.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>Потеряшек нет</td></tr>
              ) : lostStudents.map(c => {
                const lessonsLeft = c.is_unlimited ? '∞' : Math.max(0, (c.lessons_total||0)-(c.lessons_used||0));
                return (
                  <tr key={c.id} onClick={() => onClientSelect(c.id)}
                    style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '8px 12px', fontWeight: 500, position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1, borderRight: '1px solid #eee' }}>{c.name}</td>
                    <td style={{ padding: '8px 12px', color: '#888' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#888' }}>{c.subscription_type || '—'}</td>
                    <td style={{ padding: '8px 12px', color: lessonsLeft <= 3 && lessonsLeft !== '∞' ? '#e55' : '#333', fontWeight: lessonsLeft <= 3 && lessonsLeft !== '∞' ? 600 : 400 }}>{c.subscription_type ? lessonsLeft : '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#aaa', fontSize: 12 }}>{c.last_visit ? new Date(c.last_visit).toLocaleDateString('ru-RU') : '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: c._daysSince === null ? '#aaa' : c._daysSince > 30 ? '#e55' : '#e8a000' }}>{c._daysSince === null ? '—' : c._daysSince}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap', background: '#fafafa', maxWidth: 80, width: 80 }}>№ дог.</th>
                <SortTh field="name" label="Имя" style={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'white', borderRight: '1px solid #eee' }} />
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
                const endDate = effectiveEnd(c)
                const days = daysLeft(endDate)
                const isCalc = !c.subscription_end_with_freeze && !c.subscription_end && !!endDate
                const daysColor = days !== null ? (days < 7 ? '#e55' : days < 30 ? '#f90' : '#2a9') : '#aaa'
                const lessonsColor = lessonsLeft !== '∞' && lessonsLeft <= 3 ? '#e55' : '#333'

                return (
                  <tr key={c.id} onClick={() => onClientSelect(c.id)}
                    style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '10px 8px', color: '#888', fontSize: 12, maxWidth: 80, width: 80 }}>{c.contract_number || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, position: 'sticky', left: 0, zIndex: 1, backgroundColor: 'white', borderRight: '1px solid #eee' }}>
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
                      {endDate && (
                        <div style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>
                          {new Date(endDate).toLocaleDateString('ru-RU')}
                          {isCalc && <span style={{ marginLeft: 3, color: '#ccc' }}>*</span>}
                        </div>
                      )}
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
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>Ученики не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
