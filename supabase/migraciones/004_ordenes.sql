-- Migracion 004 - Compra de entradas (ordenes) sin choques entre compras
--
-- Requiere las migraciones 001 a 003 ya aplicadas.
--
-- La clave de todo esto es la restriccion "unique (funcion_id, butaca_id)"
-- en orden_butacas: si dos personas intentan comprar la misma butaca para
-- la misma funcion al mismo tiempo, Postgres rechaza la segunda insercion
-- SIEMPRE, sin importar que tan rapido llegue. Eso es lo que evita la doble
-- venta (RNF-09), no una validacion en Angular (esa nunca alcanza sola).

create table if not exists public.ordenes (
  id                uuid primary key default gen_random_uuid(),
  funcion_id        uuid not null references public.funciones(id),
  usuario_id        uuid references public.profiles(id),
  email             text not null,
  cantidad_butacas  int not null check (cantidad_butacas > 0),
  total             numeric not null check (total >= 0),
  estado            text not null default 'confirmada' check (estado in ('confirmada', 'cancelada')),
  created_at        timestamptz not null default now()
);

create table if not exists public.orden_butacas (
  id          uuid primary key default gen_random_uuid(),
  orden_id    uuid not null references public.ordenes(id) on delete cascade,
  butaca_id   uuid not null references public.butacas(id),
  funcion_id  uuid not null references public.funciones(id),
  unique (funcion_id, butaca_id)
);

create index if not exists ordenes_usuario_idx on public.ordenes (usuario_id);
create index if not exists orden_butacas_orden_idx on public.orden_butacas (orden_id);

alter table public.ordenes       enable row level security;
alter table public.orden_butacas enable row level security;

drop policy if exists "usuario ve sus propias ordenes" on public.ordenes;
create policy "usuario ve sus propias ordenes"
  on public.ordenes for select to authenticated
  using (auth.uid() = usuario_id or public.tiene_rol(array['administrador', 'empleado']));

-- orden_butacas no tiene policy de select: el detalle de una orden se
-- consulta a traves de crear_orden() (devuelve lo recien creado) o de la
-- vista butacas_ocupadas de abajo, que solo expone funcion_id + butaca_id.

-- Vista publica: que butacas ya estan vendidas, por funcion. Sin esto, dos
-- personas podrian ver la sala "vacia" a la vez y las dos elegir la misma
-- silla (rechazado recien al confirmar, en vez de mostrarse ocupada antes).
create or replace view public.butacas_ocupadas as
  select ob.funcion_id, ob.butaca_id
  from public.orden_butacas ob
  join public.ordenes o on o.id = ob.orden_id
  where o.estado = 'confirmada';

grant select on public.butacas_ocupadas to anon, authenticated;

-- Crea la orden y sus butacas en una sola operacion. Si alguna butaca ya
-- estaba vendida para esa funcion, todo lo demas se deshace solo (Postgres
-- revierte la funcion completa ante cualquier error).
create or replace function public.crear_orden(
  p_funcion_id  uuid,
  p_butaca_ids  uuid[],
  p_email       text
)
returns public.ordenes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precio  numeric;
  v_orden   public.ordenes;
  v_butaca  uuid;
begin
  if p_butaca_ids is null or array_length(p_butaca_ids, 1) is null then
    raise exception 'Elegi al menos una butaca';
  end if;

  select precio into v_precio from public.funciones where id = p_funcion_id;
  if v_precio is null then
    raise exception 'La funcion no existe';
  end if;

  insert into public.ordenes (funcion_id, usuario_id, email, cantidad_butacas, total)
  values (
    p_funcion_id,
    auth.uid(),
    p_email,
    array_length(p_butaca_ids, 1),
    v_precio * array_length(p_butaca_ids, 1)
  )
  returning * into v_orden;

  foreach v_butaca in array p_butaca_ids loop
    insert into public.orden_butacas (orden_id, butaca_id, funcion_id)
    values (v_orden.id, v_butaca, p_funcion_id);
  end loop;

  return v_orden;
end;
$$;

revoke execute on function public.crear_orden(uuid, uuid[], text) from public;
grant  execute on function public.crear_orden(uuid, uuid[], text) to anon, authenticated;
