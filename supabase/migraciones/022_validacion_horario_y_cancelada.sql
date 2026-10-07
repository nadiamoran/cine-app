-- Migracion 022 - Validacion de QR: horario de la funcion y ordenes canceladas
--
-- Requiere las migraciones 008 y 012 ya aplicadas.
--
-- Dos agujeros en la validacion de empleados (RF-48 a RF-50):
--
-- 1. validar_entrada no miraba la fecha de la funcion: una entrada de
--    manana, o de una funcion de la semana pasada que nunca se uso, pasaba
--    como valida hoy. Ahora solo se acepta desde 1 hora antes del inicio
--    hasta que termina la funcion.
--
-- 2. retirar_candy no miraba si la orden estaba cancelada (validar_entrada
--    si). Cuando exista la cancelacion con credito (RF-44), una orden
--    cancelada podria retirar igual los productos, y eso contradice RF-47
--    ("su QR deja de ser valido").


-- Fecha y hora de Argentina en castellano, ej: "jueves 09/10 18:00".
-- No se usa to_char(..., 'TMDay') porque depende del idioma del servidor
-- (en Supabase sale en ingles).
create or replace function public.fecha_funcion_texto(p_fecha timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select (array['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])
           [extract(isodow from p_fecha at time zone 'America/Argentina/Buenos_Aires')::int]
         || ' '
         || to_char(p_fecha at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI');
$$;


-- Igual que en la 008, mas el chequeo del horario
create or replace function public.validar_entrada(p_orden_butaca_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila        text;
  v_numero      int;
  v_tipo        text;
  v_validada_en timestamptz;
  v_estado      text;
  v_pelicula    text;
  v_inicio      timestamptz;
  v_fin         timestamptz;
begin
  if not public.tiene_rol(array['empleado', 'administrador']) then
    raise exception 'Solo un empleado puede validar entradas';
  end if;

  select ob.validada_en, o.estado, b.fila, b.numero, b.tipo, p.nombre, f.inicio, f.fin
    into v_validada_en, v_estado, v_fila, v_numero, v_tipo, v_pelicula, v_inicio, v_fin
  from public.orden_butacas ob
  join public.ordenes   o on o.id = ob.orden_id
  join public.butacas   b on b.id = ob.butaca_id
  join public.funciones f on f.id = ob.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  where ob.id = p_orden_butaca_id;

  if v_fila is null then
    raise exception 'Código inválido';
  end if;

  if v_estado = 'cancelada' then
    raise exception 'Esta entrada fue cancelada';
  end if;

  if v_validada_en is not null then
    raise exception 'Esta entrada ya fue utilizada el %', to_char(v_validada_en, 'DD/MM/YYYY HH24:MI');
  end if;

  -- se puede entrar desde 1 hora antes del inicio hasta que termina la funcion
  if now() < v_inicio - interval '1 hour' then
    raise exception 'Esta entrada es para el % (se puede validar desde 1 hora antes)',
      public.fecha_funcion_texto(v_inicio);
  end if;

  if now() > v_fin then
    raise exception 'Esta entrada era para el % y la funcion ya termino',
      public.fecha_funcion_texto(v_inicio);
  end if;

  update public.orden_butacas
  set validada_en = now(), validada_por = auth.uid()
  where id = p_orden_butaca_id;

  return json_build_object(
    'pelicula', v_pelicula,
    'funcionInicio', v_inicio,
    'fila', v_fila,
    'numero', v_numero,
    'tipo', v_tipo
  );
end;
$$;


-- Igual que en la 012, mas el chequeo de orden cancelada
create or replace function public.retirar_candy(p_orden_butaca_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden_id uuid;
  v_estado   text;
  v_items    json;
begin
  if not public.tiene_rol(array['empleado', 'administrador']) then
    raise exception 'Solo un empleado puede retirar productos del candy bar';
  end if;

  select ob.orden_id, o.estado into v_orden_id, v_estado
  from public.orden_butacas ob
  join public.ordenes o on o.id = ob.orden_id
  where ob.id = p_orden_butaca_id;

  if v_orden_id is null then
    raise exception 'Código inválido';
  end if;

  if v_estado = 'cancelada' then
    raise exception 'Esta orden fue cancelada';
  end if;

  if not exists (select 1 from public.orden_productos where orden_id = v_orden_id and retirado_en is null) then
    raise exception 'Esta orden no tiene productos pendientes de retirar';
  end if;

  update public.orden_productos
  set retirado_en = now(), retirado_por = auth.uid()
  where orden_id = v_orden_id and retirado_en is null;

  select json_agg(json_build_object('nombre', nombre, 'cantidad', cantidad))
    into v_items
  from public.orden_productos
  where orden_id = v_orden_id;

  return json_build_object('items', v_items);
end;
$$;
