-- Supabase SQL Editor에서 이 파일 내용을 그대로 실행하세요.

-- 1. 체크리스트 항목 테이블
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  period text not null check (period in ('daily','weekly','monthly','quarterly','semiannual','annual')),
  name text not null,
  created_at timestamptz default now()
);

-- 2. 완료 기록 테이블 (주기별로 완료했는지 기록)
create table if not exists checklist_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id uuid references checklist_items(id) on delete cascade not null,
  cycle_key text not null,
  completed_at timestamptz default now(),
  unique (item_id, cycle_key)
);

-- 3. Row Level Security 활성화 (본인 데이터만 접근 가능하도록)
alter table checklist_items enable row level security;
alter table checklist_log enable row level security;

create policy "본인 항목만 조회" on checklist_items for select using (auth.uid() = user_id);
create policy "본인 항목만 추가" on checklist_items for insert with check (auth.uid() = user_id);
create policy "본인 항목만 삭제" on checklist_items for delete using (auth.uid() = user_id);
create policy "본인 항목만 수정" on checklist_items for update using (auth.uid() = user_id);

create policy "본인 기록만 조회" on checklist_log for select using (auth.uid() = user_id);
create policy "본인 기록만 추가" on checklist_log for insert with check (auth.uid() = user_id);
create policy "본인 기록만 삭제" on checklist_log for delete using (auth.uid() = user_id);
