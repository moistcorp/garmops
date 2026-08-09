alter table public.notifications
  drop constraint if exists notifications_action_url_check;

alter table public.notifications
  add constraint notifications_action_url_check
  check (
    action_url is null
    or (
      action_url = btrim(action_url)
      and char_length(action_url) between 1 and 1000
      and left(action_url, 1) = '/'
      and left(action_url, 2) <> '//'
      and position(chr(92) in action_url) = 0
      and action_url !~ '[[:cntrl:]]'
    )
  ) not valid;

alter table public.notifications
  validate constraint notifications_action_url_check;
