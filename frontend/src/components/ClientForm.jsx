import React from "react";

const STAGES = [
  'новая заявка',
  'записан на пробное',
  'на следующий месяц',
  'был не купил',
  'не пришел',
  'дожимать',
  'продажа',
  'ученик',
  'бронь',
  'тест-драйв',
  'пробный месяц',
  'рассылка',
  'на МК или ОД',
  'корявый лид',
  'расторжение',
]

export default function ClientForm({ mode, initialValue, disabled, onSubmit, submitLabel }) {
  const [form, setForm] = React.useState({
    name: initialValue?.name || "",
    phone: initialValue?.phone || "",
    source: initialValue?.source || "",
    stage: initialValue?.stage || "",
    subscription: initialValue?.subscription || "",
  });

  React.useEffect(() => {
    setForm({
      name: initialValue?.name || "",
      phone: initialValue?.phone || "",
      source: initialValue?.source || "",
      stage: initialValue?.stage || "",
      subscription: initialValue?.subscription || "",
    });
  }, [initialValue?.id]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name: form.name.trim(), phone: form.phone.trim(), source: form.source.trim(), stage: form.stage, subscription: form.subscription.trim() }); }}>
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Имя</div>
          <input className="input" value={form.name} disabled={disabled} onChange={set('name')} placeholder="Имя клиента" required />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Телефон</div>
          <input className="input" value={form.phone} disabled={disabled} onChange={set('phone')} placeholder="+7..." />
        </div>
      </div>
      <div style={{ height: 10 }} />
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Источник</div>
          <input className="input" value={form.source} disabled={disabled} onChange={set('source')} placeholder="Авито, рекомендация..." />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Стадия</div>
          <select
            className="input"
            value={form.stage}
            disabled={disabled}
            onChange={set('stage')}
            style={{ cursor: disabled ? 'default' : 'pointer' }}
          >
            <option value="">— выбрать —</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ height: 10 }} />
      <div className="formGroup">
        <div className="fieldLabel">Абонемент</div>
        <input className="input" value={form.subscription} disabled={disabled} onChange={set('subscription')} placeholder="Например: 8 занятий, безлимит..." />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button className="btn btnPrimary" type="submit" disabled={disabled}>{submitLabel}</button>
        <div className="muted" style={{ fontSize: 13 }}>{mode}</div>
      </div>
    </form>
  );
}
