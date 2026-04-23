create schema if not exists private;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('scout', 'admin')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger set_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;

alter table public.inventory_reports
  alter column venue_game_id drop not null;

alter table public.inventory_reports
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists machine_label text,
  add column if not exists review_notes text;

create or replace function private.has_scout_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where
      ur.user_id = (select auth.uid())
      and ur.role in ('scout', 'admin')
  );
$$;

create or replace function private.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where
      ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;

drop policy if exists "authenticated_users_can_create_inventory_reports"
on public.inventory_reports;

drop policy if exists "users_can_read_their_own_reports"
on public.inventory_reports;

create policy "user_roles_are_visible_to_self_or_admin"
on public.user_roles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_admin_access()
);

create policy "scouts_can_create_inventory_reports"
on public.inventory_reports
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and private.has_scout_access()
);

create policy "scouts_can_read_own_reports_and_admins_can_read_all"
on public.inventory_reports
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.has_admin_access()
);

create policy "admins_can_update_inventory_reports"
on public.inventory_reports
for update
to authenticated
using (private.has_admin_access())
with check (private.has_admin_access());

create policy "admins_can_insert_venue_games"
on public.venue_games
for insert
to authenticated
with check (private.has_admin_access());

create policy "admins_can_update_venue_games"
on public.venue_games
for update
to authenticated
using (private.has_admin_access())
with check (private.has_admin_access());

