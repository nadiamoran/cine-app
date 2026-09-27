-- Migracion 005 - La restriccion de edad tambien se valida en la base
--
-- Requiere la migracion 004 ya aplicada.
--
-- Antes, "no dejar comprar a menores" solo estaba validado en Angular. Cualquiera
-- que llame a crear_orden directamente (sin pasar por la pantalla) se salteaba
-- el chequeo. Ahora la funcion SQL rechaza la compra si corresponde, sin
-- importar desde donde se la llame.

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
  v_precio           numeric;
  v_restriccion       text;
  v_edad_minima       int;
  v_fecha_nacimiento  date;
  v_edad              int;
  v_orden             public.ordenes;
  v_butaca            uuid;
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

  return v_orden;
end;
$$;
