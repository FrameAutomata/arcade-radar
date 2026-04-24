grant usage on schema private to authenticated;

grant execute on function private.has_scout_access() to authenticated;
grant execute on function private.has_admin_access() to authenticated;
