-- Migracion 021 - Precios de entradas por formato y tipo de butaca (RF-15)
--
-- Requiere las migraciones 015, 016 y 018 ya aplicadas.
--
-- "Las filas R, S y T seran VIP: tienen que costar mas y el usuario tiene
-- que saber que esta comprando una VIP" (mail del cliente, 10/03). Ademas
-- una entrada 2D no vale lo mismo que una 3D, 4D o 5D, y una VIP 2D no
-- vale lo mismo que una VIP 5D.
--
-- Decision: una tabla de precios unica para todo el cine (las salas son
-- todas iguales), con un monto en pesos por formato para la butaca estandar
-- y otro para la VIP. Las accesibles pagan el precio estandar.
--
--   - Al crear / editar / programar una funcion, la base le copia los
--     precios de su formato (funciones.precio y funciones.precio_vip). El
--     admin ya no escribe el precio a mano: no se puede equivocar.
--   - Si el admin cambia la tabla, se actualizan las funciones que todavia
--     no empezaron. Las compras hechas no cambian (cada orden guarda su total).
--   - crear_orden cobra cada butaca segun su tipo.
--
-- Por que copiar el precio en la funcion y no leer la tabla al comprar: el
-- detalle de pelicula, la compra y el PDF ya leen funciones.precio, y mas
-- adelante la preventa (RF-29) puede poner un precio especial en las
-- funciones de una pelicula sin tocar la tabla general.


-- ---------------------------------------------------------------------
-- Tabla de precios
-- ---------------------------------------------------------------------
create table if not exists public.precios_entrada (
  formato     text primary key check (formato in ('2d', '3d', '4d', '5d')),
  precio      numeric not null check (precio >= 0),
  precio_vip  numeric not null check (precio_vip >= 0),
  -- RF-15: la VIP tiene que costar mas que la estandar
  check (precio_vip > precio)
);

alter table public.precios_entrada enable row level security;

-- cualquiera la puede leer (los precios son publicos); nadie la escribe
-- directo: solo guardar_precios_entrada, que exige administrador
drop policy if exists "precios de entrada publicos" on public.precios_entrada;
create policy "precios de entrada publicos"
  on public.precios_entrada for select to public using (true);

-- valores iniciales de ejemplo: el admin los cambia desde la pantalla Salas
insert into public.precios_entrada (formato, precio, precio_vip) values
  ('2d', 3000, 4200),
  ('3d', 3800, 5200),
  ('4d', 5000, 6800),
  ('5d', 6000, 8000)
on conflict (formato) do nothing;


-- ---------------------------------------------------------------------
-- Precio VIP en cada funcion
-- ---------------------------------------------------------------------
alter table public.funciones
  add column if not exists precio_vip numeric not null default 0 check (precio_vip >= 0);

-- las funciones que todavia no empezaron toman los precios de la tabla
update public.funciones f
set precio = pe.precio, precio_vip = pe.precio_vip
from public.precios_entrada pe
where pe.formato = f.formato and f.inicio > now();

-- las que ya pasaron: la VIP queda igual que la estandar (no se vendieron
-- como VIP con otro precio y ya no se pueden comprar)
update public.funciones
set precio_vip = precio
where inicio <= now() and precio_vip = 0;


