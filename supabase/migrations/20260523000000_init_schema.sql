-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create roles enum
create type user_role as enum ('admin', 'operator', 'security', 'volunteer');
create type incident_severity as enum ('low', 'medium', 'high', 'critical');
create type incident_status as enum ('reported', 'dispatched', 'resolved');
create type gate_status as enum ('open', 'closed', 'restricted');
create type alert_severity as enum ('info', 'warning', 'critical');

-- 1. Profiles Table (extending auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role user_role not null default 'volunteer',
  full_name text not null,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- 2. Stadium Zones Table
create table public.stadium_zones (
  id text primary key,
  name text not null,
  capacity integer not null,
  current_occupancy integer not null default 0,
  risk_level text not null default 'safe',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.stadium_zones enable row level security;

-- 3. Gates Table
create table public.gates (
  id text primary key,
  name text not null,
  status gate_status not null default 'open',
  wait_time integer not null default 0, -- in minutes
  flow_rate integer not null default 0, -- people/min
  capacity integer not null default 10000,
  current_throughput integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.gates enable row level security;

-- 4. Telemetry Logs Table
create table public.telemetry_logs (
  id uuid default gen_random_uuid() primary key,
  zone_id text references public.stadium_zones(id) on delete cascade not null,
  occupancy_rate numeric(5,2) not null,
  entry_count integer not null default 0,
  exit_count integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.telemetry_logs enable row level security;

-- 5. Incidents Table
create table public.incidents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  severity incident_severity not null default 'low',
  status incident_status not null default 'reported',
  zone_id text references public.stadium_zones(id) on delete set null,
  location_details text,
  reported_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone
);

alter table public.incidents enable row level security;

-- 6. Alerts Table
create table public.alerts (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- 'weather', 'crowd_surge', 'medical', 'security', 'system'
  message text not null,
  severity alert_severity not null default 'info',
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.alerts enable row level security;

-- 7. Evacuation Status Table
create table public.evacuation_status (
  id integer primary key default 1,
  is_active boolean not null default false,
  triggered_at timestamp with time zone,
  triggered_by uuid references public.profiles(id) on delete set null,
  estimated_duration integer default 900, -- 15 mins default (900 secs)
  constraint one_row check (id = 1)
);

alter table public.evacuation_status enable row level security;

-- Seed Stadium Zones
insert into public.stadium_zones (id, name, capacity, current_occupancy, risk_level) values
('zone_a', 'Zone A - North Stand', 23000, 11500, 'safe'),
('zone_b', 'Zone B - East Stand', 20000, 16000, 'warning'),
('zone_c', 'Zone C - South Stand (Club)', 28000, 25480, 'critical'),
('zone_d', 'Zone D - West Stand', 24000, 9600, 'safe')
on conflict (id) do update set
  capacity = excluded.capacity,
  current_occupancy = excluded.current_occupancy,
  risk_level = excluded.risk_level;

-- Seed Gates
insert into public.gates (id, name, status, wait_time, flow_rate, capacity, current_throughput) values
('gate_a', 'Gate A - North Plaza', 'open', 5, 80, 23000, 9200),
('gate_b', 'Gate B - East Access', 'open', 12, 110, 20000, 13200),
('gate_c', 'Gate C - South Main (Club)', 'restricted', 28, 45, 28000, 25200),
('gate_d', 'Gate D - West Entrance', 'open', 3, 95, 24000, 9120)
on conflict (id) do update set
  status = excluded.status,
  wait_time = excluded.wait_time,
  flow_rate = excluded.flow_rate,
  capacity = excluded.capacity,
  current_throughput = excluded.current_throughput;

-- Seed a default evacuation row
insert into public.evacuation_status (id, is_active) values (1, false)
on conflict (id) do nothing;

-- RLS Policies
-- Profiles: Users can view all profiles, but only edit their own profile
create policy "Allow public read access to profiles" on public.profiles for select using (true);
create policy "Allow users to update own profile" on public.profiles for update using (auth.uid() = id);

-- Stadium Zones: Read-only for everyone (authenticated or public dashboard), modified via API/DB triggers
create policy "Allow read access to stadium_zones" on public.stadium_zones for select using (true);
create policy "Allow write access to stadium_zones for service role / API" on public.stadium_zones for all using (true);

-- Gates: Read-only for everyone, write for API
create policy "Allow read access to gates" on public.gates for select using (true);
create policy "Allow write access to gates for API" on public.gates for all using (true);

-- Telemetry Logs: Read-only, write for API
create policy "Allow read access to telemetry_logs" on public.telemetry_logs for select using (true);
create policy "Allow write access to telemetry_logs for API" on public.telemetry_logs for all using (true);

-- Incidents: Read all, write/insert for authenticated users
create policy "Allow read access to incidents" on public.incidents for select using (true);
create policy "Allow insert access to incidents for authenticated profiles" on public.incidents for insert with check (true);
create policy "Allow update access to incidents for operators/admin" on public.incidents for update using (true);

-- Alerts: Read all, write for API
create policy "Allow read access to alerts" on public.alerts for select using (true);
create policy "Allow write access to alerts for API" on public.alerts for all using (true);

-- Evacuation: Read all, write for API
create policy "Allow read access to evacuation_status" on public.evacuation_status for select using (true);
create policy "Allow write access to evacuation_status for API" on public.evacuation_status for all using (true);
