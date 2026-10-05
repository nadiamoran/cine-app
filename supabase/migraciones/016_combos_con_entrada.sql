-- Migracion 016 - Combos especiales: entrada + candy a precio fijo, con foto
--
-- Requiere las migraciones 011 y 012 ya aplicadas.
--
-- "Combos especiales: entrada + pochoclos + bebida a un precio fijo" (mail
-- del cliente). El cliente elige sus butacas como siempre y despues el combo:
-- las entradas que trae el combo dejan de cobrarse sueltas y se paga solo el
-- precio del combo. El combo cubre entradas generales (no VIP).

alter table public.combos
  add column if not exists entradas_incluidas int not null default 0
    check (entradas_incluidas >= 0),
  add column if not exists imagen_url text;


-- ---------------------------------------------------------------------
-- Bucket "candy" para las fotos de los combos: lectura publica, solo el
-- administrador sube / reemplaza / borra (mismo criterio que la 002)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('candy', 'candy', true)
on conflict (id) do nothing;

drop policy if exists "administrador sube imagenes candy" on storage.objects;
create policy "administrador sube imagenes candy"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'candy' and public.tiene_rol(array['administrador']));

drop policy if exists "administrador gestiona imagenes candy" on storage.objects;
create policy "administrador gestiona imagenes candy"
  on storage.objects for update to authenticated
  using      (bucket_id = 'candy' and public.tiene_rol(array['administrador']))
  with check (bucket_id = 'candy' and public.tiene_rol(array['administrador']));

drop policy if exists "administrador borra imagenes candy" on storage.objects;
create policy "administrador borra imagenes candy"
  on storage.objects for delete to authenticated
  using (bucket_id = 'candy' and public.tiene_rol(array['administrador']));


-- ---------------------------------------------------------------------
-- crear_orden: igual que en la 012, pero descontando las entradas que
-- incluye cada combo y validando que alcancen las butacas generales
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
begin
  if v_cantidad_butacas = 0
     and coalesce(array_length(p_producto_ids, 1), 0) = 0
     and coalesce(array_length(p_combo_ids, 1), 0) = 0 then
    raise exception 'La orden esta vacia';
  end if;

  -- precio de las entradas (si hay butacas en esta orden)
  if v_cantidad_butacas > 0 then
    select f.precio, p.restriccion_edad
      into v_precio, v_restriccion
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

    v_total := v_precio * v_cantidad_butacas;
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
        'ordenButacaId', ob.id, 'fila', b.fila, 'numero', b.numero, 'tipo', b.tipo
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
