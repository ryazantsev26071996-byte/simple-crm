import { useState } from 'react'
import React from 'react'
import { supabase } from './supabase'
import ClientForm from './components/ClientForm.jsx'

const STAGES = [
  'новая заявка','записан на пробное','на следующий месяц','был не купил',
  'не пришел','дожимать','продажа','ученик','бронь','тест-драйв',
  'пробный месяц','рассылка','на МК или ОД','корявый лид','расторжение','кончился абонемент',
]

const TEACHER_STAGES = ['ученик', 'пробный месяц', 'тест-драйв']

function normalizePhone(phone) {
  return phone ? phone.replace(/\D/g, '') : ''
}

function matchesSearch(client, query) {
  if (!query) return true
  const q = query.toLowerCase().trim()
  const digits = q.replace(/\D/g, '')
  if (client.name?.toLowerCase().includes(q)) return true
  if (digits && normalizePhone(client.phone).endsWith(digits)) return true
  return false
}

function ClientFormInline({ onSubmit, onOpenClient }) {
  const [error, setError] = React.useState('');
  return (
    <div>
      {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <ClientForm mode="Новый клиент" disabled={false} submitLabel="Добавить"
        onOpenClient={onOpenClient}
        onSubmit={async (payload) => {
          try { setError(''); await onSubmit(payload); }
          catch(err) { setError(err.message); }
        }}
      />
    </div>
  );
}

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

export function KanbanBoard({ clients, role, onClientSelect, onStageChange, onAddClient, onClientCreated, taskBadges = {} }) {
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [filterMonth, setFilterMonth] = useState('all')
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768)

  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const visibleStages = role === 'teacher' ? TEACHER_STAGES : STAGES
  const currentYear = new Date().getFullYear()

  function matchesMonth(client) {
    if (filterMonth === 'all') return true
    if (!client.created_at) return false
    const [y, m] = filterMonth.split('-').map(Number)
    const d = new Date(client.created_at)
    return d.getFullYear() === y && d.getMonth()+1 === m
  }

  const filteredClients = clients.filter(c => matchesSearch(c, search) && matchesMonth(c))

  function getStageTotalAmount(stage) {
    if (stage !== 'ученик' && stage !== 'продажа') return null
    if (role !== 'manager' && role !== 'accountmanager' && role !== 'admin') return null
    if (filterMonth === 'all') return null
    return filteredClients
      .filter(c => c.stage === stage)
      .reduce((sum, c) => sum + (c.amount_paid || 0), 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid #eee', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или последним цифрам номера..."
          style={{ flex: 1, minWidth: 0, padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none' }}
        />
        {(role === 'manager' || role === 'accountmanager' || role === 'admin') && (
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
            <option value="all">Все месяцы</option>
            {MONTHS_RU.map((name, i) => {
              const value = `${currentYear}-${String(i+1).padStart(2,'0')}`
              return <option key={value} value={value}>{name} {currentYear}</option>
            })}
          </select>
        )}
        {(role === 'manager' || role === 'accountmanager' || role === 'admin') && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#4a90e2', color: 'white', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500 }}
          >
            +<span className="btnLabel"> Добавить клиента</span>
          </button>
        )}
        {search && <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>Найдено: {filteredClients.length}</div>}
      </div>

      <div className="kanbanScroll" style={{ display: 'flex', overflowX: 'auto', height: 'calc(100vh - 120px)', alignItems: 'flex-start', gap: 10, padding: '12px 16px' }}>
        {visibleStages.map(stage => (
          <Column
            key={stage}
            stage={stage}
            clients={filteredClients.filter(c => c.stage === stage)}
            onClientSelect={onClientSelect}
            onDrop={(id, newStage) => onStageChange(id, newStage)}
            totalAmount={getStageTotalAmount(stage)}
            isMobile={isMobile}
            taskBadges={taskBadges}
          />
        ))}
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>Новый клиент</strong>
              <button onClick={() => setShowAddModal(false)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            <ClientFormInline
              onOpenClient={(id) => { setShowAddModal(false); onClientSelect(id); }}
              onSubmit={async (payload) => {
                if (onClientCreated) await onClientCreated(payload);
                setShowAddModal(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Column({ stage, clients, onClientSelect, onDrop, totalAmount, isMobile, taskBadges = {} }) {
  const [over, setOver] = useState(false)
  const bg = over ? '#e8f4ff' : '#f5f5f5'
  const colWidth = isMobile ? 280 : 200
  const colMaxWidth = isMobile ? 300 : 220
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const id = Number(e.dataTransfer.getData('clientId')); onDrop(id, stage) }}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: colWidth, maxWidth: colMaxWidth, flexShrink: 0, background: bg, borderRadius: 8, border: over ? '2px dashed #4a90e2' : '2px solid transparent' }}
    >
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: bg, padding: '8px 8px 4px', borderRadius: '8px 8px 0 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
          <span>{stage}</span>
          <span style={{ background: clients.length > 0 ? '#4a90e2' : '#ddd', color: clients.length > 0 ? 'white' : '#555', borderRadius: 20, padding: '1px 6px', fontSize: 11 }}>{clients.length}</span>
        </div>
        {totalAmount !== null && (
          <div style={{ fontSize: 11, color: '#2a9', fontWeight: 600, marginTop: 4 }}>
            {totalAmount.toLocaleString('ru-RU')} ₽
          </div>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
        {clients.map(client => <Card key={client.id} client={client} onClientSelect={onClientSelect} taskBadge={taskBadges[client.id]} />)}
      </div>
    </div>
  )
}

const contactLinkStyle = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }

function renderContact(value) {
  if (!value) return null
  if (value.startsWith('@'))
    return <a href={`https://t.me/${value.slice(1)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={contactLinkStyle}>{value}</a>
  if (value.startsWith('t.me/'))
    return <a href={`https://${value}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={contactLinkStyle}>{value}</a>
  if (value.startsWith('vk.com/'))
    return <a href={`https://${value}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={contactLinkStyle}>{value}</a>
  return formatPhone(value)
}

function formatPhone(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7 ${digits.slice(1,4)} ${digits.slice(4,7)} ${digits.slice(7,9)} ${digits.slice(9,11)}`
  }
  if (digits.length === 10) {
    return `+7 ${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,8)} ${digits.slice(8,10)}`
  }
  return phone
}

function Card({ client, onClientSelect, taskBadge }) {
  const isNew = !client.viewed_at && client.created_at &&
    (Date.now() - new Date(client.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('clientId', client.id)}
      onClick={() => onClientSelect(client.id)}
      style={{ position: 'relative', background: 'white', borderRadius: 6, padding: '8px 10px', marginBottom: 6, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: 13 }}
    >
      <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 3, alignItems: 'center' }}>
        {taskBadge && (
          <span style={{ background: taskBadge.color, color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, lineHeight: 1.2 }}>
            {taskBadge.count}
          </span>
        )}
        {isNew && (
          <span style={{ background: '#e53935', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, lineHeight: 1.2 }}>NEW</span>
        )}
      </div>
      <div style={{ fontWeight: 500, marginBottom: 2, paddingRight: taskBadge || isNew ? 36 : 0 }}>{client.name}</div>
      {client.phone && <div style={{ color: '#888', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{renderContact(client.phone)}</div>}
      {client.subscription && (
        <div style={{ marginTop: 4, fontSize: 11, background: '#f0f7ff', color: '#4a90e2', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
          {client.subscription}
        </div>
      )}
    </div>
  )
}
