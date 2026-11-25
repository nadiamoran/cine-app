-- Migracion 030 - Cancelacion de una funcion por parte del cine
--
-- "A veces tenemos problemas tecnicos en una sala y necesitamos suspender una
-- funcion. Desde el admin debe poder cancelarse una funcion completa: todas
-- las entradas vendidas pasan a credito en la cuenta de cada usuario (el
-- monto total, incluyendo el candy si lo hubiera), las butacas se liberan, y
-- cada comprador afectado recibe una notificacion. Ademas, al usuario se le
-- debe ofrecer reubicarse en otra funcion de la misma pelicula usando su
-- credito. Todo esto tiene que pasar de forma atomica: o se acredita a todos
-- o a nadie." (ultimo mail del cliente)
--
-- Requiere las migraciones 022, 024, 025, 026 y 029.
--
-- Decisiones:
--   - cancelar_funcion es una sola funcion plpgsql, y toda funcion corre en
--     una transaccion: si algo falla a mitad de camino, no se acredita a nadie.
--   - Se acredita el total de cada compra (entradas + candy + lo pagado con
--     credito), igual que cancelar_orden, y se revierten los puntos ganados y
--     se devuelven los canjeados. No importa si ya habia entradas validadas:
--     la funcion se suspendio.
--   - Solo se acredita a los usuarios registrados (S-21). Las compras
--     anonimas se cancelan igual (las butacas se liberan), pero no tienen
--     cuenta donde acreditar.
--   - La funcion no se borra: queda marcada con cancelada_en. Su horario sigue
--     ocupando la sala (el problema tecnico es de esa sala) y no se puede editar.
--   - Para reubicarse, la notificacion lleva a la pagina de la pelicula: el
--     credito se usa al pagar, como siempre (RF-28).


alter table public.funciones
  add column if not exists cancelada_en timestamptz;


-- ---------------------------------------------------------------------
-- No se puede comprar para una funcion cancelada. Se controla con un trigger
-- sobre ordenes (en vez de tocar crear_orden, que ya tiene muchas versiones):
-- cualquier compra que apunte a una funcion cancelada se rechaza.
-- ---------------------------------------------------------------------
create or replace function public.rechazar_compra_funcion_cancelada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.funcion_id is not null and exists (
    select 1 from public.funciones where id = new.funcion_id and cancelada_en is not null
  ) then
    raise exception 'Esta función fue cancelada por el cine';
  end if;
  return new;
end;
$$;

drop trigger if exists rechazar_compra_funcion_cancelada on public.ordenes;
create trigger rechazar_compra_funcion_cancelada
  before insert on public.ordenes
  for each row execute function public.rechazar_compra_funcion_cancelada();


-- ---------------------------------------------------------------------
-- Una funcion cancelada no se edita (ni de pelicula, ni de horario, ni de
-- sala). Solo se miran esas columnas: el precio puede cambiar si se
-- actualiza la tabla de precios, y eso no debe fallar.
-- ---------------------------------------------------------------------
create or replace function public.bloquear_edicion_funcion_cancelada()
returns trigger
language plpgsql
as $$
begin
  if old.cancelada_en is not null
     and (new.pelicula_id, new.inicio, new.formato, new.idioma, new.sala_id)
         is distinct from (old.pelicula_id, old.inicio, old.formato, old.idioma, old.sala_id) then
    raise exception 'La función está cancelada y no se puede modificar';
  end if;
  return new;
end;
$$;

drop trigger if exists bloquear_edicion_funcion_cancelada on public.funciones;
create trigger bloquear_edicion_funcion_cancelada
  before update on public.funciones
  for each row execute function public.bloquear_edicion_funcion_cancelada();


