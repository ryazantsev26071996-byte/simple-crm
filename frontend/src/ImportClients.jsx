import React from "react";
import { supabase } from "./supabase";

const COLUMN_MAP = {
  'name': 'name', 'имя': 'name',
  'phone': 'phone', 'номер телефона': 'phone', 'телефон': 'phone', 'номер': 'phone',
  'source': 'source', 'источник': 'source',
  'stage': 'stage', 'стадия': 'stage',
  'created_at': 'created_at', 'дата создания': 'created_at',
  'subscription_type': 'subscription_type', 'абонемент': 'subscription_type',
  'subscription_start': 'subscription_start', 'начало абонемента': 'subscription_start',
  'lessons_used': 'lessons_used', 'использовано занятий': 'lessons_used',
  'manager': 'manager',
}

const COMMENT_COLUMNS = ['comment1','comment2','comment3','comment4','comment5',
  'комментарий после звонка','комментарий после пробного','комментарий',
  'trial_date','пробное занятие']

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  
  // Определяем разделитель
  const sep = lines[0].includes(';') ? ';' : ','
  
  const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase())
  
  return lines.slice(1).map(line => {
    const values = line.split(sep).map(v => v.replace(/"/g, '').trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

export function ImportClients({ onClose, onImported }) {
  const [file, setFile] = React.useState(null)
  const [preview, setPreview] = React.useState([])
  const [headers, setHeaders] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState(null)
  const [error, setError] = React.useState('')

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setError('')
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const rows = parseCSV(text)
      setHeaders(Object.keys(rows[0] || {}))
      setPreview(rows.slice(0, 3))
    }
    reader.readAsText(f, 'utf-8')
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError('')

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const rows = parseCSV(ev.target.result)
        let imported = 0
        let skipped = 0
        let commentCount = 0

        for (const row of rows) {
          const client = {}
          const comments = []

          for (const [key, value] of Object.entries(row)) {
            if (!value) continue
            const mapped = COLUMN_MAP[key]
            if (mapped) {
              client[mapped] = value
            } else if (COMMENT_COLUMNS.some(c => key.includes(c))) {
              if (value.trim()) comments.push(value.trim())
            }
          }

          if (!client.name) { skipped++; continue; }

          // Вставляем клиента
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              name: client.name,
              phone: client.phone || null,
              source: client.source || null,
              stage: client.stage || null,
              subscription_type: client.subscription_type || null,
              subscription_start: client.subscription_start || null,
              lessons_used: client.lessons_used ? Number(client.lessons_used) : 0,
            })
            .select()
            .single()

          if (clientError) { skipped++; continue; }
          imported++

          // Вставляем комментарии
          for (const text of comments) {
            await supabase.from('comments').insert({
              client_id: newClient.id,
              text,
              author_id: null,
            })
            commentCount++
          }
        }

        setResult({ imported, skipped, commentCount })
        if (onImported) onImported()
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>📤 Импорт клиентов из CSV</div>
          <button onClick={onClose} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16, background: '#f8f9ff', padding: 12, borderRadius: 8 }}>
            <strong>Поддерживаемые колонки:</strong> name (имя), phone (телефон), source (источник), stage (стадия), subscription_type (абонемент), subscription_start (начало абонемента), lessons_used (использовано занятий), comment1, comment2... (комментарии)
            <br/><br/>
            Файл должен быть в формате CSV с разделителем <strong>;</strong> или <strong>,</strong>. Кодировка UTF-8.
          </div>

          <input type="file" accept=".csv,.txt" onChange={handleFile}
            style={{ marginBottom: 16, fontSize: 13 }} />

          {preview.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>Предпросмотр (первые 3 строки):</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>{headers.map(h => <th key={h} style={{ padding: '4px 8px', background: '#f0f0f0', border: '1px solid #ddd', textAlign: 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>{headers.map(h => <td key={h} style={{ padding: '4px 8px', border: '1px solid #eee', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[h]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          {result && (
            <div style={{ padding: 12, background: '#f0fff4', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              ✅ Загружено клиентов: <strong>{result.imported}</strong> · Пропущено: <strong>{result.skipped}</strong> · Комментариев: <strong>{result.commentCount}</strong>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ fontSize: 13, padding: '6px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Закрыть</button>
          {file && !result && (
            <button onClick={handleImport} disabled={loading} className="btn btnPrimary">
              {loading ? 'Загрузка...' : 'Импортировать'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
