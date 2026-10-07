-- Migracion 023 - Preventa por pelicula (RF-29)
--
-- Requiere las migraciones 013, 021 y 022 ya aplicadas.
--
-- "La venta se abre 7 dias antes del estreno con un precio especial; pasada
-- la fecha vuelve al precio normal. Que se pueda configurar por pelicula"
-- (mail del cliente, 08/03).
--
-- Decisiones:
--   - El admin activa la preventa desde la pelicula y escribe un DESCUENTO
--     EN PESOS (peliculas.preventa_descuento; null = sin preventa). Se resta
--     del precio de la tabla (021) en todos los formatos y tambien en la VIP,
--     asi un 5D sigue costando mas que un 2D y la VIP mas que la estandar.
--   - Usa la fecha de estreno de la pelicula (obligatoria para tener preventa).
--   - La venta de sus funciones abre 7 dias antes del estreno; antes se
--     rechaza. Las peliculas SIN preventa no cambian.
--   - El precio de preventa se aplica segun la fecha de COMPRA: hasta el dia
--     anterior al estreno. Desde el estreno vuelve solo al precio normal.
--   - Lo calcula crear_orden en el momento de la compra (las funciones
--     guardan siempre el precio normal de la tabla).


alter table public.peliculas
  add column if not exists preventa_descuento numeric check (preventa_descuento > 0);


-- Comienzo del dia del estreno en hora de Argentina (fecha_estreno es date)
create or replace function public.inicio_estreno(p_fecha date)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select p_fecha::timestamp at time zone 'America/Argentina/Buenos_Aires';
$$;


-- ---------------------------------------------------------------------
-- Validacion de la preventa al crear o modificar una pelicula. Es un
-- trigger (y no una funcion aparte) porque el admin inserta y actualiza
-- peliculas directo con su policy: asi la regla vale por cualquier camino.
-- ---------------------------------------------------------------------
create or replace function public.validar_preventa_pelicula()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_precio_minimo numeric;
begin
  if new.preventa_descuento is null then
    return new;
  end if;

  if new.fecha_estreno is null then
    raise exception 'Para tener preventa la pelicula necesita fecha de estreno';
  end if;

  -- el descuento no puede dejar ninguna entrada en $0 o menos
  select min(precio) into v_precio_minimo from public.precios_entrada;
  if v_precio_minimo is not null and new.preventa_descuento >= v_precio_minimo then
    raise exception 'El descuento de preventa tiene que ser menor que $% (la entrada estandar mas barata)', v_precio_minimo;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_preventa_pelicula on public.peliculas;
create trigger validar_preventa_pelicula
  before insert or update of preventa_descuento, fecha_estreno on public.peliculas
  for each row execute function public.validar_preventa_pelicula();


-- ---------------------------------------------------------------------
-- guardar_precios_entrada: igual que en la 021, pero no deja bajar un
-- precio por debajo del descuento de alguna preventa activa (si no, esa
-- entrada quedaria en $0 o negativa)
-- ---------------------------------------------------------------------
create or replace function public.guardar_precios_entrada(p_precios jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item           jsonb;
  v_descuento_max  numeric;
  v_pelicula       text;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede cambiar los precios';
  end if;

  select preventa_descuento, nombre into v_descuento_max, v_pelicula
  from public.peliculas
  where preventa_descuento is not null
    and fecha_estreno is not null
    and public.inicio_estreno(fecha_estreno) > now()
  order by preventa_descuento desc
  limit 1;

  for v_item in select * from jsonb_array_elements(p_precios) loop
    if (v_item->>'precioVip')::numeric <= (v_item->>'precio')::numeric then
      raise exception 'En %, la butaca VIP tiene que costar mas que la estandar', upper(v_item->>'formato');
    end if;

    if v_descuento_max is not null and (v_item->>'precio')::numeric <= v_descuento_max then
      raise exception 'En %, el precio estandar tiene que ser mayor que $% (descuento de la preventa de "%")',
        upper(v_item->>'formato'), v_descuento_max, v_pelicula;
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


-- ---------------------------------------------------------------------
-- crear_orden: igual que en la 021, mas la preventa:
--   - antes de 7 dias del estreno no se vende
--   - hasta el estreno, estandar y VIP llevan el descuento (y los combos
--     descuentan la entrada al precio de preventa, que es lo que se cobra)
--   - cada butaca devuelve el precio que realmente se cobro
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
  v_fecha_estreno     date;
  v_descuento         numeric;
  v_estreno           timestamptz;
begin
  if v_cantidad_butacas = 0
     and coalesce(array_length(p_producto_ids, 1), 0) = 0
     and coalesce(array_length(p_combo_ids, 1), 0) = 0 then
    raise exception 'La orden esta vacia';
  end if;

  -- precio de las entradas (si hay butacas en esta orden)
  if v_cantidad_butacas > 0 then
    select f.precio, f.precio_vip, p.restriccion_edad, p.fecha_estreno, p.preventa_descuento
      into v_precio, v_precio_vip, v_restriccion, v_fecha_estreno, v_descuento
    from public.funciones f
    join public.peliculas p on p.id = f.pelicula_id
    where f.id = p_funcion_id;

    if v_precio is null then
      raise exception 'La funcion no existe';
    end if;

    -- RF-29: preventa (solo si la pelicula la tiene activada)
    if v_descuento is not null and v_fecha_estreno is not null then
      v_estreno := public.inicio_estreno(v_fecha_estreno);

      if now() < v_estreno - interval '7 days' then
        raise exception 'La preventa de esta pelicula abre el %',
          to_char(v_fecha_estreno - 7, 'DD/MM');
      end if;

      if now() < v_estreno then
        v_precio     := v_precio - v_descuento;
        v_precio_vip := v_precio_vip - v_descuento;
      end if;
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
        'precio', case when b.tipo = 'vip' then v_precio_vip else v_precio end
      ) order by b.fila, b.numero), '[]'::json)
      from public.orden_butacas ob
      join public.butacas b on b.id = ob.butaca_id
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
