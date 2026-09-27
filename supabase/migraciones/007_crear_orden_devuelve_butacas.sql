-- Migracion 007 - crear_orden devuelve el detalle de las butacas compradas
--
-- Requiere las migraciones 004 y 005 ya aplicadas.
--
-- Hace falta para armar el PDF con el QR de cada entrada (RF-27): el
-- frontend necesita fila, numero y tipo de cada butaca, mas un id propio de
-- esa butaca-en-esa-orden para poner en el QR (para poder invalidarla mas
-- adelante, una por una, sin invalidar toda la orden junta).
--
-- No alcanza con consultar orden_butacas despues de crear la orden: esa
-- tabla no tiene policy de lectura para compras anonimas (usuario_id es
-- null, no hay con que compararlo contra auth.uid()). Por eso ahora
-- crear_orden devuelve todo junto, en la misma llamada.

drop function if exists public.crear_orden(uuid, uuid[], text);

create function public.crear_orden(
  p_funcion_id  uuid,
  p_butaca_ids  uuid[],
  p_email       text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precio           numeric;
  v_restriccion      text;
  v_edad_minima      int;
  v_fecha_nacimiento date;
  v_edad             int;
  v_orden            public.ordenes;
  v_butaca           uuid;
  v_resultado        json;
begin
  select f.precio, p.restriccion_edad
    into v_precio, v_restriccion
  from public.funciones f
  join public.peliculas p on p.id = f.pelicula_id
  where f.id = p_funcion_id;

  if v_precio is null then
    raise exception 'La funcion no existe';
  end if;

  v_edad_minima := case v_restriccion
    when '+18' then 18
    when '+13' then 13
    else 0
  end;

  if v_edad_minima > 0 then
    if auth.uid() is null then
      raise exception 'Esta funcion es apta %: inicia sesion con una cuenta habilitada para comprar', v_restriccion;
    end if;

    select fecha_nacimiento into v_fecha_nacimiento
    from public.profiles where id = auth.uid();

    v_edad := extract(year from age(v_fecha_nacimiento));

    if v_fecha_nacimiento is null or v_edad < v_edad_minima then
      raise exception 'Esta funcion es apta %: no cumplis la edad minima para comprar', v_restriccion;
    end if;
  end if;

  if p_butaca_ids is null or array_length(p_butaca_ids, 1) is null then
    raise exception 'Elegi al menos una butaca';
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

  select json_build_object(
    'orden', row_to_json(v_orden),
    'butacas', json_agg(json_build_object(
      'ordenButacaId', ob.id,
      'fila', b.fila,
      'numero', b.numero,
      'tipo', b.tipo
    ) order by b.fila, b.numero)
  )
  into v_resultado
  from public.orden_butacas ob
  join public.butacas b on b.id = ob.butaca_id
  where ob.orden_id = v_orden.id;

  return v_resultado;
end;
$$;

revoke execute on function public.crear_orden(uuid, uuid[], text) from public;
grant  execute on function public.crear_orden(uuid, uuid[], text) to anon, authenticated;
