-- Migracion 026 - Log de actividad (RF-55)
--
-- Requiere las migraciones 021, 022, 023 y 025 ya aplicadas.
--
-- "Agrega un log de actividad en el panel de admin: quien creo que funcion,
-- quien modifico un precio, quien valido un QR. Todo debe quedar registrado
-- con fecha y hora." (mail del cliente, 10/03)
--
-- Se registra solo eso:
--   - funciones: creada, editada, eliminada
--   - precios:   tabla de precios de entradas, preventa de una pelicula,
--                precio de productos y de combos
--   - QR:        entrada validada, candy bar entregado
--
-- Como se registra: con triggers. Cada vez que cambia una de esas tablas,
-- la base anota quien fue (auth.uid()), que hizo y cuando. Asi se registra
-- siempre, venga el cambio de donde venga, y nadie lo puede saltear ni
-- borrar desde el navegador.


create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references public.profiles(id),
  usuario     text not null,      -- nombre y rol en ese momento
  tipo        text not null check (tipo in ('funcion', 'precio', 'validacion')),
  accion      text not null,      -- ej: "Funcion creada"
  detalle     text not null,      -- ej: "Dune 2 · 2D · jueves 09/10 18:00 · Sala 1"
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_fecha_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

-- solo el administrador lo lee. No hay policy de insert/update/delete:
-- desde la app nadie puede escribirlo ni borrarlo, solo los triggers
drop policy if exists "administrador ve el log" on public.activity_log;
create policy "administrador ve el log"
  on public.activity_log for select to authenticated
  using (public.tiene_rol(array['administrador']));


-- Anota una accion a nombre del usuario logueado
create or replace function public.registrar_actividad(p_tipo text, p_accion text, p_detalle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario text;
begin
  select nombre || ' ' || apellido || ' (' || rol || ')' into v_usuario
  from public.profiles where id = auth.uid();

  insert into public.activity_log (usuario_id, usuario, tipo, accion, detalle)
  values (auth.uid(), coalesce(v_usuario, 'Sistema'), p_tipo, p_accion, p_detalle);
end;
$$;

revoke execute on function public.registrar_actividad(text, text, text) from public, anon, authenticated;


-- Texto de una funcion: "Dune 2 · 2D · jueves 09/10 18:00 · Sala 1"
create or replace function public.texto_funcion(p_funcion public.funciones)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(p.nombre, '(pelicula)') || ' · ' || upper(p_funcion.formato) || ' · '
         || public.fecha_funcion_texto(p_funcion.inicio) || ' · ' || coalesce(s.nombre, '(sala)')
  from (select 1) x
  left join public.peliculas p on p.id = p_funcion.pelicula_id
  left join public.salas s on s.id = p_funcion.sala_id;
$$;


-- ---------------------------------------------------------------------
-- 1. Quien creo / edito / elimino una funcion
-- ---------------------------------------------------------------------
create or replace function public.log_funciones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_actividad('funcion', 'Función creada', public.texto_funcion(new));
  elsif tg_op = 'DELETE' then
    perform public.registrar_actividad('funcion', 'Función eliminada', public.texto_funcion(old));
  elsif (new.pelicula_id, new.inicio, new.formato, new.idioma, new.sala_id)
        is distinct from (old.pelicula_id, old.inicio, old.formato, old.idioma, old.sala_id) then
    -- solo cuando el admin la edita; si cambia solo el precio es porque se
    -- actualizo la tabla de precios, y eso ya queda registrado aparte
    perform public.registrar_actividad('funcion', 'Función editada',
      'Antes: ' || public.texto_funcion(old) || ' → Ahora: ' || public.texto_funcion(new));
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_funciones on public.funciones;
create trigger log_funciones
  after insert or update or delete on public.funciones
  for each row execute function public.log_funciones();


-- ---------------------------------------------------------------------
-- 2. Quien modifico un precio
-- ---------------------------------------------------------------------

-- Tabla de precios de entradas (pantalla Salas)
create or replace function public.log_precios_entrada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.precio, new.precio_vip) is distinct from (old.precio, old.precio_vip) then
    perform public.registrar_actividad('precio', 'Precio de entradas modificado',
      upper(new.formato) || ': estándar $' || old.precio || ' → $' || new.precio
      || ', VIP $' || old.precio_vip || ' → $' || new.precio_vip);
  end if;
  return new;
end;
$$;

drop trigger if exists log_precios_entrada on public.precios_entrada;
create trigger log_precios_entrada
  after update on public.precios_entrada
  for each row execute function public.log_precios_entrada();


-- Preventa de una pelicula (descuento en pesos)
create or replace function public.log_preventa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.preventa_descuento is distinct from old.preventa_descuento then
    perform public.registrar_actividad('precio', 'Preventa modificada',
      new.nombre || ': descuento '
      || coalesce('$' || old.preventa_descuento, 'sin preventa') || ' → '
      || coalesce('$' || new.preventa_descuento, 'sin preventa'));
  end if;
  return new;
end;
$$;

drop trigger if exists log_preventa on public.peliculas;
create trigger log_preventa
  after update of preventa_descuento on public.peliculas
  for each row execute function public.log_preventa();


-- Precio de productos y combos del candy bar (misma funcion para las dos tablas)
create or replace function public.log_precio_candy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.precio is distinct from old.precio then
    perform public.registrar_actividad('precio',
      case tg_table_name when 'combos' then 'Precio de combo modificado' else 'Precio de producto modificado' end,
      new.nombre || ': $' || old.precio || ' → $' || new.precio);
  end if;
  return new;
end;
$$;

drop trigger if exists log_precio_producto on public.productos;
create trigger log_precio_producto
  after update of precio on public.productos
  for each row execute function public.log_precio_candy();

drop trigger if exists log_precio_combo on public.combos;
create trigger log_precio_combo
  after update of precio on public.combos
  for each row execute function public.log_precio_candy();


-- ---------------------------------------------------------------------
-- 3. Quien valido un QR (entrada o candy bar)
-- ---------------------------------------------------------------------
create or replace function public.log_entrada_validada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funcion public.funciones;
  v_butaca  text;
begin
  if old.validada_en is null and new.validada_en is not null then
    select * into v_funcion from public.funciones where id = new.funcion_id;
    select fila || numero into v_butaca from public.butacas where id = new.butaca_id;

    perform public.registrar_actividad('validacion', 'Entrada validada',
      'Butaca ' || v_butaca || ' · ' || public.texto_funcion(v_funcion));
  end if;
  return new;
end;
$$;

drop trigger if exists log_entrada_validada on public.orden_butacas;
create trigger log_entrada_validada
  after update of validada_en on public.orden_butacas
  for each row execute function public.log_entrada_validada();


create or replace function public.log_candy_entregado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.retirado_en is null and new.retirado_en is not null then
    perform public.registrar_actividad('validacion', 'Candy bar entregado',
      new.cantidad || 'x ' || new.nombre || ' · orden ' || left(new.orden_id::text, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists log_candy_entregado on public.orden_productos;
create trigger log_candy_entregado
  after update of retirado_en on public.orden_productos
  for each row execute function public.log_candy_entregado();
