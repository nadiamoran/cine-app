-- Migracion 024 - Cancelacion con credito y uso del credito al pagar
--                 (RF-44 a RF-47 y RF-28)
--
-- Requiere las migraciones 019, 020, 022 y 023 ya aplicadas.
--
-- "Necesitamos que los usuarios puedan cancelar una compra hasta 2 horas
-- antes de la funcion. No queremos devolver dinero, sino darles credito en
-- su cuenta para futuras compras. El credito debe aparecer en su perfil y
-- poder usarse junto con otros metodos de pago." (mail del cliente, 10/03)
--
-- Decisiones:
--   - Se cancela la compra entera (no entrada por entrada), solo un usuario
--     registrado (el credito va "a su cuenta": un anonimo no tiene cuenta).
--   - Hasta 2 horas antes del inicio, y solo si no se uso nada: ni una
--     entrada validada ni el candy retirado (S-7).
--   - Credito = el total de la orden (lo pagado con dinero + el credito que
--     se haya usado en esa compra). Nunca dinero.
--   - Se revierten los puntos que gano esa compra.
--   - Las butacas se liberan (triggers de la 019) y se pueden volver a
--     vender; el QR deja de valer (validar_entrada / retirar_candy, 022).
--   - Al pagar, el usuario puede usar su credito: se descuenta hasta cubrir
--     el total y el resto se paga con un medio de pago simulado (S-2:
--     tarjeta de credito, tarjeta de debito o Mercado Pago). Los puntos se
--     ganan solo sobre lo pagado con dinero (S-6).
--   - El cupon de primera compra cuenta cualquier orden anterior, aunque
--     este cancelada: si no, comprar con el 20 %, cancelar y volver a comprar
--     daria el cupon de bienvenida otra vez.


-- ---------------------------------------------------------------------
-- Credito en el perfil y su historial de movimientos
-- ---------------------------------------------------------------------
-- El cliente no puede escribir esta columna: los permisos de columna de la
-- 001 solo le dejan modificar sus datos personales. Solo la mueven las
-- funciones de abajo.
alter table public.profiles
  add column if not exists credito numeric not null default 0 check (credito >= 0);

create table if not exists public.creditos_movimientos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.profiles(id) on delete cascade,
  orden_id    uuid references public.ordenes(id),
  monto       numeric not null,   -- positivo = se acredita, negativo = se usa
  motivo      text not null check (motivo in ('cancelacion', 'compra')),
  created_at  timestamptz not null default now()
);

create index if not exists creditos_movimientos_usuario_idx
  on public.creditos_movimientos (usuario_id, created_at desc);

alter table public.creditos_movimientos enable row level security;

drop policy if exists "usuario ve sus movimientos de credito" on public.creditos_movimientos;
create policy "usuario ve sus movimientos de credito"
  on public.creditos_movimientos for select to authenticated
  using (auth.uid() = usuario_id);


-- ---------------------------------------------------------------------
-- Datos de pago en cada orden
-- ---------------------------------------------------------------------
--   total          = lo que vale la compra (despues del cupon)
--   credito_usado  = parte del total pagada con credito
--   total - credito_usado = lo pagado con el medio de pago (dinero)
alter table public.ordenes
  add column if not exists credito_usado  numeric not null default 0 check (credito_usado >= 0),
  add column if not exists metodo_pago    text check (metodo_pago in ('tarjeta_credito', 'tarjeta_debito', 'mercado_pago', 'credito')),
  add column if not exists puntos_ganados int not null default 0,
  add column if not exists cancelada_en   timestamptz;

-- ordenes anteriores a esta migracion: no usaban credito y ganaban 1 punto
-- por peso del total (asi lo calculaba crear_orden). Se completa para que,
-- si se cancelan, se descuenten los puntos correctos.
update public.ordenes
set puntos_ganados = round(total)
where usuario_id is not null and puntos_ganados = 0 and estado = 'confirmada';


