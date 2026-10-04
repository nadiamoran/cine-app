-- Migracion 009 - Puntos de fidelizacion (RF-40 a RF-43) y base del perfil
--
-- Requiere las migraciones 004, 005 y 007 ya aplicadas.
--
-- Por cada compra confirmada, el usuario registrado gana 1 punto por cada
-- peso pagado. Los puntos no son transferibles (no hay ninguna funcion que
-- permita mover puntos de un usuario a otro, a proposito). El canje de
-- puntos por recompensas se agrega en una migracion aparte, junto con el
-- candy bar (las recompensas van a ser productos o entradas).

alter table public.profiles
  add column if not exists puntos int not null default 0;

-- Reemplaza crear_orden para que, ademas de todo lo que ya hacia, sume los
-- puntos si quien compra es un usuario registrado (auth.uid() no nulo).
create or replace function public.crear_orden(
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
  v_puntos_ganados   int;
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

  -- 1 punto por cada peso pagado, solo para usuarios registrados
  if auth.uid() is not null then
    v_puntos_ganados := round(v_orden.total);
    update public.profiles set puntos = puntos + v_puntos_ganados where id = auth.uid();
  end if;

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