-- ---------------------------------------------------------------------
-- Guardar la tabla (solo administrador). Recibe un arreglo JSON:
--   [{"formato": "2d", "precio": 3000, "precioVip": 4200}, ...]
-- y actualiza las funciones que todavia no empezaron.
-- ---------------------------------------------------------------------
create or replace function public.guardar_precios_entrada(p_precios jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede cambiar los precios';
  end if;

  for v_item in select * from jsonb_array_elements(p_precios) loop
    if (v_item->>'precioVip')::numeric <= (v_item->>'precio')::numeric then
      raise exception 'En %, la butaca VIP tiene que costar mas que la estandar', upper(v_item->>'formato');
    end if;

    insert into public.precios_entrada (formato, precio, precio_vip)
    values (v_item->>'formato', (v_item->>'precio')::numeric, (v_item->>'precioVip')::numeric)
    on conflict (formato) do update
      set precio = excluded.precio, precio_vip = excluded.precio_vip;
  end loop;

  update public.funciones f
  set precio = pe.precio, precio_vip = pe.precio_vip
  from public.precios_entrada pe
  where pe.formato = f.formato and f.inicio > now();
end;
$$;

revoke execute on function public.guardar_precios_entrada(jsonb) from public, anon;
grant  execute on function public.guardar_precios_entrada(jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- asignar_funcion, editar_funcion y programar_funciones ya no reciben el
-- precio: lo toman de la tabla segun el formato. Como cambia la lista de
-- parametros, hay que borrar las versiones viejas (si no, quedarian las dos
-- y la API no sabria cual llamar).
-- ---------------------------------------------------------------------
drop function if exists public.asignar_funcion(uuid, timestamptz, text, text, numeric);
drop function if exists public.editar_funcion(uuid, uuid, timestamptz, text, text, numeric);
drop function if exists public.programar_funciones(uuid, int[], time[], date, date, text, text, numeric, boolean);


-- Igual que en la 015, con el precio sacado de la tabla
create or replace function public.asignar_funcion(
  p_pelicula_id uuid,
  p_inicio      timestamptz,
  p_formato     text,
  p_idioma      text
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
  v_precios    public.precios_entrada;
  v_resultado  public.funciones;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede crear funciones';
  end if;

  select * into v_precios from public.precios_entrada where formato = p_formato;
  if v_precios.formato is null then
    raise exception 'No hay precio cargado para el formato %', upper(p_formato);
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

  insert into public.funciones (pelicula_id, sala_id, inicio, fin, formato, idioma, precio, precio_vip)
  values (p_pelicula_id, v_sala, p_inicio, v_fin, p_formato, p_idioma, v_precios.precio, v_precios.precio_vip)
  returning * into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function public.asignar_funcion(uuid, timestamptz, text, text) from public, anon;
grant  execute on function public.asignar_funcion(uuid, timestamptz, text, text) to authenticated;


-- Igual que en la 015, con el precio sacado de la tabla (si cambia el
-- formato, cambia el precio)
create or replace function public.editar_funcion(
  p_funcion_id  uuid,
  p_pelicula_id uuid,
  p_inicio      timestamptz,
  p_formato     text,
  p_idioma      text
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
  v_precios      public.precios_entrada;
  v_resultado    public.funciones;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede editar funciones';
  end if;

  select sala_id into v_sala_actual from public.funciones where id = p_funcion_id;
  if v_sala_actual is null then
    raise exception 'La funcion no existe';
  end if;

  select * into v_precios from public.precios_entrada where formato = p_formato;
  if v_precios.formato is null then
    raise exception 'No hay precio cargado para el formato %', upper(p_formato);
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
         precio      = v_precios.precio,
         precio_vip  = v_precios.precio_vip
   where id = p_funcion_id
  returning * into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function public.editar_funcion(uuid, uuid, timestamptz, text, text) from public, anon;
grant  execute on function public.editar_funcion(uuid, uuid, timestamptz, text, text) to authenticated;


-- Igual que en la 018, con el precio sacado de la tabla
create or replace function public.programar_funciones(
  p_pelicula_id uuid,
  p_dias        int[],   -- dias de la semana, 1 = lunes ... 7 = domingo
  p_horas       time[],
  p_desde       date,
  p_hasta       date,
  p_formato     text,
  p_idioma      text,
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
  v_precios      public.precios_entrada;
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

  select * into v_precios from public.precios_entrada where formato = p_formato;
  if v_precios.formato is null then
    raise exception 'No hay precio cargado para el formato %', upper(p_formato);
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
          insert into public.funciones (pelicula_id, sala_id, inicio, fin, formato, idioma, precio, precio_vip)
          values (p_pelicula_id, v_sala, v_inicio, v_fin, p_formato, p_idioma, v_precios.precio, v_precios.precio_vip);
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

revoke execute on function public.programar_funciones(uuid, int[], time[], date, date, text, text, boolean) from public, anon;
grant  execute on function public.programar_funciones(uuid, int[], time[], date, date, text, text, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- crear_orden: igual que en la 016, pero las butacas VIP se cobran a
-- funciones.precio_vip, y cada butaca devuelve su precio (para el PDF)
-- ---------------------------------------------------------------------
create or replace function public.crear_orden(
  p_funcion_id    uuid,
  p_butaca_ids    uuid[],
  p_email         text,
  p_producto_ids  uuid[] default '{}',
  p_combo_ids     uuid[] default '{}'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precio            numeric;
  v_precio_vip        numeric;
  v_restriccion       text;
  v_edad_minima       int;
  v_fecha_nacimiento  date;
  v_edad              int;
  v_es_primera_compra boolean;
  v_cupon             public.cupones%rowtype;
  v_total             numeric := 0;
  v_orden             public.ordenes;
  v_butaca            uuid;
  v_producto_id       uuid;
  v_combo_id          uuid;
  v_producto          public.productos%rowtype;
  v_combo             public.combos%rowtype;
  v_resultado         json;
  v_puntos_ganados    int;
  v_cantidad_butacas  int := coalesce(array_length(p_butaca_ids, 1), 0);
  v_entradas_combo    int := 0;
  v_butacas_generales int := 0;
  v_butacas_vip       int := 0;
begin
  if v_cantidad_butacas = 0
     and coalesce(array_length(p_producto_ids, 1), 0) = 0
     and coalesce(array_length(p_combo_ids, 1), 0) = 0 then
    raise exception 'La orden esta vacia';
  end if;

  -- precio de las entradas (si hay butacas en esta orden)
  if v_cantidad_butacas > 0 then
    select f.precio, f.precio_vip, p.restriccion_edad
      into v_precio, v_precio_vip, v_restriccion
    from public.funciones f
    join public.peliculas p on p.id = f.pelicula_id
    where f.id = p_funcion_id;

    if v_precio is null then
      raise exception 'La funcion no existe';
    end if;

    if auth.uid() is not null then
      select fecha_nacimiento into v_fecha_nacimiento
      from public.profiles where id = auth.uid();

      if v_fecha_nacimiento is not null then
        v_edad := extract(year from age(v_fecha_nacimiento));
      end if;
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
      if v_fecha_nacimiento is null or v_edad < v_edad_minima then
        raise exception 'Esta funcion es apta %: no cumplis la edad minima para comprar', v_restriccion;
      end if;
    end if;

    -- RF-15: las butacas VIP se cobran a su propio precio; estandar y
    -- accesibles, al precio comun de la funcion
    select count(*) into v_butacas_vip
    from public.butacas
    where id = any(p_butaca_ids) and tipo = 'vip';

    v_total := v_precio * (v_cantidad_butacas - v_butacas_vip) + v_precio_vip * v_butacas_vip;
  elsif auth.uid() is not null then
    -- sin entradas en esta orden, igual hace falta la edad para el cupon de mayores
    select fecha_nacimiento into v_fecha_nacimiento from public.profiles where id = auth.uid();
    if v_fecha_nacimiento is not null then
      v_edad := extract(year from age(v_fecha_nacimiento));
    end if;
  end if;

  -- cupon (bienvenida o por edad): se calcula sobre el total de la orden completa
  if auth.uid() is not null then
    select not exists (
      select 1 from public.ordenes where usuario_id = auth.uid() and estado = 'confirmada'
    ) into v_es_primera_compra;

    select c.* into v_cupon
    from public.cupones c
    where c.activo
      and (
        (c.requiere_primera_compra and v_es_primera_compra)
        or (c.requiere_edad_minima is not null and v_edad is not null and v_edad >= c.requiere_edad_minima)
      )
    order by c.porcentaje desc
    limit 1;
  end if;

  insert into public.ordenes (funcion_id, usuario_id, email, cantidad_butacas, total)
  values (p_funcion_id, auth.uid(), p_email, v_cantidad_butacas, 0)
  returning * into v_orden;

  foreach v_butaca in array p_butaca_ids loop
    insert into public.orden_butacas (orden_id, butaca_id, funcion_id)
    values (v_orden.id, v_butaca, p_funcion_id);
  end loop;

  foreach v_producto_id in array p_producto_ids loop
    select * into v_producto from public.productos where id = v_producto_id and activo;
    if v_producto.id is null then
      raise exception 'Uno de los productos elegidos no esta disponible';
    end if;
    insert into public.orden_productos (orden_id, producto_id, nombre, cantidad, precio_unitario)
    values (v_orden.id, v_producto.id, v_producto.nombre, 1, v_producto.precio);
    v_total := v_total + v_producto.precio;
  end loop;

  foreach v_combo_id in array p_combo_ids loop
    select * into v_combo from public.combos where id = v_combo_id and activo;
    if v_combo.id is null then
      raise exception 'Uno de los combos elegidos no esta disponible';
    end if;
    insert into public.orden_productos (orden_id, combo_id, nombre, cantidad, precio_unitario)
    values (v_orden.id, v_combo.id, v_combo.nombre, 1, v_combo.precio);
    -- el combo trae sus entradas generales: esas butacas ya no se cobran
    -- sueltas, se paga solo el precio del combo
    v_total := v_total + v_combo.precio - v_combo.entradas_incluidas * coalesce(v_precio, 0);
    v_entradas_combo := v_entradas_combo + v_combo.entradas_incluidas;
  end loop;

  -- el combo cubre entradas generales, no VIP: tiene que haber suficientes
  -- butacas no VIP elegidas para todas las entradas que incluyen los combos
  if v_entradas_combo > 0 then
    select count(*) into v_butacas_generales
    from public.butacas
    where id = any(p_butaca_ids) and tipo <> 'vip';

    if v_entradas_combo > v_butacas_generales then
      raise exception 'Los combos elegidos incluyen % entrada(s) general(es), pero elegiste % butaca(s) general(es). Las butacas VIP no entran en el combo', v_entradas_combo, v_butacas_generales;
    end if;
  end if;

  if v_cupon.id is not null then
    v_total := round(v_total * (1 - v_cupon.porcentaje / 100.0), 2);
  end if;

  update public.ordenes set total = v_total where id = v_orden.id;
  v_orden.total := v_total;

  if auth.uid() is not null then
    v_puntos_ganados := round(v_total);
    update public.profiles set puntos = puntos + v_puntos_ganados where id = auth.uid();
  end if;

  select json_build_object(
    'orden', row_to_json(v_orden),
    'cuponAplicado', case when v_cupon.id is not null
      then json_build_object('nombre', v_cupon.nombre, 'porcentaje', v_cupon.porcentaje)
      else null
    end,
    'butacas', (
      select coalesce(json_agg(json_build_object(
        'ordenButacaId', ob.id, 'fila', b.fila, 'numero', b.numero, 'tipo', b.tipo,
        'precio', case when b.tipo = 'vip' then f.precio_vip else f.precio end
      ) order by b.fila, b.numero), '[]'::json)
      from public.orden_butacas ob
      join public.butacas b on b.id = ob.butaca_id
      join public.funciones f on f.id = ob.funcion_id
      where ob.orden_id = v_orden.id
    ),
    'productos', (
      select coalesce(json_agg(json_build_object(
        'nombre', op.nombre, 'cantidad', op.cantidad, 'precioUnitario', op.precio_unitario
      )), '[]'::json)
      from public.orden_productos op
      where op.orden_id = v_orden.id
    )
  )
  into v_resultado;

  return v_resultado;
end;
$$;
