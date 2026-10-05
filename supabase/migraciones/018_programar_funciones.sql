-- Migracion 018 - Programar funciones recurrentes
--
-- Requiere las migraciones 003 y 015 ya aplicadas.
--
-- "Yo quiero que una pelicula se proyecte los lunes, martes y viernes a las
-- 18hs. En que sala se mostraran se deberia asignar automatico" (mail del
-- cliente). En vez de cargar funcion por funcion, el admin define un patron
-- (dias de la semana + horarios + periodo) y se generan todas juntas.
--
-- Mismas reglas que asignar_funcion: primera sala habilitada sin
-- superposicion, con 30 min de margen despues de que termina la anterior.
-- Ademas intenta dejar toda la serie en la misma sala.
--
-- p_confirmar = false -> vista previa: hace todo igual pero al final deshace
-- los cambios, asi la vista previa muestra exactamente lo que se crearia
-- (incluso los choques entre funciones de la misma tanda).
-- p_confirmar = true  -> crea las funciones que tienen sala; las que no
-- tienen lugar se informan y no se crean.

create or replace function public.programar_funciones(
  p_pelicula_id uuid,
  p_dias        int[],   -- dias de la semana, 1 = lunes ... 7 = domingo
  p_horas       time[],
  p_desde       date,
  p_hasta       date,
  p_formato     text,
  p_idioma      text,
  p_precio      numeric,
  p_confirmar   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duracion     int;
  v_fecha        date;
  v_hora         time;
  v_inicio       timestamptz;
  v_fin          timestamptz;
  v_sala         uuid;
  v_sala_nombre  text;
  v_preferida    uuid;
  v_resultado    jsonb := '[]'::jsonb;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede crear funciones';
  end if;

  if coalesce(array_length(p_dias, 1), 0) = 0 then
    raise exception 'Elegí al menos un día de la semana';
  end if;
  if coalesce(array_length(p_horas, 1), 0) = 0 then
    raise exception 'Agregá al menos un horario';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha "hasta" no puede ser anterior a "desde"';
  end if;
  if p_hasta - p_desde > 60 then
    raise exception 'El período no puede ser de más de 60 días';
  end if;

  select duracion_minutos into v_duracion
  from public.peliculas where id = p_pelicula_id;
  if v_duracion is null then
    raise exception 'La pelicula no existe';
  end if;

  begin
    for v_fecha in
      select d::date from generate_series(p_desde, p_hasta, interval '1 day') d
    loop
      continue when not (extract(isodow from v_fecha)::int = any (p_dias));

      for v_hora in select distinct h from unnest(p_horas) h order by h loop
        -- la hora que carga el admin es hora de Argentina
        v_inicio := (v_fecha + v_hora) at time zone 'America/Argentina/Buenos_Aires';
        continue when v_inicio <= now();

        v_fin := v_inicio + make_interval(mins => v_duracion);

        v_sala := null;
        v_sala_nombre := null;

        select s.id, s.nombre into v_sala, v_sala_nombre
        from public.salas s
        where s.habilitada
          and not exists (
            select 1 from public.funciones f
            where f.sala_id = s.id
              and v_inicio < f.fin   + interval '30 minutes'
              and f.inicio < v_fin   + interval '30 minutes'
          )
        order by coalesce(s.id = v_preferida, false) desc, s.nombre
        limit 1;

        if v_sala is not null then
          -- se inserta tambien en la vista previa, asi la funcion siguiente
          -- de la misma tanda "ve" a esta y no le pisa la sala
          insert into public.funciones (pelicula_id, sala_id, inicio, fin, formato, idioma, precio)
          values (p_pelicula_id, v_sala, v_inicio, v_fin, p_formato, p_idioma, p_precio);
          v_preferida := coalesce(v_preferida, v_sala);
        end if;

        v_resultado := v_resultado || jsonb_build_object(
          'inicio', v_inicio,
          'salaNombre', v_sala_nombre
        );
      end loop;
    end loop;

    if not p_confirmar then
      -- deshace todo lo insertado en este bloque (es solo vista previa)
      raise exception using errcode = 'P0V01', message = 'vista previa';
    end if;
  exception
    when sqlstate 'P0V01' then
      null;
  end;

  return v_resultado;
end;
$$;

revoke execute on function public.programar_funciones(uuid, int[], time[], date, date, text, text, numeric, boolean) from public, anon;
grant  execute on function public.programar_funciones(uuid, int[], time[], date, date, text, text, numeric, boolean) to authenticated;
