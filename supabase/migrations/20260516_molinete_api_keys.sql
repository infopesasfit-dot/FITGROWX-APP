create table if not exists molinete_api_keys (
  id            uuid        primary key default gen_random_uuid(),
  gym_id        uuid        not null references gyms(id) on delete cascade,
  key_hash      text        not null,           -- SHA-256 del token raw; nunca se guarda el token en claro
  label         text        not null default 'Molinete',
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

-- lookup rápido por hash (solo keys activas)
create unique index if not exists idx_molinete_keys_hash
  on molinete_api_keys(key_hash)
  where revoked_at is null;

-- listar keys activas de un gym
create index if not exists idx_molinete_keys_gym
  on molinete_api_keys(gym_id)
  where revoked_at is null;
