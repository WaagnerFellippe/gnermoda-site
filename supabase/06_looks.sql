-- =====================================================================
-- 06 · Looks prontos (curadoria com peças do acervo)
-- Rode depois dos arquivos 01–05. Pode rodar de novo sem duplicar nada.
-- =====================================================================

create table if not exists public.looks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text not null check (length(trim(title)) > 0),
  description text,
  path        text,
  thumb       text,
  width       integer check (width is null or width > 0),
  height      integer check (height is null or height > 0),
  alt         text,
  status      project_status not null default 'draft',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists looks_status_idx on public.looks(status, position);

create table if not exists public.look_pieces (
  look_id  uuid not null references public.looks(id)  on delete cascade,
  piece_id uuid not null references public.pieces(id) on delete restrict,
  position integer not null default 0,
  primary key (look_id, piece_id)
);
create index if not exists look_pieces_piece_idx on public.look_pieces(piece_id);

drop trigger if exists looks_touch on public.looks;
create trigger looks_touch before insert or update on public.looks
  for each row execute function public.touch_updated_at();

grant select on public.looks, public.look_pieces to anon, authenticated;
grant insert, update, delete on public.looks, public.look_pieces to authenticated;

alter table public.looks       enable row level security;
alter table public.look_pieces enable row level security;

drop policy if exists looks_public_read on public.looks;
drop policy if exists looks_admin_write on public.looks;
create policy looks_public_read on public.looks for select
  using (status = 'published' or public.is_admin());
create policy looks_admin_write on public.looks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists look_pieces_public_read on public.look_pieces;
drop policy if exists look_pieces_admin_write on public.look_pieces;
create policy look_pieces_public_read on public.look_pieces for select
  using (public.is_admin() or (
    exists (select 1 from public.looks l where l.id = look_id and l.status = 'published')
    and exists (select 1 from public.pieces p where p.id = piece_id and p.is_published)));
create policy look_pieces_admin_write on public.look_pieces for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Salva o look e as peças numa operação só (tudo ou nada)
create or replace function public.save_look(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id   uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  v_row  public.looks;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if coalesce(trim(p->>'title'), '') = '' then
    raise exception 'Informe o nome do look.';
  end if;
  if exists (select 1 from public.looks where slug = p->>'slug' and id <> v_id) then
    raise exception 'Já existe um look com a URL "%".', p->>'slug';
  end if;
  if coalesce(p->>'status', 'draft') = 'published' and jsonb_array_length(coalesce(p->'piece_ids', '[]'::jsonb)) = 0 then
    raise exception 'Para publicar, escolha ao menos uma peça.';
  end if;

  insert into public.looks as t (id, slug, title, description, path, thumb, width, height, alt, status, position)
  values (v_id, p->>'slug', trim(p->>'title'), nullif(trim(p->>'description'), ''),
          nullif(p->>'path', ''), nullif(p->>'thumb', ''),
          (p->>'width')::int, (p->>'height')::int, nullif(trim(p->>'alt'), ''),
          coalesce((p->>'status')::project_status, 'draft'), coalesce((p->>'position')::int, 0))
  on conflict (id) do update set
    slug = excluded.slug, title = excluded.title, description = excluded.description,
    path = excluded.path, thumb = excluded.thumb, width = excluded.width, height = excluded.height,
    alt = excluded.alt, status = excluded.status, position = excluded.position
  returning * into v_row;

  delete from public.look_pieces where look_id = v_id;
  insert into public.look_pieces (look_id, piece_id, position)
  select v_id, (e #>> '{}')::uuid, (ord - 1)::int
    from jsonb_array_elements(coalesce(p->'piece_ids', '[]'::jsonb)) with ordinality as a(e, ord)
  on conflict do nothing;

  return to_jsonb(v_row);
end $$;

revoke execute on function public.save_look(jsonb) from public, anon;
grant  execute on function public.save_look(jsonb) to authenticated;
