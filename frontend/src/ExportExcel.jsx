import * as XLSX from 'xlsx'

export function exportToExcel(clients) {
  const rows = clients.map(c => {
    const lessonsLeft = c.is_unlimited ? 'Безлимит' : Math.max(0, (c.lessons_total||0) - (c.lessons_used||0))
    const freezeLeft = (c.freeze_days_total||0) - (c.freeze_days_used||0)
    const endDate = c.subscription_end_with_freeze || c.subscription_end
    return {
      'Имя': c.name || '',
      'Контакт': c.phone || '',
      'Источник': c.source || '',
      'Стадия': c.stage || '',
      'Абонемент': c.subscription_type || '',
      'Занятий всего': c.is_unlimited ? 'Безлимит' : (c.lessons_total || 0),
      'Занятий использовано': c.is_unlimited ? '—' : (c.lessons_used || 0),
      'Занятий осталось': lessonsLeft,
      'Заморозка всего (дн)': c.freeze_days_total || 0,
      'Заморозка использовано (дн)': c.freeze_days_used || 0,
      'Заморозка осталось (дн)': freezeLeft,
      'Начало абонемента': c.subscription_start || '',
      'Окончание абонемента': c.subscription_end || '',
      'Окончание с заморозкой': endDate || '',
      'Последнее занятие': c.last_visit || '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)

  // Ширина колонок
  ws['!cols'] = [
    { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
    { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 18 },
    { wch: 20 }, { wch: 22 }, { wch: 22 },
    { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 20 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Клиенты')

  const date = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')
  XLSX.writeFile(wb, `CRM_клиенты_${date}.xlsx`)
}
