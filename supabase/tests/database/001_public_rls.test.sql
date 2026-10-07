begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  0::bigint,
  'every public table has row level security enabled'
);

select * from finish();
rollback;
