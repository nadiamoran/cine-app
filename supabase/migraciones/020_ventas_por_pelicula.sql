-- Migracion 020 - Contador de entradas vendidas por pelicula (RF-04)
--
-- Requiere las migraciones 004 y 013 ya aplicadas.
--
-- "La pagina principal muestra primero las 3 peliculas mas vendidas" (mail
-- del cliente). La cartelera ya se ordena por peliculas.ventas, pero nadie
-- actualizaba ese numero: quedaba siempre en 0.
--
-- "Mas vendida" = mas entradas vendidas, no mas plata (supuesto S-9): cada
-- butaca de una orden confirmada suma 1 a la pelicula de esa funcion.
--
-- Por que triggers y no sumar adentro de crear_orden:
--   - cuentan cualquier compra, sin volver a reescribir esa funcion
--   - el cliente no puede escribir en peliculas, asi que el numero no se
--     puede inflar desde el navegador
--   - mismo patron que butacas_vendidas (019): compra suma, cancelacion resta


-- Butaca comprada -> +1 a la pelicula de la funcion
create or replace function public.venta_sumada_al_comprar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.peliculas p
  set ventas = p.ventas + 1
  from public.funciones f
  where f.id = new.funcion_id and p.id = f.pelicula_id;
  return new;
end;
$$;

drop trigger if exists venta_sumada_al_comprar on public.orden_butacas;
create trigger venta_sumada_al_comprar
  after insert on public.orden_butacas
  for each row execute function public.venta_sumada_al_comprar();


-- Butaca borrada de una orden confirmada -> -1 (si la orden ya estaba
-- cancelada, esa butaca ya se habia restado al cancelar)
create or replace function public.venta_restada_al_borrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.ordenes where id = old.orden_id and estado = 'confirmada') then
    update public.peliculas p
    set ventas = greatest(p.ventas - 1, 0)
    from public.funciones f
    where f.id = old.funcion_id and p.id = f.pelicula_id;
  end if;
  return old;
end;
$$;

drop trigger if exists venta_restada_al_borrar on public.orden_butacas;
create trigger venta_restada_al_borrar
  after delete on public.orden_butacas
  for each row execute function public.venta_restada_al_borrar();


-- Orden cancelada -> se restan todas sus butacas (queda listo para cuando
-- se implemente la cancelacion con credito, RF-44)
create or replace function public.ventas_restadas_al_cancelar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'cancelada' and old.estado <> 'cancelada' then
    update public.peliculas p
    set ventas = greatest(p.ventas - new.cantidad_butacas, 0)
    from public.funciones f
    where f.id = new.funcion_id and p.id = f.pelicula_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ventas_restadas_al_cancelar on public.ordenes;
create trigger ventas_restadas_al_cancelar
  after update of estado on public.ordenes
  for each row execute function public.ventas_restadas_al_cancelar();


-- Carga inicial: recalcula el contador con las compras que ya existen
update public.peliculas p
set ventas = coalesce((
  select count(*)
  from public.orden_butacas ob
  join public.ordenes o on o.id = ob.orden_id
  join public.funciones f on f.id = ob.funcion_id
  where o.estado = 'confirmada' and f.pelicula_id = p.id
), 0);
