create or replace function public.design_creator_mutation_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or current_user = 'service_role' or public.staff_has_permission('view_all_orders') then
    return new;
  end if;
  if tg_table_name = 'design_projects' then
    if tg_op = 'UPDATE' and old.created_by <> auth.uid() then
      raise exception using errcode = '42501', message = 'design access denied';
    end if;
  elsif tg_table_name = 'design_project_versions' then
    if not exists (
      select 1 from public.design_projects project
      where project.id = new.design_project_id and project.created_by = auth.uid()
    ) then
      raise exception using errcode = '42501', message = 'design access denied';
    end if;
  end if;
  return new;
end;
$$;
