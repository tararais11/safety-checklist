-- 안전보건공시 대시보드: Supabase SQL Editor에 전체를 붙여넣고 Run 하세요 (한 번만)

-- 1) 사용자 프로필
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'viewer' check (role in ('viewer','admin')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- 가입하면 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 권한 확인 함수
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and approved);
$$;

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and approved);
$$;

-- 2) 연도별 공시 데이터
create table if not exists public.disclosures (
  year int primary key,
  data jsonb not null default '{}'::jsonb,
  ceo_confirmed boolean not null default false,
  ceo_confirmed_at date,
  updated_at timestamptz not null default now()
);

-- 3) 접근 권한 (RLS)
alter table public.profiles enable row level security;
alter table public.disclosures enable row level security;

drop policy if exists "본인 또는 관리자 프로필 조회" on public.profiles;
create policy "본인 또는 관리자 프로필 조회" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "관리자만 프로필 수정" on public.profiles;
create policy "관리자만 프로필 수정" on public.profiles
  for update using (public.is_admin());

drop policy if exists "승인된 사용자 조회" on public.disclosures;
create policy "승인된 사용자 조회" on public.disclosures
  for select using (public.is_approved());

drop policy if exists "관리자 입력" on public.disclosures;
create policy "관리자 입력" on public.disclosures
  for insert with check (public.is_admin());

drop policy if exists "관리자 수정" on public.disclosures;
create policy "관리자 수정" on public.disclosures
  for update using (public.is_admin());

-- 4) 앱(로그인 사용자)에 테이블 접근 권한 부여 (RLS는 그대로 적용됨)
grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.disclosures to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved() to authenticated;

-- 5) 첫 관리자 지정: 사이트에서 가입 신청한 다음, 아래 이메일을 본인 것으로 바꿔서 이 줄만 따로 실행하세요
-- update public.profiles set role = 'admin', approved = true where email = '내이메일@회사.com';
