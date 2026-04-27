with ranked_pending_reports as (
  select
    ir.id,
    row_number() over (
      partition by ir.user_id, ir.venue_id, ir.game_id
      order by ir.created_at asc, ir.id asc
    ) as duplicate_rank
  from public.inventory_reports ir
  where ir.status = 'pending'
)
update public.inventory_reports ir
set
  status = 'rejected',
  reviewed_at = timezone('utc'::text, now()),
  review_notes = 'Auto-rejected duplicate pending report before enabling duplicate guard.'
from ranked_pending_reports rpr
where
  ir.id = rpr.id
  and rpr.duplicate_rank > 1;

create unique index if not exists inventory_reports_one_pending_game_report_per_user_idx
  on public.inventory_reports (user_id, venue_id, game_id)
  where status = 'pending';

create index if not exists inventory_reports_user_created_at_idx
  on public.inventory_reports (user_id, created_at desc);

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
  reports_this_hour integer;
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

  if exists (
    select 1
    from public.inventory_reports ir
    where
      ir.user_id = current_user_id
      and ir.venue_id = selected_venue_id
      and ir.game_id = selected_game_id
      and ir.status = 'pending'
  ) then
    raise exception 'You already submitted this game at this venue for review.';
  end if;

  select count(*)
  into reports_this_hour
  from public.inventory_reports ir
  where
    ir.user_id = current_user_id
    and ir.created_at >= timezone('utc'::text, now()) - interval '1 hour';

  if reports_this_hour >= 60 then
    raise exception 'Inventory report limit reached. Try again later.';
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