-- ---------------------------------------------------------------------
-- Una butaca de una orden cancelada se tiene que poder volver a vender
-- (RF-47). El unique (funcion_id, butaca_id) de la 004 lo impedia, porque
-- la fila de la orden cancelada sigue existiendo (su id es el codigo del QR
-- y queda en el historial). Se reemplaza por un indice unico que solo
-- cuenta las butacas de compras vigentes: sigue siendo imposible vender
-- dos veces la misma butaca (RNF-09).
-- ---------------------------------------------------------------------
alter table public.orden_butacas
  add column if not exists cancelada boolean not null default false;

-- se busca por columnas y no por nombre, por si Postgres le puso otro
do $$
declare
  v_nombre text;
begin
  select c.conname into v_nombre
  from pg_constraint c
  where c.conrelid = 'public.orden_butacas'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from unnest(c.conkey) k
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
    ) = array['butaca_id', 'funcion_id'];

  if v_nombre is not null then
    execute format('alter table public.orden_butacas drop constraint %I', v_nombre);
  end if;
end;
$$;

create unique index if not exists orden_butacas_butaca_vigente_idx
  on public.orden_butacas (funcion_id, butaca_id)
  where not cancelada;


-- ---------------------------------------------------------------------
-- Cancelar una compra (solo el dueno de la orden)
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

  -- for update: dos cancelaciones simultaneas de la misma orden no pueden
  -- acreditar dos veces
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

  -- libera las butacas para que se puedan volver a vender
  update public.orden_butacas set cancelada = true where orden_id = p_orden_id;

  -- los triggers de la 019 y la 020 liberan las butacas en tiempo real y
  -- restan las ventas de la pelicula
  update public.ordenes
  set estado = 'cancelada', cancelada_en = now()
  where id = p_orden_id;

  -- credito por todo lo pagado (dinero + credito usado), y se sacan los
  -- puntos que habia ganado esa compra
  update public.profiles
  set credito = credito + v_orden.total,
      puntos  = greatest(puntos - v_orden.puntos_ganados, 0)
  where id = auth.uid();

  if v_orden.total > 0 then
    insert into public.creditos_movimientos (usuario_id, orden_id, monto, motivo)
    values (auth.uid(), p_orden_id, v_orden.total, 'cancelacion');
  end if;

  return json_build_object(
    'creditoAcreditado', v_orden.total,
    'puntosDescontados', v_orden.puntos_ganados
  );
end;
$$;

revoke execute on function public.cancelar_orden(uuid) from public, anon;
grant  execute on function public.cancelar_orden(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- crear_orden: igual que en la 023, mas:
--   - p_usar_credito: usa el credito de la cuenta (hasta cubrir el total)
--   - p_metodo_pago: medio de pago simulado para el resto (S-2)
--   - los puntos se ganan solo sobre lo pagado con dinero (S-6)
--   - el cupon de primera compra cuenta tambien las ordenes canceladas
-- Como cambian los parametros, se borra la version anterior.
-- ---------------------------------------------------------------------
drop function if exists public.crear_orden(uuid, uuid[], text, uuid[], uuid[]);

create or replace function public.crear_orden(
  p_funcion_id    uuid,
  p_butaca_ids    uuid[],
  p_email         text,
  p_producto_ids  uuid[] default '{}',
  p_combo_ids     uuid[] default '{}',
  p_usar_credito  boolean default false,
  p_metodo_pago   text default null
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
  end if;

  update public.ordenes
  set total = v_total,
      credito_usado = v_credito_usado,
      metodo_pago = v_metodo_pago,
      puntos_ganados = v_puntos_ganados
  where id = v_orden.id
  returning * into v_orden;

  select json_build_object(
    'orden', row_to_json(v_orden),
    'puntosGanados', v_puntos_ganados,
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

revoke execute on function public.crear_orden(uuid, uuid[], text, uuid[], uuid[], boolean, text) from public;
grant  execute on function public.crear_orden(uuid, uuid[], text, uuid[], uuid[], boolean, text) to anon, authenticated;
