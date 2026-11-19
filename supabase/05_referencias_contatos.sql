-- =====================================================================
-- 05 · Referências e contatos editáveis pelo painel
-- Rode depois dos arquivos 01–04. Pode rodar de novo sem duplicar nada.
-- =====================================================================

-- ---------- Contatos (uma linha só) ----------------------------------
create table if not exists public.site_settings (
  id             smallint primary key default 1 check (id = 1),
  email          text not null default '',
  instagram      text not null default '',
  whatsapp       text not null default '' check (whatsapp ~ '^[0-9]*$'),
  whatsapp_label text not null default '',
  updated_at     timestamptz not null default now()
);

-- ---------- Referências ----------------------------------------------
create table if not exists public.site_references (
  id           uuid primary key default gen_random_uuid(),
  handle       text not null check (length(trim(handle)) > 0),
  url          text check (url is null or url ~* '^https?://'),
  path         text,
  thumb        text,
  width        integer check (width is null or width > 0),
  height       integer check (height is null or height > 0),
  alt          text,
  caption      text,
  position     integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists site_references_position_idx on public.site_references(position);

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();
drop trigger if exists site_references_touch on public.site_references;
create trigger site_references_touch before insert or update on public.site_references
  for each row execute function public.touch_updated_at();

-- ---------- Permissões e regras de acesso -----------------------------
grant select on public.site_settings, public.site_references to anon, authenticated;
grant insert, update, delete on public.site_settings, public.site_references to authenticated;

alter table public.site_settings   enable row level security;
alter table public.site_references enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;
drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_public_read on public.site_settings for select using (true);
create policy site_settings_admin_write on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists site_references_public_read on public.site_references;
drop policy if exists site_references_admin_write on public.site_references;
create policy site_references_public_read on public.site_references for select
  using (is_published or public.is_admin());
create policy site_references_admin_write on public.site_references for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Conteúdo inicial (o que já estava no site) -----------------
insert into public.site_settings (id, email, instagram, whatsapp, whatsapp_label)
values (1, 'contato@gnermoda.com', 'gner.moda', '5511941453472', '(11) 94145-3472')
on conflict (id) do nothing;

insert into public.site_references (handle, url, path, thumb, width, height, alt, position)
select * from (values
  ('@Futurist__', 'https://instagram.com/futurist__', '/static/referencias/futurist-3.webp', '/static/referencias/futurist-3-sm.webp', 1600, 1067, 'Referência visual de @Futurist__', 0),
  ('@Ludolf', null, null, null, null, null, null, 1),
  ('@Tobias', 'https://instagram.com/tobiasnabor', '/static/referencias/tobiasnabor-4.webp', '/static/referencias/tobiasnabor-4-sm.webp', 1200, 1600, 'Referência visual de @Tobias', 2),
  ('@Tylerthecreator', 'https://instagram.com/feliciathegoat', '/static/referencias/feliciathegoat-1.webp', '/static/referencias/feliciathegoat-1-sm.webp', 1280, 1600, 'Referência visual de @Tylerthecreator', 3)
) as v(handle, url, path, thumb, width, height, alt, position)
where not exists (select 1 from public.site_references);
