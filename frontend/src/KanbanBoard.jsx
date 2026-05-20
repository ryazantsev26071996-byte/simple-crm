import { useState } from 'react'
import { supabase } from './supabase'

const STAGES = [
  'новая заявка','записан на пробное','на следующий месяц','был не купил',
  'не пришел','дожимать','продажа','ученик','бронь','тест-драйв',
  'пробный месяц','рассылка','на МК или ОД','корявый лид','расторжение',
]

const TEACHER_STAGES = ['ученик', 'пробный месяц', 'тест-драйв']

export function KanbanBoard({ clients, role, onClientSelect, onStageChange }) {
  const visibleStages = role === 'teacher' ? TEACHER_STAGES : STAGES
  const visibleClients = role === 'teacher'
    ? clients.filter(c => TEACHER_STAGES.includes(c.stage))
    : clients

  async function handleDrop(clientId, newStage) {
    const { error } = await supabase.from('clients').update({ stage: newStage }).eq('id', clientId)
    if (!error) onStageChange(clientId, newStage)
  }

  return (
    <div style={{ overflowX: 'auto', padding: '12px 0', height: '100%' }}>
      <div style={{ display: 'flex', gap: 10, minWidth: 'max-content', padding: '0 16px', alignItems: 'flex-start' }}>
        {visibleStages.map(stage => (
          <Column
            key={stage}
            stage={stage}
            clients={visibleClients.filter(c => c.stage === stage)}
            onClientSelect={onClientSelect}
            onDrop={handleDrop}
          />
        ))}
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
      style={{ width: 190, minHeight: 200, background: over ? '#e8f4ff' : '#f5f5f5', borderRadius: 8, padding: 8, border: over ? '2px dashed #4a90e2' : '2px solid transparent' }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: '#666', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>{stage}</span>
        <span style={{ background: '#ddd', borderRadius: 20, padding: '1px 6px', fontSize: 11 }}>{clients.length}</span>
      </div>
      {clients.map(client => <Card key={client.id} client={client} onClientSelect={onClientSelect} />)}
    </div>
  )
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
      {client.phone && <div style={{ color: '#888', fontSize: 12 }}>{client.phone}</div>}
      {client.subscription && (
        <div style={{ marginTop: 4, fontSize: 11, background: '#f0f7ff', color: '#4a90e2', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
          {client.subscription}
        </div>
      )}
    </div>
  )
}
