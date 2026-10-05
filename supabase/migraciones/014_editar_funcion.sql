-- Migracion 014 - Editar una funcion existente
--
-- Requiere la migracion 003 (y 004 para las ordenes) ya aplicadas.
-- Mismas reglas que asignar_funcion: la sala la elige el sistema y no puede
-- haber dos funciones superpuestas en la misma sala (30 min de margen).
-- Si la funcion ya tiene entradas vendidas no se le puede cambiar la sala
-- (las butacas compradas son de esa sala), asi que solo se acepta el cambio
-- si esa misma sala sigue libre en el nuevo horario.

create or replace function public.editar_funcion(
  p_funcion_id  uuid,
  p_pelicula_id uuid,
  p_inicio      timestamptz,
  p_formato     text,
  p_idioma      text,
  p_precio      numeric
)
returns public.funciones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duracion     int;
  v_fin          timestamptz;
  v_sala_actual  uuid;
  v_con_ventas   boolean;
  v_sala         uuid;
  v_resultado    public.funciones;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede editar funciones';
  end if;

  select sala_id into v_sala_actual from public.funciones where id = p_funcion_id;
  if v_sala_actual is null then
    raise exception 'La funcion no existe';
  end if;

  select duracion_minutos into v_duracion
  from public.peliculas where id = p_pelicula_id;
  if v_duracion is null then
    raise exception 'La pelicula no existe';
  end if;

  v_fin := p_inicio + (v_duracion || ' minutes')::interval;

  v_con_ventas := exists (select 1 from public.ordenes where funcion_id = p_funcion_id);

  -- primera sala libre (sin contar la propia funcion), prefiriendo la que ya tenia
  select s.id into v_sala
  from public.salas s
  where (not v_con_ventas or s.id = v_sala_actual)
    and not exists (
      select 1 from public.funciones f
      where f.sala_id = s.id
        and f.id <> p_funcion_id
        and p_inicio < f.fin  + interval '30 minutes'
        and f.inicio < v_fin  + interval '30 minutes'
    )
  order by (s.id = v_sala_actual) desc, s.nombre
  limit 1;

  if v_sala is null then
    if v_con_ventas then
      raise exception 'La funcion ya tiene entradas vendidas y su sala no esta libre en ese horario';
    end if;
    raise exception 'No hay ninguna sala libre en ese horario';
  end if;

  update public.funciones
     set pelicula_id = p_pelicula_id,
         sala_id     = v_sala,
         inicio      = p_inicio,
         fin         = v_fin,
         formato     = p_formato,
         idioma      = p_idioma,
         precio      = p_precio
   where id = p_funcion_id
  returning * into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function public.editar_funcion(uuid, uuid, timestamptz, text, text, numeric) from public, anon;
grant  execute on function public.editar_funcion(uuid, uuid, timestamptz, text, text, numeric) to authenticated;
