-- Migracion 015 - Habilitar / deshabilitar salas
--
-- Requiere las migraciones 001, 003, 004 y 014 ya aplicadas.
-- Una sala deshabilitada no se usa en la asignacion automatica de funciones
-- nuevas. Las funciones que ya tenia programadas no se tocan.

alter table public.salas
  add column if not exists habilitada boolean not null default true;

-- Igual que en la 003, pero solo busca entre las salas habilitadas
create or replace function public.asignar_funcion(
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
  v_duracion   int;
  v_fin        timestamptz;
  v_sala       uuid;
  v_resultado  public.funciones;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede crear funciones';
  end if;

  select duracion_minutos into v_duracion
  from public.peliculas where id = p_pelicula_id;

  if v_duracion is null then
    raise exception 'La pelicula no existe';
  end if;

  v_fin := p_inicio + (v_duracion || ' minutes')::interval;

  -- primera sala habilitada que no tenga ninguna funcion superpuesta (con 30 min de margen)
  select s.id into v_sala
  from public.salas s
  where s.habilitada
    and not exists (
      select 1 from public.funciones f
      where f.sala_id = s.id
        and p_inicio  < f.fin    + interval '30 minutes'
        and f.inicio  < v_fin    + interval '30 minutes'
    )
  order by s.nombre
  limit 1;

  if v_sala is null then
    raise exception 'No hay ninguna sala libre en ese horario';
  end if;

  insert into public.funciones (pelicula_id, sala_id, inicio, fin, formato, idioma, precio)
  values (p_pelicula_id, v_sala, p_inicio, v_fin, p_formato, p_idioma, p_precio)
  returning * into v_resultado;

  return v_resultado;
end;
$$;

-- Igual que en la 014, pero solo busca entre las salas habilitadas. Si la
-- funcion ya tiene entradas vendidas puede quedarse en su sala aunque esa
-- sala ahora este deshabilitada (las butacas compradas son de ahi).
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
  where (case when v_con_ventas then s.id = v_sala_actual else s.habilitada end)
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
