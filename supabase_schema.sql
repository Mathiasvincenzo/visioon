-- VISIOON — initial Supabase schema
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run

-- 1. Profiles (one row per auth user — both admin and models)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'model')),
  display_name text not null,
  niche text,
  persona text,
  platforms text,
  comfort text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Trends
create table public.trends (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  format text not null,
  effort text not null,
  why text,
  adapt text,
  status text not null default 'ny' check (status in ('ny', 'testes', 'bevist', 'utgatt')),
  created_at timestamptz not null default now()
);

-- 3. Weeks
create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  monday_date date not null,
  iso_week int not null,
  year int not null,
  focus_text text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4. Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  model_id uuid references public.profiles(id) on delete cascade,
  trend_id uuid references public.trends(id) on delete set null,
  title text not null,
  hook text,
  execution text,
  format text not null,
  effort text not null,
  deadline_date date,
  status text not null default 'ny' check (status in ('ny', 'planlagt', 'filmet', 'postet')),
  posted_url text,
  proof_image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Task comments
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_role text not null check (author_role in ('admin', 'model')),
  body text not null,
  read_by_admin boolean not null default false,
  read_by_model boolean not null default false,
  created_at timestamptz not null default now()
);

-- Helper: check if the current user is an admin, without recursive RLS lookups
create or replace function public.is_admin()
returns boolean
language sql security definer
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.trends enable row level security;
alter table public.weeks enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

-- profiles: admin sees/edits everyone, a model sees/edits only herself
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin());
create policy "profiles_self_select" on public.profiles for select using (id = auth.uid());
create policy "profiles_self_update" on public.profiles for update using (id = auth.uid());

-- trends: admin full access, models read-only
create policy "trends_admin_all" on public.trends for all using (public.is_admin());
create policy "trends_model_select" on public.trends for select using (true);

-- weeks: admin full access, models can only see published weeks
create policy "weeks_admin_all" on public.weeks for all using (public.is_admin());
create policy "weeks_model_select" on public.weeks for select using (published = true);

-- tasks: admin full access, models see/update only their own rows
create policy "tasks_admin_all" on public.tasks for all using (public.is_admin());
create policy "tasks_model_select" on public.tasks for select using (model_id = auth.uid());
create policy "tasks_model_update" on public.tasks for update using (model_id = auth.uid());

-- task_comments: admin full access, models see/insert only on their own tasks
create policy "comments_admin_all" on public.task_comments for all using (public.is_admin());
create policy "comments_model_select" on public.task_comments for select using (
  exists (select 1 from public.tasks t where t.id = task_id and t.model_id = auth.uid())
);
create policy "comments_model_insert" on public.task_comments for insert with check (
  author_role = 'model' and exists (select 1 from public.tasks t where t.id = task_id and t.model_id = auth.uid())
);
