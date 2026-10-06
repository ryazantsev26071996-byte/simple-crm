export const INACTIVE_STAFF = ["Софья", "Анастасия"];

export function isActiveStaff(fullName) {
  if (!fullName) return true;
  const norm = String(fullName).trim().toLowerCase();
  return !INACTIVE_STAFF.some(n => n.toLowerCase() === norm);
}
