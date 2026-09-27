-- Migracion 008 - Validacion de entradas por parte de empleados
--
-- Requiere las migraciones 004, 005 y 007 ya aplicadas.
--
-- RF-48/49/50: un empleado escanea (o tipea a mano) el codigo de una entrada
-- y la base la marca como usada. Una vez validada, ese mismo codigo no sirve
-- una segunda vez -exactamente lo que pidio el cliente-, sin importar si la
-- validacion se intenta desde la app o llamando la funcion directo.

alter table public.orden_butacas
  add column if not exists validada_en  timestamptz,
  add column if not exists validada_por uuid references auth.users(id);

-- Valida (o rechaza) el codigo de UNA entrada. p_orden_butaca_id es el mismo
-- id que se codifica en el QR de esa entrada (orden_butacas.id).
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
begin
  if not public.tiene_rol(array['empleado', 'administrador']) then
    raise exception 'Solo un empleado puede validar entradas';
  end if;

  select ob.validada_en, o.estado, b.fila, b.numero, b.tipo, p.nombre, f.inicio
    into v_validada_en, v_estado, v_fila, v_numero, v_tipo, v_pelicula, v_inicio
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

revoke execute on function public.validar_entrada(uuid) from public, anon;
grant  execute on function public.validar_entrada(uuid) to authenticated;
