import { useState } from 'react'
import React from 'react'
import { supabase } from './supabase'
import ClientForm from './components/ClientForm.jsx'
import { createClient } from './api.js'

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
          try {
            setError('');
            await onSubmit(payload);
          } catch(err) { setError(err.message); }
        }}
      />
    </div>
  );
}

export function KanbanBoard({ clients, role, onClientSelect, onStageChange, onAddClient, onClientCreated }) {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [search, setSearch] = useState('')

  const visibleStages = role === 'teacher' ? TEACHER_STAGES : STAGES
  const baseClients = role === 'teacher'
    ? clients.filter(c => TEACHER_STAGES.includes(c.stage))
    : clients
  const filteredClients = baseClients.filter(c => matchesSearch(c, search))

  async function handleDrop(clientId, newStage) {
    const { error } = await supabase.from('clients').update({ stage: newStage }).eq('id', clientId)
    if (!error) onStageChange(clientId, newStage)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #eee', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или последним цифрам номера..."
          style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none' }}
        />
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
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Column({ stage, clients, onClientSelect, onDrop }) {
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const id = Number(e.dataTransfer.getData('clientId')); onDrop(id, stage) }}
      style={{ width: 190, minHeight: 100, background: over ? '#e8f4ff' : '#f5f5f5', borderRadius: 8, padding: 8, border: over ? '2px dashed #4a90e2' : '2px solid transparent' }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: '#666', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>{stage}</span>
        <span style={{ background: clients.length > 0 ? '#4a90e2' : '#ddd', color: clients.length > 0 ? 'white' : '#555', borderRadius: 20, padding: '1px 6px', fontSize: 11 }}>{clients.length}</span>
      </div>
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
