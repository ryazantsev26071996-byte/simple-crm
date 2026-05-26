import { useState } from 'react'
import React from 'react'
import { supabase } from './supabase'
import ClientForm from './components/ClientForm.jsx'

const STAGES = [
  'новая заявка','записан на пробное','на следующий месяц','был не купил',
  'не пришел','дожимать','продажа','ученик','бронь','тест-драйв',
  'пробный месяц','рассылка','на МК или ОД','корявый лид','расторжение',
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

function ClientFormInline({ onSubmit }) {
  const [error, setError] = React.useState('');
  return (
    <div>
      {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <ClientForm mode="Новый клиент" disabled={false} submitLabel="Добавить"
        onSubmit={async (payload) => {
          try { setError(''); await onSubmit(payload); }
          catch(err) { setError(err.message); }
        }}
      />
    </div>
  );
}

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

export function KanbanBoard({ clients, role, onClientSelect, onStageChange, onAddClient, onClientCreated }) {
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  const visibleStages = role === 'teacher' ? TEACHER_STAGES : STAGES
  const filteredClients = clients.filter(c => matchesSearch(c, search))

  const currentYear = new Date().getFullYear()

  function getStageTotalAmount(stage) {
    if (stage !== 'ученик' && stage !== 'продажа') return null
    if (role !== 'manager' && role !== 'admin') return null
    const [y, m] = filterMonth.split('-').map(Number)
    return clients
      .filter(c => c.stage === stage && c.subscription_start)
      .filter(c => { const d = new Date(c.subscription_start); return d.getFullYear() === y && d.getMonth()+1 === m })
      .reduce((sum, c) => sum + (c.amount_paid || 0), 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid #eee', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или последним цифрам номера..."
          style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none' }}
        />
        {(role === 'manager' || role === 'admin') && (
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
            {MONTHS_RU.map((name, i) => {
              const value = `${currentYear}-${String(i+1).padStart(2,'0')}`
              return <option key={value} value={value}>{name} {currentYear}</option>
            })}
          </select>
        )}
        {(role === 'manager' || role === 'admin') && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#4a90e2', color: 'white', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500 }}
          >
            + Добавить клиента
          </button>
        )}
        {search && <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>Найдено: {filteredClients.length}</div>}
      </div>

      <div style={{ overflowX: 'auto', flex: 1, padding: '12px 0' }}>
        <div style={{ display: 'flex', gap: 10, minWidth: 'max-content', padding: '0 16px', alignItems: 'flex-start' }}>
          {visibleStages.map(stage => (
            <Column
              key={stage}
              stage={stage}
              clients={filteredClients.filter(c => c.stage === stage)}
              onClientSelect={onClientSelect}
              onDrop={(id, newStage) => onStageChange(id, newStage)}
              totalAmount={getStageTotalAmount(stage)}
            />
          ))}
        </div>
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>Новый клиент</strong>
              <button onClick={() => setShowAddModal(false)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            <ClientFormInline onSubmit={async (payload) => {
              if (onClientCreated) await onClientCreated(payload);
              setShowAddModal(false);
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Column({ stage, clients, onClientSelect, onDrop, totalAmount }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const id = Number(e.dataTransfer.getData('clientId')); onDrop(id, stage) }}
      style={{ width: 190, minHeight: 100, background: over ? '#e8f4ff' : '#f5f5f5', borderRadius: 8, padding: 8, border: over ? '2px dashed #4a90e2' : '2px solid transparent' }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: '#666', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>{stage}</span>
        <span style={{ background: clients.length > 0 ? '#4a90e2' : '#ddd', color: clients.length > 0 ? 'white' : '#555', borderRadius: 20, padding: '1px 6px', fontSize: 11 }}>{clients.length}</span>
      </div>
      {totalAmount !== null && (
        <div style={{ fontSize: 11, color: '#2a9', fontWeight: 600, marginBottom: 6 }}>
          {totalAmount.toLocaleString('ru-RU')} ₽
        </div>
      )}
      {clients.map(client => <Card key={client.id} client={client} onClientSelect={onClientSelect} />)}
    </div>
  )
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

function Card({ client, onClientSelect }) {
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('clientId', client.id)}
      onClick={() => onClientSelect(client.id)}
      style={{ background: 'white', borderRadius: 6, padding: '8px 10px', marginBottom: 6, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: 13 }}
    >
      <div style={{ fontWeight: 500, marginBottom: 2 }}>{client.name}</div>
      {client.phone && <div style={{ color: '#888', fontSize: 12 }}>{formatPhone(client.phone)}</div>}
      {client.subscription && (
        <div style={{ marginTop: 4, fontSize: 11, background: '#f0f7ff', color: '#4a90e2', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
          {client.subscription}
        </div>
      )}
    </div>
  )
}
