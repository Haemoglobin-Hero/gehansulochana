-- SCIENCE//CLASS — Supabase database setup
-- Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  student_id text unique not null,
  full_name text not null,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.student_access (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(student_id) on delete cascade,
  class_name text not null,
  created_at timestamptz not null default now(),
  unique(student_id,class_name)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  title text not null,
  description text,
  type text not null default 'material' check (type in ('material','recording','paper','link')),
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.zoom_details (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  title text,
  meeting_id text not null,
  password text not null,
  join_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_id text not null,
  class_name text not null,
  month text not null,
  amount numeric(10,2) not null,
  slip_path text,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;
alter table public.student_access enable row level security;
alter table public.resources enable row level security;
alter table public.zoom_details enable row level security;
alter table public.payments enable row level security;

-- Student can see their own profile.
create policy "students read own profile" on public.students for select to authenticated using (auth.uid() = user_id or exists (select 1 from public.students a where a.user_id=auth.uid() and a.role='admin'));
-- Student can see only their own access.
create policy "students read own access" on public.student_access for select to authenticated using (student_id = (select s.student_id from public.students s where s.user_id=auth.uid()) or exists (select 1 from public.students a where a.user_id=auth.uid() and a.role='admin'));
-- Authenticated users can read resources; UI filters them to assigned classes.
create policy "authenticated read resources" on public.resources for select to authenticated using (true);
create policy "authenticated read zoom" on public.zoom_details for select to authenticated using (true);
-- Anyone can submit a payment from the public payment form.
create policy "public submit payments" on public.payments for insert to anon, authenticated with check (true);
-- Students can see their own payment history; admins can see all.
create policy "students read own payments" on public.payments for select to authenticated using (student_id = (select s.student_id from public.students s where s.user_id=auth.uid()) or exists (select 1 from public.students a where a.user_id=auth.uid() and a.role='admin'));

-- Storage bucket for payment slips. Create it as public=false.
insert into storage.buckets (id,name,public) values ('payment-slips','payment-slips',false) on conflict (id) do nothing;
create policy "public upload payment slips" on storage.objects for insert to anon, authenticated with check (bucket_id='payment-slips');
create policy "admins read payment slips" on storage.objects for select to authenticated using (bucket_id='payment-slips' and exists (select 1 from public.students a where a.user_id=auth.uid() and a.role='admin'));

-- Example student profile. Replace the UUID with the user's auth.users id after creating the user.
-- Login email convention used by the website: gs3399@students.scienceclass.app
-- INSERT INTO public.students(user_id,student_id,full_name) VALUES ('AUTH-USER-UUID','GS3399','Pevin Dewnuka');
-- INSERT INTO public.student_access(student_id,class_name) VALUES ('GS3399','Grade 11'),('GS3399','Rapid Revision 2026');

-- Example content:
-- INSERT INTO public.resources(class_name,title,description,type,url) VALUES
-- ('Grade 11','Lesson 01 Recording','Full Zoom recording','recording','https://example.com/recording'),
-- ('Grade 11','Unit 01 Notes','PDF notes','material','https://example.com/notes');
-- INSERT INTO public.zoom_details(class_name,title,meeting_id,password,join_url) VALUES
-- ('Grade 11','Weekly Theory Class','123 456 789','science11','https://zoom.us/j/123456789');
