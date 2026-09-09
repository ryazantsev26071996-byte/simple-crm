-- Link trial entries to the teacher's schedule row they auto-create
-- schedule_id: FK from trial_schedule → schedule.id (null = no linked row)
ALTER TABLE trial_schedule
  ADD COLUMN IF NOT EXISTS schedule_id INTEGER REFERENCES schedule(id) ON DELETE SET NULL;

-- Allow schedule entries to be marked cancelled without deleting them
-- (used when a linked trial is deleted/cancelled so the teacher sees what happened)
ALTER TABLE schedule
  ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT false;
