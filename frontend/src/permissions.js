export const isOwner = (user) => user?.email === 'crm@artschool.ru';
export const canDelete = (user, role) => isOwner(user) || (role !== 'supervisor');
