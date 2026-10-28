-- Migracion 028 - Propuestas de peliculas de los clientes
--
-- "Cada cliente deberia poder hacer una propuesta a la vez, enviando el
-- titulo, descripcion y una explicacion porque quieren una pelicula en el
-- cine. Desde administracion deberiamos poder verlas y aceptarlas o
-- rechazarlas." (mail del cliente, 10/03)
--
-- Requiere la migracion 001 (funcion tiene_rol).
--
-- Decisiones:
--   - Estados: pendiente, aceptada, rechazada.
--   - Una sola propuesta pendiente por usuario: lo hace cumplir un indice
--     unico parcial, asi vale aunque alguien se saltee Angular.
--   - Solo propone un cliente (no el empleado ni el admin).
--   - El admin solo puede cambiar el estado (permiso por columna).

create table if not exists public.propuestas_peliculas (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.profiles(id) on delete cascade,
  titulo      text not null check (length(trim(titulo)) > 0),
  descripcion text not null check (length(trim(descripcion)) > 0),
  motivo      text not null check (length(trim(motivo)) > 0),
  estado      text not null default 'pendiente'
              check (estado in ('pendiente', 'aceptada', 'rechazada')),
  created_at  timestamptz not null default now()
);

-- Una propuesta pendiente por usuario. El indice es parcial: solo cuenta las
-- pendientes, asi que despues de que el cine la resuelve puede hacer otra.
create unique index if not exists propuestas_una_pendiente_idx
  on public.propuestas_peliculas (usuario_id)
  where estado = 'pendiente';

alter table public.propuestas_peliculas enable row level security;

drop policy if exists "ver propuestas" on public.propuestas_peliculas;
create policy "ver propuestas"
  on public.propuestas_peliculas for select to authenticated
  using (auth.uid() = usuario_id or public.tiene_rol(array['administrador']));

-- solo un cliente propone, a su nombre y siempre como pendiente
drop policy if exists "cliente propone" on public.propuestas_peliculas;
create policy "cliente propone"
  on public.propuestas_peliculas for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and estado = 'pendiente'
    and public.tiene_rol(array['cliente'])
  );

-- solo el admin resuelve, y lo unico que puede cambiar es el estado
drop policy if exists "admin resuelve propuestas" on public.propuestas_peliculas;
create policy "admin resuelve propuestas"
  on public.propuestas_peliculas for update to authenticated
  using (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

revoke update on public.propuestas_peliculas from anon, authenticated;
grant update (estado) on public.propuestas_peliculas to authenticated;
