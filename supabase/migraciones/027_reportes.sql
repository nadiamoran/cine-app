-- Migracion 027 - Reportes del panel de administracion (RF-52, RF-54)
--
-- Requiere las migraciones 024 y 025 ya aplicadas.
--
-- "En el admin quiero tener un reporte que me diga cuanto facturamos por dia
-- y cuantas entradas se vendieron" (mail del 28/02).
-- "Quiero ver un grafico de las peliculas mas vistas por semana y por mes, y
-- cual es el producto del candy bar que mas se vende" (mail del 10/03).
--
-- Tres funciones de solo lectura que hacen las cuentas en la base (agrupar
-- y sumar) y devuelven el resultado listo para mostrar. Solo las puede usar
-- el administrador.
--
-- Criterios:
--   - Solo cuentan las compras confirmadas: una cancelada no se facturo
--     (se devolvio como credito).
--   - Las fechas son de Argentina.
--   - Facturacion: por dia de COMPRA. Peliculas mas vistas: por dia de la
--     FUNCION (lo que se vio esa semana / ese mes).


-- Fecha de Argentina de un timestamp
create or replace function public.fecha_ar(p_momento timestamptz)
returns date
language sql
immutable
as $$
  select (p_momento at time zone 'America/Argentina/Buenos_Aires')::date;
$$;


-- ---------------------------------------------------------------------
-- 1. Facturacion por dia: un renglon por cada dia del periodo (aunque ese
--    dia no se haya vendido nada), con entradas vendidas y total facturado
-- ---------------------------------------------------------------------
create or replace function public.reporte_facturacion(p_desde date, p_hasta date)
returns table (fecha date, entradas bigint, facturado numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede ver los reportes';
  end if;

  return query
    select d.dia::date,
           coalesce(sum(o.cantidad_butacas), 0)::bigint,
           coalesce(sum(o.total), 0)
    from generate_series(p_desde, p_hasta, interval '1 day') d(dia)
    left join public.ordenes o
      on o.estado = 'confirmada'
     and public.fecha_ar(o.created_at) = d.dia::date
    group by d.dia
    order by d.dia desc;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Peliculas mas vistas: entradas vendidas para funciones del periodo
-- ---------------------------------------------------------------------
create or replace function public.reporte_peliculas_mas_vistas(p_desde date, p_hasta date)
returns table (pelicula text, entradas bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede ver los reportes';
  end if;

  return query
    select p.nombre, count(*)::bigint
    from public.orden_butacas ob
    join public.ordenes o   on o.id = ob.orden_id and o.estado = 'confirmada'
    join public.funciones f on f.id = ob.funcion_id
    join public.peliculas p on p.id = f.pelicula_id
    where public.fecha_ar(f.inicio) between p_desde and p_hasta
    group by p.nombre
    order by 2 desc, 1
    limit 10;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Productos mas vendidos: unidades de cada producto, sumando los
--    comprados sueltos, los canjeados con puntos y los que vienen en combos
-- ---------------------------------------------------------------------
create or replace function public.reporte_productos_mas_vendidos(p_desde date, p_hasta date)
returns table (producto text, unidades bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede ver los reportes';
  end if;

  return query
    with ventas as (
      -- productos sueltos (y canjeados con puntos)
      select op.producto_id, op.cantidad
      from public.orden_productos op
      join public.ordenes o on o.id = op.orden_id and o.estado = 'confirmada'
      where op.producto_id is not null
        and public.fecha_ar(o.created_at) between p_desde and p_hasta
      union all
      -- productos que vienen adentro de un combo
      select cp.producto_id, op.cantidad * cp.cantidad
      from public.orden_productos op
      join public.ordenes o on o.id = op.orden_id and o.estado = 'confirmada'
      join public.combo_productos cp on cp.combo_id = op.combo_id
      where op.combo_id is not null
        and public.fecha_ar(o.created_at) between p_desde and p_hasta
    )
    select pr.nombre, sum(v.cantidad)::bigint
    from ventas v
    join public.productos pr on pr.id = v.producto_id
    group by pr.nombre
    order by 2 desc, 1
    limit 10;
end;
$$;


revoke execute on function public.reporte_facturacion(date, date) from public, anon;
grant  execute on function public.reporte_facturacion(date, date) to authenticated;
revoke execute on function public.reporte_peliculas_mas_vistas(date, date) from public, anon;
grant  execute on function public.reporte_peliculas_mas_vistas(date, date) to authenticated;
revoke execute on function public.reporte_productos_mas_vendidos(date, date) from public, anon;
grant  execute on function public.reporte_productos_mas_vendidos(date, date) to authenticated;
