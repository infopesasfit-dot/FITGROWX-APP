CREATE TABLE IF NOT EXISTS monthly_dashboard_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       UUID NOT NULL,
  report_month DATE NOT NULL,
  email        TEXT NOT NULL,
  resend_id    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, report_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_dashboard_reports_gym_month
  ON monthly_dashboard_reports(gym_id, report_month DESC);
