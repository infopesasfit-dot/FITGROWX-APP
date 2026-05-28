ALTER TABLE gym_classes
  ADD COLUMN IF NOT EXISTS end_time      TIME,
  ADD COLUMN IF NOT EXISTS accent_color  TEXT,
  ADD COLUMN IF NOT EXISTS wod_type      TEXT,
  ADD COLUMN IF NOT EXISTS wod_time_cap  INT,
  ADD COLUMN IF NOT EXISTS wod_content   TEXT,
  ADD COLUMN IF NOT EXISTS wod_rounds    INT;
