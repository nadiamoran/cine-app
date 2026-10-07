-- Migracion 025 - Recompensas y canje de puntos (RF-41, RF-42, RF-36)
--
-- Requiere la migracion 024 ya aplicada.
--
-- "Los puntos deben poder canjearse por entradas gratis o por productos del
-- candy bar. Yo como admin quiero poder configurar cuantos puntos cuesta
-- cada recompensa. Por ejemplo, una entrada puede valer 500 puntos y un
-- pochoclo grande 150 puntos. El usuario debe poder ver en su perfil cuantos
-- puntos tiene acumulados y el historial de canjes." (mail del cliente, 03/03)
--
-- Decisiones:
--   - El admin arma una tabla de recompensas: "entrada" (una entrada general
--     gratis, opcionalmente solo para un formato: ej. "Entrada 2D" 500 pts,
--     "Entrada 5D" 900 pts) o "producto" (un producto del candy bar).
--   - Se canjea AL COMPRAR: el cliente elige butacas y, si quiere, paga
--     alguna entrada o producto con puntos. Asi el canje usa el mismo QR,
--     la misma validacion y el mismo retiro del candy bar que una compra.
--   - La entrada canjeada es general (no VIP), igual que la de los combos:
--     una VIP valdria distinto segun el formato y la fila.
--   - Los puntos usados se descuentan en la misma transaccion de la compra:
--     si no alcanzan, no se crea nada. Los que gana esa compra no sirven
--     para canjear en esa misma compra.
--   - Si se cancela la compra, se devuelven los puntos canjeados (y se
--     descuentan los ganados, como en la 024).
--   - Todo movimiento de puntos queda en puntos_movimientos: es el
--     historial de canjes del perfil (RF-36).


-- ---------------------------------------------------------------------
-- Tabla de recompensas (la configura el admin, RF-42)
-- ---------------------------------------------------------------------
create table if not exists public.recompensas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  tipo         text not null check (tipo in ('entrada', 'producto')),
  producto_id  uuid references public.productos(id),
  -- solo para tipo entrada: null = sirve para cualquier formato
  formato      text check (formato in ('2d', '3d', '4d', '5d')),
  puntos       int not null check (puntos > 0),
  activa       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (
    (tipo = 'producto' and producto_id is not null and formato is null)
    or (tipo = 'entrada' and producto_id is null)
  )
);

alter table public.recompensas enable row level security;

-- cualquiera las ve (el cliente necesita saber cuanto cuesta cada una)
drop policy if exists "recompensas publicas" on public.recompensas;
create policy "recompensas publicas"
  on public.recompensas for select to public using (true);

drop policy if exists "administrador gestiona recompensas" on public.recompensas;
create policy "administrador gestiona recompensas"
  on public.recompensas for all to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));


-- ---------------------------------------------------------------------
-- Historial de puntos de cada usuario (RF-36: historial de canjes)
-- ---------------------------------------------------------------------
create table if not exists public.puntos_movimientos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.profiles(id) on delete cascade,
  orden_id       uuid references public.ordenes(id),
  recompensa_id  uuid references public.recompensas(id),
  puntos         int not null,   -- positivo = suma, negativo = resta
  motivo         text not null check (motivo in ('compra', 'canje', 'cancelacion')),
  descripcion    text not null,
  created_at     timestamptz not null default now()
);

create index if not exists puntos_movimientos_usuario_idx
  on public.puntos_movimientos (usuario_id, created_at desc);

alter table public.puntos_movimientos enable row level security;

-- cada uno ve solo los suyos; nadie los escribe desde la app (solo las
-- funciones de abajo). Tampoco hay forma de pasar puntos a otro usuario (RF-43)
drop policy if exists "usuario ve sus movimientos de puntos" on public.puntos_movimientos;
create policy "usuario ve sus movimientos de puntos"
  on public.puntos_movimientos for select to authenticated
  using (auth.uid() = usuario_id);


