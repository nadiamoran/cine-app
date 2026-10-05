-- Migracion 019 - Butacas en tiempo real (RF-23, Supabase Realtime)
--
-- Requiere la migracion 004 ya aplicada.
--
-- "Cuando un usuario esta seleccionando butacas, debe ver cuales ya estan
-- ocupadas por otra compra en ese mismo momento" (mail del cliente).
--
-- Por que una tabla nueva y no escuchar orden_butacas directo:
--   - Realtime respeta RLS: solo manda un cambio a quien podria leer esa
--     fila. orden_butacas no tiene policy de lectura para clientes ni
--     anonimos, asi que no les llegaria nada.
--   - Y no conviene abrirla: el id de cada fila ES el codigo del QR. Si
--     cualquiera pudiera leerla, podria copiar entradas ajenas.
--   - La vista butacas_ocupadas tampoco sirve: Realtime no funciona con vistas.
--
-- Entonces: una tabla publica que solo dice "esta butaca esta vendida en esta
-- funcion" (lo mismo que ya mostraba la vista, sin codigos ni compradores),
-- mantenida por triggers. La app se suscribe a sus cambios.

create table if not exists public.butacas_vendidas (
  funcion_id  uuid not null references public.funciones(id) on delete cascade,
  butaca_id   uuid not null references public.butacas(id) on delete cascade,
  primary key (funcion_id, butaca_id)
);

alter table public.butacas_vendidas enable row level security;

-- cualquiera puede verla (no tiene datos sensibles); nadie la escribe desde
-- la app: solo los triggers de abajo
drop policy if exists "butacas vendidas publicas" on public.butacas_vendidas;
create policy "butacas vendidas publicas"
  on public.butacas_vendidas for select to public using (true);

-- con RLS activo, en los DELETE Realtime manda solo la clave primaria de la
-- fila borrada; como la clave es (funcion_id, butaca_id), alcanza para saber
-- que butaca se libero
alter table public.butacas_vendidas replica identity full;

-- carga inicial con lo que ya esta vendido
insert into public.butacas_vendidas (funcion_id, butaca_id)
select ob.funcion_id, ob.butaca_id
from public.orden_butacas ob
join public.ordenes o on o.id = ob.orden_id
where o.estado = 'confirmada'
on conflict do nothing;


-- Butaca comprada -> se marca como vendida
create or replace function public.butaca_vendida_al_comprar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.butacas_vendidas (funcion_id, butaca_id)
  values (new.funcion_id, new.butaca_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists butaca_vendida_al_comprar on public.orden_butacas;
create trigger butaca_vendida_al_comprar
  after insert on public.orden_butacas
  for each row execute function public.butaca_vendida_al_comprar();


-- Butaca borrada de una orden -> se libera
create or replace function public.butaca_liberada_al_borrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.butacas_vendidas
  where funcion_id = old.funcion_id and butaca_id = old.butaca_id;
  return old;
end;
$$;

drop trigger if exists butaca_liberada_al_borrar on public.orden_butacas;
create trigger butaca_liberada_al_borrar
  after delete on public.orden_butacas
  for each row execute function public.butaca_liberada_al_borrar();


-- Orden cancelada -> se liberan todas sus butacas (queda listo para cuando
-- se implemente la cancelacion con credito, RF-44)
create or replace function public.butacas_liberadas_al_cancelar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'cancelada' and old.estado <> 'cancelada' then
    delete from public.butacas_vendidas bv
    using public.orden_butacas ob
    where ob.orden_id = new.id
      and bv.funcion_id = ob.funcion_id
      and bv.butaca_id = ob.butaca_id;
  end if;
  return new;
end;
$$;

drop trigger if exists butacas_liberadas_al_cancelar on public.ordenes;
create trigger butacas_liberadas_al_cancelar
  after update of estado on public.ordenes
  for each row execute function public.butacas_liberadas_al_cancelar();


-- Activa Realtime para esta tabla (la publicacion "supabase_realtime" es la
-- que lee Supabase para mandar los cambios a los navegadores suscriptos)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'butacas_vendidas'
  ) then
    alter publication supabase_realtime add table public.butacas_vendidas;
  end if;
end;
$$;
