// Округление до сотых. Имя round1 оставлено, чтобы не править все места использования.
export const round1 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const fmtQty = (n) => (n === null || n === undefined || n === '') ? '—' : String(round1(n));
export const stockValue = (m) => round1((Number(m.qty_full) || 0) * 1 + (Number(m.qty_half) || 0) * 0.5 + (Number(m.qty_almost_empty) || 0) * 0.25);
export const isLow = (m) => m.min_threshold !== null && m.min_threshold !== undefined && m.min_threshold !== '' && stockValue(m) <= Number(m.min_threshold);
export const lowAction = (m) => !isLow(m) ? null : (Number(m.qty_reserve) > 0 ? 'reserve' : (Number(m.qty_warehouse) > 0 ? 'warehouse' : 'buy'));
export const normName = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[-–—_.,()]/g, ' ').replace(/\s+/g, ' ').trim();