-- ---------------------------------------------------------------------
-- Canje dentro de cada compra
-- ---------------------------------------------------------------------
alter table public.ordenes
  add column if not exists puntos_usados int not null default 0 check (puntos_usados >= 0);

-- que entrada se pago con puntos (para el PDF y el historial)
alter table public.orden_butacas
  add column if not exists canjeada boolean not null default false;

-- que producto se pago con puntos
alter table public.orden_productos
  add column if not exists recompensa_id uuid references public.recompensas(id);


-- ---------------------------------------------------------------------
-- cancelar_orden: igual que en la 024, mas la devolucion de los puntos
-- canjeados y el registro en puntos_movimientos
-- ---------------------------------------------------------------------
create or replace function public.cancelar_orden(p_orden_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden   public.ordenes;
  v_inicio  timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para cancelar una compra';
  end if;

  select * into v_orden
  from public.ordenes
  where id = p_orden_id and usuario_id = auth.uid()
  for update;

  if v_orden.id is null then
    raise exception 'La compra no existe';
  end if;

  if v_orden.estado = 'cancelada' then
    raise exception 'Esta compra ya fue cancelada';
  end if;

  select inicio into v_inicio from public.funciones where id = v_orden.funcion_id;
  if now() > v_inicio - interval '2 hours' then
    raise exception 'Solo se puede cancelar hasta 2 horas antes de la función';
  end if;

  if exists (select 1 from public.orden_butacas where orden_id = p_orden_id and validada_en is not null)
     or exists (select 1 from public.orden_productos where orden_id = p_orden_id and retirado_en is not null) then
    raise exception 'No se puede cancelar: ya se usó una entrada o se retiró el candy bar';
  end if;

  update public.orden_butacas set cancelada = true where orden_id = p_orden_id;

  update public.ordenes
  set estado = 'cancelada', cancelada_en = now()
  where id = p_orden_id;

  -- credito por lo pagado; se sacan los puntos ganados y se devuelven los canjeados
  update public.profiles
  set credito = credito + v_orden.total,
      puntos  = greatest(puntos - v_orden.puntos_ganados, 0) + v_orden.puntos_usados
  where id = auth.uid();

  if v_orden.total > 0 then
    insert into public.creditos_movimientos (usuario_id, orden_id, monto, motivo)
    values (auth.uid(), p_orden_id, v_orden.total, 'cancelacion');
  end if;

  if v_orden.puntos_ganados > 0 then
    insert into public.puntos_movimientos (usuario_id, orden_id, puntos, motivo, descripcion)
    values (auth.uid(), p_orden_id, -v_orden.puntos_ganados, 'cancelacion', 'Compra cancelada: se descuentan los puntos ganados');
  end if;

  if v_orden.puntos_usados > 0 then
    insert into public.puntos_movimientos (usuario_id, orden_id, puntos, motivo, descripcion)
    values (auth.uid(), p_orden_id, v_orden.puntos_usados, 'cancelacion', 'Compra cancelada: se devuelven los puntos canjeados');
  end if;

  return json_build_object(
    'creditoAcreditado', v_orden.total,
    'puntosDescontados', v_orden.puntos_ganados,
    'puntosDevueltos', v_orden.puntos_usados
  );
end;
$$;


-- ---------------------------------------------------------------------
-- crear_orden: igual que en la 024, mas p_recompensa_ids (un id repetido
-- = esa cantidad). Como cambian los parametros, se borra la anterior.
-- ---------------------------------------------------------------------
drop function if exists public.crear_orden(uuid, uuid[], text, uuid[], uuid[], boolean, text);

create or replace function public.crear_orden(
  p_funcion_id    uuid,
  p_butaca_ids    uuid[],
  p_email         text,
  p_producto_ids  uuid[] default '{}',
  p_combo_ids     uuid[] default '{}',
  p_usar_credito  boolean default false,
  p_metodo_pago   text default null,
  p_recompensa_ids uuid[] default '{}'
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
  v_puntos_ganados    int := 0;
  v_credito           numeric;
  v_credito_usado     numeric := 0;
  v_a_pagar           numeric;
  v_metodo_pago       text;
  v_cantidad_butacas  int := coalesce(array_length(p_butaca_ids, 1), 0);
  v_entradas_combo    int := 0;
  v_butacas_generales int := 0;
  v_butacas_vip       int := 0;
  v_fecha_estreno     date;
  v_descuento         numeric;
  v_estreno           timestamptz;
  v_formato           text;
  v_recompensa_id     uuid;
  v_recompensa        public.recompensas%rowtype;
  v_entradas_canje    int := 0;
  v_puntos_usados     int := 0;
  v_puntos_actuales   int;
begin
  if v_cantidad_butacas = 0
     and coalesce(array_length(p_producto_ids, 1), 0) = 0
     and coalesce(array_length(p_combo_ids, 1), 0) = 0
     and coalesce(array_length(p_recompensa_ids, 1), 0) = 0 then
    raise exception 'La orden esta vacia';
  end if;

  -- precio de las entradas (si hay butacas en esta orden)
  if v_cantidad_butacas > 0 then
    select f.precio, f.precio_vip, p.restriccion_edad, p.fecha_estreno, p.preventa_descuento, f.formato
      into v_precio, v_precio_vip, v_restriccion, v_fecha_estreno, v_descuento, v_formato
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
      -- cuenta tambien las canceladas (ver encabezado)
      select 1 from public.ordenes where usuario_id = auth.uid()
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

  -- RF-41: recompensas pagadas con puntos (solo usuarios registrados)
  if coalesce(array_length(p_recompensa_ids, 1), 0) > 0 then
    if auth.uid() is null then
      raise exception 'Iniciá sesión para canjear puntos';
    end if;

    foreach v_recompensa_id in array p_recompensa_ids loop
      select * into v_recompensa from public.recompensas where id = v_recompensa_id and activa;
      if v_recompensa.id is null then
        raise exception 'Una de las recompensas elegidas no esta disponible';
      end if;

      if v_recompensa.tipo = 'entrada' then
        if v_cantidad_butacas = 0 then
          raise exception 'Para canjear una entrada tenés que elegir una butaca';
        end if;
        if v_recompensa.formato is not null and v_recompensa.formato <> v_formato then
          raise exception '"%" es solo para funciones %', v_recompensa.nombre, upper(v_recompensa.formato);
        end if;
        -- la entrada canjeada no se cobra (al precio vigente, con preventa si corresponde)
        v_total := v_total - v_precio;
        v_entradas_canje := v_entradas_canje + 1;
      else
        select * into v_producto from public.productos where id = v_recompensa.producto_id and activo;
        if v_producto.id is null then
          raise exception 'El producto de "%" no esta disponible', v_recompensa.nombre;
        end if;
        -- se retira con el mismo QR, como cualquier producto de la compra
        insert into public.orden_productos (orden_id, producto_id, recompensa_id, nombre, cantidad, precio_unitario)
        values (v_orden.id, v_producto.id, v_recompensa.id, v_producto.nombre || ' (canje)', 1, 0);
      end if;

      v_puntos_usados := v_puntos_usados + v_recompensa.puntos;
      insert into public.puntos_movimientos (usuario_id, orden_id, recompensa_id, puntos, motivo, descripcion)
      values (auth.uid(), v_orden.id, v_recompensa.id, -v_recompensa.puntos, 'canje', 'Canje: ' || v_recompensa.nombre);
    end loop;

    -- for update: dos compras simultaneas no pueden gastar los mismos puntos
    select puntos into v_puntos_actuales from public.profiles where id = auth.uid() for update;
    if v_puntos_actuales < v_puntos_usados then
      raise exception 'No te alcanzan los puntos: tenés % y el canje cuesta %', v_puntos_actuales, v_puntos_usados;
    end if;
    update public.profiles set puntos = puntos - v_puntos_usados where id = auth.uid();
  end if;

  -- los combos y las entradas canjeadas cubren entradas generales, no VIP:
  -- tiene que haber suficientes butacas no VIP elegidas para todas
  if v_entradas_combo + v_entradas_canje > 0 then
    select count(*) into v_butacas_generales
    from public.butacas
    where id = any(p_butaca_ids) and tipo <> 'vip';

    if v_entradas_combo + v_entradas_canje > v_butacas_generales then
      raise exception 'Los combos y canjes elegidos incluyen % entrada(s) general(es), pero elegiste % butaca(s) general(es). Las butacas VIP no entran en combos ni canjes',
        v_entradas_combo + v_entradas_canje, v_butacas_generales;
    end if;

    -- marca que butacas se pagaron con puntos (las ultimas generales; las
    -- primeras quedan para los combos), para el PDF
    if v_entradas_canje > 0 then
      update public.orden_butacas
      set canjeada = true
      where id in (
        select ob.id
        from public.orden_butacas ob
        join public.butacas b on b.id = ob.butaca_id
        where ob.orden_id = v_orden.id and b.tipo <> 'vip'
        order by b.fila desc, b.numero desc
        limit v_entradas_canje
      );
    end if;
  end if;

  if v_cupon.id is not null then
    v_total := round(v_total * (1 - v_cupon.porcentaje / 100.0), 2);
  end if;

  -- RF-28 / RF-46: el credito de la cuenta paga hasta cubrir el total
  if p_usar_credito and auth.uid() is not null then
    select credito into v_credito from public.profiles where id = auth.uid() for update;
    v_credito_usado := least(coalesce(v_credito, 0), v_total);

    if v_credito_usado > 0 then
      update public.profiles set credito = credito - v_credito_usado where id = auth.uid();
      insert into public.creditos_movimientos (usuario_id, orden_id, monto, motivo)
      values (auth.uid(), v_orden.id, -v_credito_usado, 'compra');
    end if;
  end if;

  -- el resto se paga con el medio elegido (pago simulado, S-2)
  v_a_pagar := v_total - v_credito_usado;
  if v_a_pagar > 0 then
    if p_metodo_pago is null or p_metodo_pago not in ('tarjeta_credito', 'tarjeta_debito', 'mercado_pago') then
      raise exception 'Elegí un medio de pago';
    end if;
    v_metodo_pago := p_metodo_pago;
  else
    v_metodo_pago := 'credito';
  end if;

  -- 1 punto por peso pagado con dinero, solo registrados (S-6)
  if auth.uid() is not null then
    v_puntos_ganados := floor(v_a_pagar);
    update public.profiles set puntos = puntos + v_puntos_ganados where id = auth.uid();

    if v_puntos_ganados > 0 then
      insert into public.puntos_movimientos (usuario_id, orden_id, puntos, motivo, descripcion)
      values (auth.uid(), v_orden.id, v_puntos_ganados, 'compra', 'Puntos por la compra');
    end if;
  end if;

  update public.ordenes
  set total = v_total,
      credito_usado = v_credito_usado,
      metodo_pago = v_metodo_pago,
      puntos_ganados = v_puntos_ganados,
      puntos_usados = v_puntos_usados
  where id = v_orden.id
  returning * into v_orden;

  select json_build_object(
    'orden', row_to_json(v_orden),
    'puntosGanados', v_puntos_ganados,
    'puntosUsados', v_puntos_usados,
    'cuponAplicado', case when v_cupon.id is not null
      then json_build_object('nombre', v_cupon.nombre, 'porcentaje', v_cupon.porcentaje)
      else null
    end,
    'butacas', (
      select coalesce(json_agg(json_build_object(
        'ordenButacaId', ob.id, 'fila', b.fila, 'numero', b.numero, 'tipo', b.tipo,
        'canjeada', ob.canjeada,
        'precio', case when ob.canjeada then 0 when b.tipo = 'vip' then v_precio_vip else v_precio end
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

revoke execute on function public.crear_orden(uuid, uuid[], text, uuid[], uuid[], boolean, text, uuid[]) from public;
grant  execute on function public.crear_orden(uuid, uuid[], text, uuid[], uuid[], boolean, text, uuid[]) to anon, authenticated;
