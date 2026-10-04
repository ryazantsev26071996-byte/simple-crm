export const SUB_MONTHS = {
  'Отдыхай': 6, 'Отдыхай с бонусами': 6, 'Отдыхай старый': 6,
  'Изучай': 9, 'Изучай с бонусами': 9, 'Изучай старый': 12, 'Изучай старый с бонусами': 12,
  'Покоряй': 12, 'Покоряй с бонусами': 12, 'Покоряй старый': 12,
  '3 месяца': 3,
};

const SUB_DAYS = {
  'Тест-драйв': 7,
  'Пробный месяц': 30,
  '8 занятий': 30,
};

export function getSubscriptionMonths(type) {
  return type ? (SUB_MONTHS[type] ?? null) : null;
}

export function effectiveEndDate(client) {
  if (client.subscription_end_with_freeze) return client.subscription_end_with_freeze;

  const freeze = client.freeze_days_used || 0;

  if (client.subscription_end) {
    if (freeze > 0) {
      const d = new Date(client.subscription_end);
      d.setDate(d.getDate() + freeze);
      return d.toISOString().slice(0, 10);
    }
    return client.subscription_end;
  }

  const start = client.subscription_start;
  if (!start) return null;

  let base = null;
  if (client.subscription_months && client.subscription_months > 0) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + client.subscription_months);
    base = d.toISOString().slice(0, 10);
  } else if (client.subscription_type) {
    if (SUB_MONTHS[client.subscription_type]) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + SUB_MONTHS[client.subscription_type]);
      base = d.toISOString().slice(0, 10);
    } else if (SUB_DAYS[client.subscription_type]) {
      const d = new Date(start);
      d.setDate(d.getDate() + SUB_DAYS[client.subscription_type]);
      base = d.toISOString().slice(0, 10);
    }
  }

  if (!base) return null;

  if (freeze > 0) {
    const d = new Date(base);
    d.setDate(d.getDate() + freeze);
    return d.toISOString().slice(0, 10);
  }
  return base;
}
