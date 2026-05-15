create table if not exists public.wa_queue (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null,
  phone        text not null,
  message      text not null,
  priority     text not null default 'bulk',  -- 'high' | 'bulk'
  scheduled_at timestamptz not null default now(),
  sent_at      timestamptz,
  failed_at    timestamptz,
  attempts     int not null default 0,
  error        text,
  dedup_key    text,
  created_at   timestamptz not null default now(),
  constraint wa_queue_dedup unique (dedup_key)
);

-- Index for flush cron: only pending, ordered by priority then time
create index if not exists wa_queue_pending_idx
  on public.wa_queue (priority asc, scheduled_at asc)
  where sent_at is null and failed_at is null;