create or replace function public.submit_inventory_report(
  selected_venue_id uuid,
  selected_game_id uuid,
  selected_report_type text,
  reported_quantity integer default 1,
  reported_notes text default null,
  reported_machine_label text default null
)
returns table (
  report_id uuid,
  venue_game_id uuid,
  report_status text
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
  matched_venue_game_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if reported_quantity < 1 then
    raise exception 'reported_quantity must be at least 1';
  end if;

  if not exists (
    select 1 from public.venues v where v.id = selected_venue_id
  ) then
    raise exception 'Venue not found';
  end if;

  if not exists (
    select 1 from public.games g where g.id = selected_game_id
  ) then
    raise exception 'Game not found';
  end if;

  if selected_report_type not in (
    'confirmed_present',
    'missing',
    'temporarily_unavailable',
    'new_machine',
    'quantity_changed'
  ) then
    raise exception 'Unsupported report type';
  end if;

  select vg.id
  into matched_venue_game_id
  from public.venue_games vg
  where
    vg.venue_id = selected_venue_id
    and vg.game_id = selected_game_id
  order by vg.updated_at desc
  limit 1;

  return query
  insert into public.inventory_reports (
    venue_game_id,
    venue_id,
    game_id,
    user_id,
    report_type,
    quantity,
    machine_label,
    notes
  )
  values (
    matched_venue_game_id,
    selected_venue_id,
    selected_game_id,
    current_user_id,
    selected_report_type,
    reported_quantity,
    nullif(btrim(reported_machine_label), ''),
    nullif(btrim(reported_notes), '')
  )
  returning
    inventory_reports.id,
    inventory_reports.venue_game_id,
    inventory_reports.status;
end;
$$;

create or replace function public.list_pending_inventory_reports(
  result_limit integer default 50
)
returns table (
  report_id uuid,
  venue_game_id uuid,
  venue_id uuid,
  venue_name text,
  game_id uuid,
  game_title text,
  report_type text,
  quantity integer,
  machine_label text,
  notes text,
  created_at timestamptz,
  submitted_by uuid
)
set search_path = public, extensions
language sql
stable
security invoker
as $$
  select
    ir.id as report_id,
    ir.venue_game_id,
    ir.venue_id,
    v.name as venue_name,
    ir.game_id,
    g.title as game_title,
    ir.report_type,
    ir.quantity,
    ir.machine_label,
    ir.notes,
    ir.created_at,
    ir.user_id as submitted_by
  from public.inventory_reports ir
  join public.venues v on v.id = ir.venue_id
  join public.games g on g.id = ir.game_id
  where ir.status = 'pending'
  order by ir.created_at desc
  limit greatest(result_limit, 1);
$$;

create or replace function public.approve_inventory_report(
  selected_report_id uuid
)
returns table (
  report_id uuid,
  venue_game_id uuid,
  resulting_availability_status text,
  resulting_quantity integer
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
  report_row public.inventory_reports%rowtype;
  existing_venue_game public.venue_games%rowtype;
  final_venue_game_id uuid;
  final_status text;
  final_quantity integer;
  final_last_confirmed_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into report_row
  from public.inventory_reports ir
  where ir.id = selected_report_id
  for update;

  if not found then
    raise exception 'Inventory report not found';
  end if;

  if report_row.status <> 'pending' then
    raise exception 'Inventory report has already been reviewed';
  end if;

  select *
  into existing_venue_game
  from public.venue_games vg
  where
    vg.venue_id = report_row.venue_id
    and vg.game_id = report_row.game_id
  limit 1;

  final_status := case report_row.report_type
    when 'temporarily_unavailable' then 'temporarily_unavailable'
    when 'missing' then 'removed'
    else 'confirmed_present'
  end;

  final_quantity := case
    when report_row.report_type = 'missing' then coalesce(existing_venue_game.quantity, report_row.quantity, 1)
    else coalesce(report_row.quantity, existing_venue_game.quantity, 1)
  end;

  final_last_confirmed_at := case
    when report_row.report_type in ('confirmed_present', 'new_machine', 'quantity_changed')
      then timezone('utc'::text, now())
    else existing_venue_game.last_confirmed_at
  end;

  insert into public.venue_games (
    id,
    venue_id,
    game_id,
    quantity,
    availability_status,
    machine_label,
    notes,
    confidence_score,
    last_seen_at,
    last_confirmed_at,
    created_by
  )
  values (
    coalesce(existing_venue_game.id, gen_random_uuid()),
    report_row.venue_id,
    report_row.game_id,
    final_quantity,
    final_status,
    coalesce(nullif(btrim(report_row.machine_label), ''), existing_venue_game.machine_label),
    coalesce(nullif(btrim(report_row.notes), ''), existing_venue_game.notes),
    case
      when report_row.report_type in ('confirmed_present', 'new_machine') then 1.00
      when report_row.report_type = 'quantity_changed' then greatest(coalesce(existing_venue_game.confidence_score, 0.70), 0.90)
      when report_row.report_type = 'temporarily_unavailable' then greatest(coalesce(existing_venue_game.confidence_score, 0.70), 0.85)
      else greatest(coalesce(existing_venue_game.confidence_score, 0.70), 0.80)
    end,
    timezone('utc'::text, now()),
    final_last_confirmed_at,
    coalesce(existing_venue_game.created_by, report_row.user_id)
  )
  on conflict (venue_id, game_id) do update
  set
    quantity = excluded.quantity,
    availability_status = excluded.availability_status,
    machine_label = excluded.machine_label,
    notes = excluded.notes,
    confidence_score = excluded.confidence_score,
    last_seen_at = excluded.last_seen_at,
    last_confirmed_at = excluded.last_confirmed_at,
    updated_at = timezone('utc'::text, now())
  returning public.venue_games.id
  into final_venue_game_id;

  update public.inventory_reports
  set
    venue_game_id = final_venue_game_id,
    status = 'approved',
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = current_user_id,
    review_notes = null
  where id = report_row.id;

  return query
  select
    report_row.id,
    final_venue_game_id,
    final_status,
    final_quantity;
end;
$$;

create or replace function public.reject_inventory_report(
  selected_report_id uuid,
  rejection_reason text default null
)
returns table (
  report_id uuid,
  report_status text,
  reviewed_at timestamptz
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  update public.inventory_reports
  set
    status = 'rejected',
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = current_user_id,
    review_notes = nullif(btrim(rejection_reason), '')
  where
    id = selected_report_id
    and status = 'pending'
  returning
    inventory_reports.id,
    inventory_reports.status,
    inventory_reports.reviewed_at;

  if not found then
    raise exception 'Pending inventory report not found';
  end if;
end;
$$;

revoke execute on function public.submit_inventory_report(uuid, uuid, text, integer, text, text) from public, anon;
grant execute on function public.submit_inventory_report(uuid, uuid, text, integer, text, text) to authenticated;

revoke execute on function public.list_pending_inventory_reports(integer) from public, anon;
grant execute on function public.list_pending_inventory_reports(integer) to authenticated;

revoke execute on function public.approve_inventory_report(uuid) from public, anon;
grant execute on function public.approve_inventory_report(uuid) to authenticated;

revoke execute on function public.reject_inventory_report(uuid, text) from public, anon;
grant execute on function public.reject_inventory_report(uuid, text) to authenticated;
