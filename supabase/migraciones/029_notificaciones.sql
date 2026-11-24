-- Migracion 029 - Notificaciones dentro de la app
--
-- El ultimo mail del cliente pide avisarle al usuario cuando se libera una
-- butaca de una lista de espera y cuando el cine cancela una funcion. Y desde
-- el mail del 08/03 (RF-07) se avisa cuando se abre la venta de una pelicula
-- de "Proximamente". Todos esos avisos pasan por esta tabla.
--
-- Decision (S-20): las notificaciones son dentro de la app (campanita con
-- contador, en vivo con Supabase Realtime). No hay push con la app cerrada,
-- porque eso necesita un servidor que lo envie.
--
-- Requiere las migraciones 001 y 019.

create table if not exists public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.profiles(id) on delete cascade,
  titulo      text not null,
  mensaje     text not null,
  enlace      text,                      -- ruta de la app a la que lleva (ej. /pelicula/123)
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notificaciones_usuario_idx
  on public.notificaciones (usuario_id, created_at desc);

alter table public.notificaciones enable row level security;

-- cada usuario ve solo las suyas
drop policy if exists "usuario ve sus notificaciones" on public.notificaciones;
create policy "usuario ve sus notificaciones"
  on public.notificaciones for select to authenticated
  using (auth.uid() = usuario_id);

-- y solo puede marcarlas como leidas (nadie inserta ni borra desde la app:
-- las crean las funciones y los triggers de la base)
drop policy if exists "usuario marca sus notificaciones" on public.notificaciones;
create policy "usuario marca sus notificaciones"
  on public.notificaciones for update to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

revoke update on public.notificaciones from anon, authenticated;
grant update (leida) on public.notificaciones to authenticated;


-- ---------------------------------------------------------------------
-- notificar(): la usan las otras funciones de la base para avisarle a un
-- usuario. Nadie puede llamarla desde la app.
-- ---------------------------------------------------------------------
create or replace function public.notificar(
  p_usuario_id uuid,
  p_titulo     text,
  p_mensaje    text,
  p_enlace     text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notificaciones (usuario_id, titulo, mensaje, enlace)
  values (p_usuario_id, p_titulo, p_mensaje, p_enlace);
$$;

revoke execute on function public.notificar(uuid, text, text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- RF-07: cuando una pelicula pasa de "Proximamente" a "En cartelera", se le
-- avisa a quienes activaron la alerta.
-- ---------------------------------------------------------------------
create or replace function public.avisar_estreno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado = 'proximamente' and new.estado = 'en_cartelera' then
    insert into public.notificaciones (usuario_id, titulo, mensaje, enlace)
    select a.usuario_id,
           'Ya podés sacar tus entradas',
           new.nombre || ' ya está en cartelera.',
           '/pelicula/' || new.id
    from public.alertas_estreno a
    where a.pelicula_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists avisar_estreno on public.peliculas;
create trigger avisar_estreno
  after update of estado on public.peliculas
  for each row execute function public.avisar_estreno();


-- ---------------------------------------------------------------------
-- Realtime: la app escucha los INSERT de esta tabla. Realtime respeta RLS,
-- asi que cada usuario recibe solo sus notificaciones.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end;
$$;
