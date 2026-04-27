alter table public.inventory_reports
  drop constraint if exists inventory_reports_status_check;

alter table public.inventory_reports
  add constraint inventory_reports_status_check
  check (status in ('pending', 'approved', 'rejected', 'withdrawn'));

alter table public.inventory_reports
  add column if not exists withdrawn_at timestamptz;

alter table public.venue_submissions
  drop constraint if exists venue_submissions_status_check;

alter table public.venue_submissions
  add constraint venue_submissions_status_check
  check (status in ('pending', 'approved', 'rejected', 'withdrawn'));

alter table public.venue_submissions
  add column if not exists withdrawn_at timestamptz;

alter table public.game_submissions
  drop constraint if exists game_submissions_status_check;

alter table public.game_submissions
  add constraint game_submissions_status_check
  check (status in ('pending', 'approved', 'rejected', 'withdrawn'));

alter table public.game_submissions
  add column if not exists withdrawn_at timestamptz;

create policy "contributors_can_withdraw_own_pending_inventory_reports"
on public.inventory_reports
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'pending'
)
with check (
  (select auth.uid()) = user_id
  and status = 'withdrawn'
);

create policy "contributors_can_withdraw_own_pending_venue_submissions"
on public.venue_submissions
for update
to authenticated
using (
  (select auth.uid()) = submitted_by
  and status = 'pending'
)
with check (
  (select auth.uid()) = submitted_by
  and status = 'withdrawn'
);

create policy "contributors_can_withdraw_own_pending_game_submissions"
on public.game_submissions
for update
to authenticated
using (
  (select auth.uid()) = submitted_by
  and status = 'pending'
)
with check (
  (select auth.uid()) = submitted_by
  and status = 'withdrawn'
);

create or replace function public.list_my_pending_inventory_reports(
  result_limit integer default 25
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
language plpgsql
stable
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
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
  where
    ir.user_id = current_user_id
    and ir.status = 'pending'
  order by ir.created_at desc
  limit greatest(result_limit, 1);
end;
$$;

create or replace function public.list_my_pending_venue_submissions(
  result_limit integer default 25
)
returns table (
  submission_id uuid,
  submitted_by uuid,
  name text,
  street_address text,
  city text,
  region text,
  postal_code text,
  country text,
  latitude double precision,
  longitude double precision,
  website text,
  notes text,
  created_at timestamptz
)
set search_path = public, extensions
language plpgsql
stable
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    vs.id,
    vs.submitted_by,
    vs.name,
    vs.street_address,
    vs.city,
    vs.region,
    vs.postal_code,
    vs.country,
    vs.latitude,
    vs.longitude,
    vs.website,
    vs.notes,
    vs.created_at
  from public.venue_submissions vs
  where
    vs.submitted_by = current_user_id
    and vs.status = 'pending'
  order by vs.created_at desc
  limit greatest(result_limit, 1);
end;
$$;

create or replace function public.list_my_pending_game_submissions(
  result_limit integer default 25
)
returns table (
  submission_id uuid,
  submitted_by uuid,
  title text,
  manufacturer text,
  release_year integer,
  aliases text[],
  categories text[],
  notes text,
  created_at timestamptz
)
set search_path = public, extensions
language plpgsql
stable
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    gs.id,
    gs.submitted_by,
    gs.title,
    gs.manufacturer,
    gs.release_year,
    gs.aliases,
    gs.categories,
    gs.notes,
    gs.created_at
  from public.game_submissions gs
  where
    gs.submitted_by = current_user_id
    and gs.status = 'pending'
  order by gs.created_at desc
  limit greatest(result_limit, 1);
end;
$$;

create or replace function public.withdraw_inventory_report(
  selected_report_id uuid
)
returns table (
  report_id uuid,
  report_status text,
  withdrawn_at timestamptz
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
    status = 'withdrawn',
    withdrawn_at = timezone('utc'::text, now())
  where
    id = selected_report_id
    and user_id = current_user_id
    and status = 'pending'
  returning
    inventory_reports.id,
    inventory_reports.status,
    inventory_reports.withdrawn_at;

  if not found then
    raise exception 'Pending inventory report not found or cannot be withdrawn.';
  end if;
end;
$$;

create or replace function public.withdraw_venue_submission(
  selected_submission_id uuid
)
returns table (
  submission_id uuid,
  submission_status text,
  withdrawn_at timestamptz
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
  update public.venue_submissions
  set
    status = 'withdrawn',
    withdrawn_at = timezone('utc'::text, now())
  where
    id = selected_submission_id
    and submitted_by = current_user_id
    and status = 'pending'
  returning
    venue_submissions.id,
    venue_submissions.status,
    venue_submissions.withdrawn_at;

  if not found then
    raise exception 'Pending venue submission not found or cannot be withdrawn.';
  end if;
end;
$$;

create or replace function public.withdraw_game_submission(
  selected_submission_id uuid
)
returns table (
  submission_id uuid,
  submission_status text,
  withdrawn_at timestamptz
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
  update public.game_submissions
  set
    status = 'withdrawn',
    withdrawn_at = timezone('utc'::text, now())
  where
    id = selected_submission_id
    and submitted_by = current_user_id
    and status = 'pending'
  returning
    game_submissions.id,
    game_submissions.status,
    game_submissions.withdrawn_at;

  if not found then
    raise exception 'Pending game submission not found or cannot be withdrawn.';
  end if;
end;
$$;

revoke execute on function public.list_my_pending_inventory_reports(integer) from public, anon;
grant execute on function public.list_my_pending_inventory_reports(integer) to authenticated;

revoke execute on function public.list_my_pending_venue_submissions(integer) from public, anon;
grant execute on function public.list_my_pending_venue_submissions(integer) to authenticated;

revoke execute on function public.list_my_pending_game_submissions(integer) from public, anon;
grant execute on function public.list_my_pending_game_submissions(integer) to authenticated;

revoke execute on function public.withdraw_inventory_report(uuid) from public, anon;
grant execute on function public.withdraw_inventory_report(uuid) to authenticated;

revoke execute on function public.withdraw_venue_submission(uuid) from public, anon;
grant execute on function public.withdraw_venue_submission(uuid) to authenticated;

revoke execute on function public.withdraw_game_submission(uuid) from public, anon;
grant execute on function public.withdraw_game_submission(uuid) to authenticated;
