-- Migracion 012 - Candy bar en la compra y retiro con el mismo QR (RF-31, RF-32)
--
-- Requiere las migraciones 004, 007, 009, 010 y 011 ya aplicadas.
--
-- "Con el mismo QR puedan retirar eso tambien" (mail del cliente): no se
-- genera un QR aparte para el candy bar. El codigo de CUALQUIER butaca de la
-- orden sirve para retirar los productos de esa orden completa -es una
-- accion separada de validar la entrada, con su propio registro de cuando
-- se entrego, asi una no bloquea a la otra-.

create table public.orden_productos (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid not null references public.ordenes(id) on delete cascade,
  producto_id     uuid references public.productos(id),
  combo_id        uuid references public.combos(id),
  nombre          text not null,
  cantidad        int not null default 1 check (cantidad > 0),
  precio_unitario numeric not null check (precio_unitario >= 0),
  retirado_en     timestamptz,
  retirado_por    uuid references auth.users(id),
  check (producto_id is not null or combo_id is not null)
);

alter table public.orden_productos enable row level security;

create policy "usuario ve productos de sus propias ordenes"
  on public.orden_productos for select to authenticated
  using (
    exists (
      select 1 from public.ordenes o
      where o.id = orden_productos.orden_id and o.usuario_id = auth.uid()
    )
  );


-- Reemplaza crear_orden: ahora tambien recibe productos y combos sueltos
-- (arrays de ids; un id repetido = esa cantidad). Se puede comprar candy bar
-- sin entradas, o entradas sin candy bar, pero no una orden vacia.
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
    v_total := v_total + v_combo.precio;
  end loop;

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


-- Retira los productos de candy bar de una orden, usando el mismo codigo que
-- una de sus entradas. Es una accion independiente de validar_entrada: se
-- puede retirar el candy sin haber validado (todavia) la entrada, y viceversa.
create or replace function public.retirar_candy(p_orden_butaca_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden_id uuid;
  v_items    json;
begin
  if not public.tiene_rol(array['empleado', 'administrador']) then
    raise exception 'Solo un empleado puede retirar productos del candy bar';
  end if;

  select orden_id into v_orden_id from public.orden_butacas where id = p_orden_butaca_id;
  if v_orden_id is null then
    raise exception 'Código inválido';
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

revoke execute on function public.retirar_candy(uuid) from public, anon;
grant  execute on function public.retirar_candy(uuid) to authenticated;