-- ---------------------------------------------------------------------
-- Cancelar la funcion completa (solo el administrador)
-- ---------------------------------------------------------------------
create or replace function public.cancelar_funcion(p_funcion_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funcion    public.funciones;
  v_orden      public.ordenes;
  v_pelicula   text;
  v_compras    int := 0;
  v_credito    numeric := 0;
  v_sin_cuenta int := 0;
  v_mensaje    text;
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo el administrador puede cancelar una función';
  end if;

  -- for update: dos cancelaciones simultaneas de la misma funcion no pueden
  -- acreditar dos veces
  select * into v_funcion from public.funciones where id = p_funcion_id for update;

  if v_funcion.id is null then
    raise exception 'La función no existe';
  end if;
  if v_funcion.cancelada_en is not null then
    raise exception 'Esta función ya fue cancelada';
  end if;
  if now() > v_funcion.fin then
    raise exception 'La función ya terminó, no se puede cancelar';
  end if;

  select nombre into v_pelicula from public.peliculas where id = v_funcion.pelicula_id;

  update public.funciones set cancelada_en = now() where id = p_funcion_id;

  -- cada compra vigente de la funcion
  for v_orden in
    select * from public.ordenes
    where funcion_id = p_funcion_id and estado = 'confirmada'
    order by created_at
    for update
  loop
    -- libera las butacas (los triggers de la 019 y la 020 las liberan en
    -- tiempo real y restan las ventas de la pelicula)
    update public.orden_butacas set cancelada = true where orden_id = v_orden.id;
    update public.ordenes
    set estado = 'cancelada', cancelada_en = now()
    where id = v_orden.id;

    if v_orden.usuario_id is null then
      -- compra anonima: no hay cuenta donde acreditar
      v_sin_cuenta := v_sin_cuenta + 1;
    else
      -- igual que cancelar_orden: credito por el total, se sacan los puntos
      -- ganados y se devuelven los canjeados
      update public.profiles
      set credito = credito + v_orden.total,
          puntos  = greatest(puntos - v_orden.puntos_ganados, 0) + v_orden.puntos_usados
      where id = v_orden.usuario_id;

      if v_orden.total > 0 then
        insert into public.creditos_movimientos (usuario_id, orden_id, monto, motivo)
        values (v_orden.usuario_id, v_orden.id, v_orden.total, 'cancelacion');
      end if;

      if v_orden.puntos_ganados > 0 then
        insert into public.puntos_movimientos (usuario_id, orden_id, puntos, motivo, descripcion)
        values (v_orden.usuario_id, v_orden.id, -v_orden.puntos_ganados, 'cancelacion',
                'Función cancelada por el cine: se descuentan los puntos ganados');
      end if;

      if v_orden.puntos_usados > 0 then
        insert into public.puntos_movimientos (usuario_id, orden_id, puntos, motivo, descripcion)
        values (v_orden.usuario_id, v_orden.id, v_orden.puntos_usados, 'cancelacion',
                'Función cancelada por el cine: se devuelven los puntos canjeados');
      end if;

      v_mensaje := 'El cine canceló la función de ' || v_pelicula || ' del '
                   || public.fecha_funcion_texto(v_funcion.inicio) || '.';
      if v_orden.total > 0 then
        v_mensaje := v_mensaje || ' Te acreditamos $' || round(v_orden.total)::text
                     || ' en tu cuenta. Podés usarlo para elegir otra función de la misma película.';
      else
        v_mensaje := v_mensaje || ' Podés elegir otra función de la misma película.';
      end if;

      perform public.notificar(
        v_orden.usuario_id,
        'Función cancelada',
        v_mensaje,
        '/pelicula/' || v_funcion.pelicula_id
      );

      v_compras := v_compras + 1;
      v_credito := v_credito + v_orden.total;
    end if;
  end loop;

  perform public.registrar_actividad(
    'funcion',
    'Función cancelada',
    public.texto_funcion(v_funcion)
  );

  return json_build_object(
    'comprasAcreditadas', v_compras,
    'creditoTotal', v_credito,
    'comprasSinCuenta', v_sin_cuenta
  );
end;
$$;

revoke execute on function public.cancelar_funcion(uuid) from public, anon;
grant  execute on function public.cancelar_funcion(uuid) to authenticated;
