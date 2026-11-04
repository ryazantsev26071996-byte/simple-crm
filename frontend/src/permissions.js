export const NO_DELETE_EMAILS = ['salampi@artschool.ru', 'arina@artschool.ru'];
export const RESTRICTED_EMAILS = ['arina@artschool.ru'];
export const isRestricted = (user) => RESTRICTED_EMAILS.includes(user?.email?.toLowerCase());
export const isOwner = (user) => user?.email === 'crm@artschool.ru';
export const canDelete = (user, role) => {
  if (isOwner(user)) return true;
  if (NO_DELETE_EMAILS.includes(user?.email?.toLowerCase())) return false;
  return role !== 'supervisor';
};
