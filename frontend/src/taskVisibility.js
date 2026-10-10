const OWNER_NAME = 'Администратор-VIP';

function norm(s) {
  return (s || '').trim().toLowerCase();
}

function listIncludes(field, name) {
  if (!field || !name) return false;
  const n = norm(name);
  if (Array.isArray(field)) return field.some(x => norm(x) === n);
  if (typeof field === 'string') {
    try {
      const arr = JSON.parse(field);
      if (Array.isArray(arr)) return arr.some(x => norm(x) === n);
    } catch {}
    return field.split(',').map(x => norm(x.trim())).includes(n);
  }
  return false;
}

export function canSeeTask(task, { email, role, name }) {
  // Tasks not assigned to owner are always visible
  if (norm(task.assigned_to) !== norm(OWNER_NAME)) return true;

  // Owner sees all their tasks
  if (email === 'crm@artschool.ru') return true;

  // Supervisor (Салампи) sees all
  if (role === 'supervisor') return true;

  const myName = norm(name);
  if (!myName) return false;

  // Creator sees the task
  if (task.created_by_name && norm(task.created_by_name) === myName) return true;

  // Co-executor sees the task
  if (listIncludes(task.co_executors, name)) return true;

  // Observer sees the task
  if (listIncludes(task.observers, name)) return true;

  return false;
}
