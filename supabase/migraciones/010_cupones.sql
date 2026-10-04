-- Migracion 010 - Cupones (bienvenida y por edad) - RF-37, RF-38, RF-39
--
-- Requiere las migraciones 004, 005, 007 y 009 ya aplicadas.
--
-- Una sola tabla para los dos tipos de cupon que pidio el cliente, porque la
-- regla es la misma: un descuento que se aplica solo si el comprador cumple
-- una condicion. "requiere_primera_compra" cubre el cupon de bienvenida (con
-- porcentaje configurable por el admin, RF-38); "requiere_edad_minima" cubre
-- el cupon para mayores de 50 (RF-39), y sirve para crear otros similares en
-- el futuro sin tocar codigo.
--
-- Se aplica UN SOLO cupon por compra (el de mayor porcentaje entre los que
-- el comprador cumple), automatico, sin que haya que ingresar ningun codigo
-- -el cliente nunca pidio una pantalla para "cargar un cupon", solo que el
-- descuento se aplique-.

create table public.cupones (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null,
  porcentaje              numeric not null check (porcentaje > 0 and porcentaje <= 100),
  requiere_primera_compra boolean not null default false,
  requiere_edad_minima    int,
  activo                  boolean not null default true,
  created_at              timestamptz not null default now()
);

alter table public.cupones enable row level security;

drop policy if exists "cupones visibles para administrador" on public.cupones;
create policy "cupones visibles para administrador"
  on public.cupones for select to authenticated
  using (public.tiene_rol(array['administrador']));

drop policy if exists "administrador gestiona cupones" on public.cupones;
create policy "administrador gestiona cupones"
  on public.cupones for all to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

-- Cupon de bienvenida, 20% por defecto (el admin puede cambiar el porcentaje
-- despues). Solo se crea si todavia no existe uno con esta condicion.
insert into public.cupones (nombre, porcentaje, requiere_primera_compra)
select 'Bienvenida', 20, true
where not exists (select 1 from public.cupones where requiere_primera_compra);


-- Reemplaza crear_orden: ahora tambien calcula el cupon que corresponda y
-- aplica el descuento antes de guardar el total.
create or replace function public.crear_orden(
  p_funcion_id  uuid,
  p_butaca_ids  uuid[],
  p_email       text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precio           numeric;
  v_restriccion      text;
  v_edad_minima      int;
  v_fecha_nacimiento date;
  v_edad             int;
  v_es_primera_compra boolean;
  v_cupon            public.cupones%rowtype;
  v_total            numeric;
  v_orden            public.ordenes;
  v_butaca           uuid;
  v_resultado        json;
  v_puntos_ganados   int;
begin
  select f.precio, p.restriccion_edad
    into v_precio, v_restriccion
  from public.funciones f
  join public.peliculas p on p.id = f.pelicula_id
  where f.id = p_funcion_id;

  if v_precio is null then
    raise exception 'La funcion no existe';
  end if;

  -- edad del comprador (si esta logueado): hace falta tanto para la
  -- restriccion de la pelicula como para el cupon de mayores de 50
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

  if p_butaca_ids is null or array_length(p_butaca_ids, 1) is null then
    raise exception 'Elegi al menos una butaca';
  end if;

  v_total := v_precio * array_length(p_butaca_ids, 1);

  -- cupon: solo para usuarios registrados (un anonimo no tiene "primera
  -- compra" ni edad conocida)
  if auth.uid() is not null then
    select not exists (
      select 1 from public.ordenes
      where usuario_id = auth.uid() and estado = 'confirmada'
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

    if v_cupon.id is not null then
      v_total := round(v_total * (1 - v_cupon.porcentaje / 100.0), 2);
    end if;
  end if;

  insert into public.ordenes (funcion_id, usuario_id, email, cantidad_butacas, total)
  values (p_funcion_id, auth.uid(), p_email, array_length(p_butaca_ids, 1), v_total)
  returning * into v_orden;

  foreach v_butaca in array p_butaca_ids loop
    insert into public.orden_butacas (orden_id, butaca_id, funcion_id)
    values (v_orden.id, v_butaca, p_funcion_id);
  end loop;

  if auth.uid() is not null then
    v_puntos_ganados := round(v_orden.total);
    update public.profiles set puntos = puntos + v_puntos_ganados where id = auth.uid();
  end if;

  select json_build_object(
    'orden', row_to_json(v_orden),
    'cuponAplicado', case when v_cupon.id is not null
      then json_build_object('nombre', v_cupon.nombre, 'porcentaje', v_cupon.porcentaje)
      else null
    end,
    'butacas', json_agg(json_build_object(
      'ordenButacaId', ob.id,
      'fila', b.fila,
      'numero', b.numero,
      'tipo', b.tipo
    ) order by b.fila, b.numero)
  )
  into v_resultado
  from public.orden_butacas ob
  join public.butacas b on b.id = ob.butaca_id
  where ob.orden_id = v_orden.id;

  return v_resultado;
end;
$$;
