create table accounts (
  id uuid primary key,
  name text not null,
  type text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table users (
  id uuid primary key,
  account_id uuid not null references accounts(id),
  email text null,
  display_name text null,
  role text not null,
  auth_provider text not null,
  auth_subject text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (auth_provider, auth_subject)
);

create table profiles (
  id uuid primary key,
  account_id uuid not null references accounts(id),
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table profile_progress (
  profile_id uuid primary key references profiles(id),
  version integer not null,
  ufli_progress jsonb not null,
  xp integer not null,
  selected_friend jsonb null,
  skill_state jsonb not null,
  skill_state_schema_version integer not null,
  updated_at timestamptz not null
);

create table progress_operations (
  id uuid primary key,
  profile_id uuid not null references profiles(id),
  client_operation_id text not null,
  base_version integer not null,
  operation_type text not null,
  payload jsonb not null,
  status text not null,
  applied_snapshot_version integer null,
  error_code text null,
  error_message text null,
  received_at timestamptz not null,
  unique (profile_id, client_operation_id)
);

create table event_log (
  id uuid primary key,
  profile_id uuid not null references profiles(id),
  client_event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  schema_version integer not null,
  payload jsonb not null,
  received_at timestamptz not null,
  unique (profile_id, client_event_id)
);

create index idx_users_account_id on users(account_id);
create index idx_profiles_account_id on profiles(account_id);
create index idx_progress_operations_profile_id_received_at on progress_operations(profile_id, received_at);
create index idx_event_log_profile_id_received_at on event_log(profile_id, received_at);
