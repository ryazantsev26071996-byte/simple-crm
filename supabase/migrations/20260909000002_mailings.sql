-- Mailing campaigns — kanban columns managed by admin
CREATE TABLE mailing_campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mailing statuses — labels shown on each card (not columns)
CREATE TABLE mailing_statuses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: one row per client per campaign
CREATE TABLE client_mailings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES mailing_campaigns(id) ON DELETE CASCADE,
  status_id INTEGER REFERENCES mailing_statuses(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID
);

ALTER TABLE mailing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailing_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_mailings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON mailing_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON mailing_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON client_mailings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default campaigns and statuses so the board isn't empty on first open
INSERT INTO mailing_campaigns (name, sort_order) VALUES
  ('1 месяц', 0), ('Пробный месяц', 1), ('Тест-драйв', 2);

INSERT INTO mailing_statuses (name, sort_order) VALUES
  ('в работе', 0), ('отправлено', 1), ('отказано', 2);
