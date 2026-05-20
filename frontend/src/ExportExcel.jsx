export function exportToExcel(clients) {
  const headers = [
    'Имя', 'Контакт', 'Источник', 'Стадия', 'Абонемент',
    'Занятий всего', 'Занятий использовано', 'Занятий осталось',
    'Заморозка всего', 'Заморозка использовано', 'Заморозка осталось',
    'Начало абонемента', 'Окончание абонемента', 'Окончание с заморозкой', 'Последнее занятие'
  ]

  const rows = clients.map(c => {
    const lessonsLeft = c.is_unlimited ? 'Безлимит' : Math.max(0, (c.lessons_total||0) - (c.lessons_used||0))
    const freezeLeft = (c.freeze_days_total||0) - (c.freeze_days_used||0)
    const endDate = c.subscription_end_with_freeze || c.subscription_end
    return [
      c.name || '',
      c.phone || '',
      c.source || '',
      c.stage || '',
      c.subscription_type || '',
      c.is_unlimited ? 'Безлимит' : (c.lessons_total || 0),
      c.is_unlimited ? '—' : (c.lessons_used || 0),
      lessonsLeft,
      c.freeze_days_total || 0,
      c.freeze_days_used || 0,
      freezeLeft,
      c.subscription_start || '',
      c.subscription_end || '',
      endDate || '',
      c.last_visit || '',
    ]
  })

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')
  a.download = `CRM_клиенты_${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
