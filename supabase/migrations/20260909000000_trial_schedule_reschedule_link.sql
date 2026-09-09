-- Link rescheduled trial entries to their moved counterpart
-- moved_to_id: FK from original entry → moved entry (null = not yet rescheduled or unlinked)
-- rescheduled_time: stores the target time so it survives re-opening the modal
ALTER TABLE trial_schedule
  ADD COLUMN IF NOT EXISTS moved_to_id INTEGER REFERENCES trial_schedule(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rescheduled_time TEXT;
