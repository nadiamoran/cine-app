-- Migracion 003 - Funciones (horarios de proyeccion), con asignacion automatica de sala
--
-- Requiere las migraciones 001 y 002 ya aplicadas.
-- Reglas del cliente (mails 01/01 y 06/02):
--   - una funcion tiene pelicula, horario, formato (2d/3d/4d/5d) e idioma
--   - la sala la elige el sistema, nunca la persona
--   - dos funciones no pueden superponerse en la misma sala
--   - entre el fin de una funcion y el inicio de otra en la misma sala
--     tiene que haber al menos 30 minutos

create table if not exists public.funciones (
  id           uuid primary key default gen_random_uuid(),
  pelicula_id  uuid not null references public.peliculas(id) on delete cascade,
  sala_id      uuid not null references public.salas(id) on delete restrict,
  inicio       timestamptz not null,
  fin          timestamptz not null,
  formato      text not null check (formato in ('2d', '3d', '4d', '5d')),
  idioma       text not null check (idioma in ('castellano', 'subtitulada')),
  precio       numeric not null default 0 check (precio >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists funciones_pelicula_idx on public.funciones (pelicula_id);
create index if not exists funciones_sala_idx     on public.funciones (sala_id, inicio);

alter table public.funciones enable row level security;

drop policy if exists "funciones publicas" on public.funciones;
create policy "funciones publicas"
  on public.funciones for select to public using (true);

drop policy if exists "administrador borra funciones" on public.funciones;
create policy "administrador borra funciones"
  on public.funciones for delete to authenticated
  using (public.tiene_rol(array['administrador']));

-- Crea una funcion y le asigna sola una sala libre. Si ninguna sala tiene
-- lugar en ese horario (respetando los 30 min de margen), no crea nada y
-- avisa con un error.
create or replace function public.asignar_funcion(
  p_pelicula_id uuid,
  p_inicio      timestamptz,
  p_formato     text,
  p_idioma      text,
  p_precio      numeric
)
returns public.funciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duracion   int;
  v_fin        timestamptz;
  v_sala       uuid;
  v_resultado  public.funciones;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede crear funciones';
  end if;

  select duracion_minutos into v_duracion
  from public.peliculas where id = p_pelicula_id;

  if v_duracion is null then
    raise exception 'La pelicula no existe';
  end if;

  v_fin := p_inicio + (v_duracion || ' minutes')::interval;

  -- primera sala que no tenga ninguna funcion superpuesta (con 30 min de margen)
  select s.id into v_sala
  from public.salas s
  where not exists (
    select 1 from public.funciones f
    where f.sala_id = s.id
      and p_inicio  < f.fin    + interval '30 minutes'
      and f.inicio  < v_fin    + interval '30 minutes'
  )
  order by s.nombre
  limit 1;

  if v_sala is null then
    raise exception 'No hay ninguna sala libre en ese horario';
  end if;

  insert into public.funciones (pelicula_id, sala_id, inicio, fin, formato, idioma, precio)
  values (p_pelicula_id, v_sala, p_inicio, v_fin, p_formato, p_idioma, p_precio)
  returning * into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function public.asignar_funcion(uuid, timestamptz, text, text, numeric) from public, anon;
grant  execute on function public.asignar_funcion(uuid, timestamptz, text, text, numeric) to authenticated;
