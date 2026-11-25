-- Migracion 031 - Lista de espera para funciones agotadas
--
-- "Cuando una funcion se queda sin butacas, los usuarios registrados deben
-- poder anotarse en una lista de espera. Si alguien cancela su compra y se
-- liberan butacas, el sistema tiene que avisar automaticamente al primero de
-- la lista, que va a tener 15 minutos para comprar antes de que la butaca
-- pase al siguiente. El usuario debe poder ver en su perfil en que listas de
-- espera esta anotado y en que posicion. Desde el admin quiero ver cuanta
-- gente hay en espera por funcion." (ultimo mail del cliente)
--
-- Requiere las migraciones 024, 029 y 030.
--
-- Como funciona:
--   - El usuario se anota con la cantidad de butacas que quiere (1 a 6, S-23).
--   - Cuando se liberan butacas, avanzar_lista_espera() le reserva CUPO al
--     primero de la lista: "avisado" + vence_en = ahora + 15 minutos, y le manda
--     una notificacion. Se reserva una cantidad de butacas, no una butaca
--     puntual: mientras dure la reserva, nadie mas puede comprar esas butacas
--     (lo controla un trigger sobre orden_butacas); quien la tiene compra
--     cualquier butaca libre.
--   - La reserva vence por hora: una reserva con vence_en pasado simplemente
--     no cuenta, asi que la regla no depende de ningun proceso. Lo unico que
--     necesita un proceso es AVISARLE AL SIGUIENTE cuando vence: eso lo hace
--     pg_cron cada minuto (ver el final del archivo).
--   - Si el usuario compra, su anotacion pasa a "comprada".


-- ---------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------
create table if not exists public.lista_espera (
  id          uuid primary key default gen_random_uuid(),
  funcion_id  uuid not null references public.funciones(id) on delete cascade,
  usuario_id  uuid not null references public.profiles(id) on delete cascade,
  cantidad    int not null check (cantidad between 1 and 6),
  estado      text not null default 'esperando'
              check (estado in ('esperando', 'avisado', 'comprada', 'vencida', 'cancelada')),
  avisado_en  timestamptz,
  vence_en    timestamptz,
  created_at  timestamptz not null default now()
);

-- una sola anotacion activa por usuario y funcion
create unique index if not exists lista_espera_activa_idx
  on public.lista_espera (funcion_id, usuario_id)
  where estado in ('esperando', 'avisado');

create index if not exists lista_espera_funcion_idx
  on public.lista_espera (funcion_id, created_at);

alter table public.lista_espera enable row level security;

-- el usuario ve las suyas; el administrador ve todas (para contar la gente en
-- espera de cada funcion). Nadie escribe directo: se usan las funciones de abajo.
drop policy if exists "ver lista de espera" on public.lista_espera;
create policy "ver lista de espera"
  on public.lista_espera for select to authenticated
  using (auth.uid() = usuario_id or public.tiene_rol(array['administrador']));


-- ---------------------------------------------------------------------
-- Funciones internas (nadie las llama desde la app)
-- ---------------------------------------------------------------------

-- butacas de la sala que no estan vendidas en esta funcion
create or replace function public.butacas_libres_funcion(p_funcion_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*) from public.butacas b
    join public.funciones f on f.sala_id = b.sala_id
    where f.id = p_funcion_id
  )::int - (
    select count(*) from public.orden_butacas
    where funcion_id = p_funcion_id and not cancelada
  )::int;
$$;

-- butacas reservadas ahora mismo para la lista de espera (reservas que no
-- vencieron), sin contar las de un usuario
create or replace function public.cupo_reservado(p_funcion_id uuid, p_excepto uuid default null)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cantidad), 0)::int
  from public.lista_espera
  where funcion_id = p_funcion_id
    and estado = 'avisado'
    and vence_en > now()
    and (p_excepto is null or usuario_id <> p_excepto);
$$;

-- Vence las reservas pasadas y, si hay butacas libres sin reservar, se las
-- ofrece a los siguientes de la lista, en orden de llegada.
create or replace function public.avanzar_lista_espera(p_funcion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funcion      public.funciones;
  v_pelicula     text;
  v_entrada      public.lista_espera;
  v_disponibles  int;
  v_asignar      int;
begin
  select * into v_funcion from public.funciones where id = p_funcion_id;
  if v_funcion.id is null then
    return;
  end if;

  update public.lista_espera
  set estado = 'vencida'
  where funcion_id = p_funcion_id and estado = 'avisado' and vence_en <= now();

  -- si la funcion se cancelo o ya empezo, la espera ya no sirve
  if v_funcion.cancelada_en is not null or now() >= v_funcion.inicio then
    update public.lista_espera
    set estado = 'vencida'
    where funcion_id = p_funcion_id and estado in ('esperando', 'avisado');
    return;
  end if;

  select nombre into v_pelicula from public.peliculas where id = v_funcion.pelicula_id;

  loop
    v_disponibles := public.butacas_libres_funcion(p_funcion_id) - public.cupo_reservado(p_funcion_id);
    exit when v_disponibles < 1;

    select * into v_entrada
    from public.lista_espera
    where funcion_id = p_funcion_id and estado = 'esperando'
    order by created_at
    limit 1
    for update;
    exit when v_entrada.id is null;

    v_asignar := least(v_entrada.cantidad, v_disponibles);

    update public.lista_espera
    set estado = 'avisado',
        cantidad = v_asignar,
        avisado_en = now(),
        vence_en = now() + interval '15 minutes'
    where id = v_entrada.id;

    perform public.notificar(
      v_entrada.usuario_id,
      'Se liberaron butacas',
      'Hay ' || v_asignar || case when v_asignar = 1 then ' butaca disponible' else ' butacas disponibles' end
        || ' para ' || v_pelicula || ' del ' || public.fecha_funcion_texto(v_funcion.inicio)
        || '. Tenés 15 minutos para comprarla' || case when v_asignar = 1 then '.' else 's.' end,
      '/funcion/' || p_funcion_id
    );
  end loop;
end;
$$;

revoke execute on function public.butacas_libres_funcion(uuid) from public, anon, authenticated;
revoke execute on function public.cupo_reservado(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.avanzar_lista_espera(uuid) from public, anon, authenticated;

-- Lo corre pg_cron cada minuto: pasa la reserva al siguiente cuando vence
create or replace function public.vencer_reservas_lista_espera()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funcion uuid;
begin
  for v_funcion in
    select distinct funcion_id from public.lista_espera where estado in ('esperando', 'avisado')
  loop
    perform public.avanzar_lista_espera(v_funcion);
  end loop;
end;
$$;

revoke execute on function public.vencer_reservas_lista_espera() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- 1. Se libera una butaca (cancelacion de una compra) -> se avisa al primero
create or replace function public.al_liberarse_butaca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cancelada and not old.cancelada then
    perform public.avanzar_lista_espera(new.funcion_id);
  end if;
  return new;
end;
$$;

drop trigger if exists al_liberarse_butaca on public.orden_butacas;
create trigger al_liberarse_butaca
  after update of cancelada on public.orden_butacas
  for each row execute function public.al_liberarse_butaca();

-- 2. Nadie puede comprar las butacas reservadas para la lista de espera
create or replace function public.respetar_lista_espera()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario   uuid;
  v_reservado int;
begin
  select usuario_id into v_usuario from public.ordenes where id = new.orden_id;

  -- lo que tiene reservado el propio comprador no cuenta contra el
  v_reservado := public.cupo_reservado(new.funcion_id, v_usuario);

  -- la fila nueva todavia no esta insertada: al insertarla quedan libres - 1
  if v_reservado > 0 and public.butacas_libres_funcion(new.funcion_id) - 1 < v_reservado then
    raise exception 'Las butacas que se liberaron están reservadas por 15 minutos para la lista de espera';
  end if;
  return new;
end;
$$;

drop trigger if exists respetar_lista_espera on public.orden_butacas;
create trigger respetar_lista_espera
  before insert on public.orden_butacas
  for each row execute function public.respetar_lista_espera();

-- 3. Si el usuario compra para esa funcion, su anotacion termina
create or replace function public.cerrar_espera_al_comprar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.usuario_id is not null and new.funcion_id is not null then
    update public.lista_espera
    set estado = 'comprada'
    where funcion_id = new.funcion_id
      and usuario_id = new.usuario_id
      and estado in ('esperando', 'avisado');
  end if;
  return new;
end;
$$;

drop trigger if exists cerrar_espera_al_comprar on public.ordenes;
create trigger cerrar_espera_al_comprar
  after insert on public.ordenes
  for each row execute function public.cerrar_espera_al_comprar();


-- ---------------------------------------------------------------------
-- Funciones que usa la app (solo usuarios con sesion)
-- ---------------------------------------------------------------------

-- Anotarse: solo clientes, solo si la funcion esta agotada
create or replace function public.anotarse_lista_espera(p_funcion_id uuid, p_cantidad int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funcion  public.funciones;
  v_id       uuid;
begin
  if auth.uid() is null or not public.tiene_rol(array['cliente']) then
    raise exception 'Solo los clientes registrados pueden anotarse en la lista de espera';
  end if;

  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 6 then
    raise exception 'Podés pedir entre 1 y 6 butacas';
  end if;

  select * into v_funcion from public.funciones where id = p_funcion_id;
  if v_funcion.id is null then
    raise exception 'La función no existe';
  end if;
  if v_funcion.cancelada_en is not null then
    raise exception 'Esta función fue cancelada por el cine';
  end if;
  if now() >= v_funcion.inicio then
    raise exception 'La función ya empezó';
  end if;

  if public.butacas_libres_funcion(p_funcion_id) - public.cupo_reservado(p_funcion_id) >= 1 then
    raise exception 'Todavía hay butacas disponibles: podés comprarlas directamente';
  end if;

  begin
    insert into public.lista_espera (funcion_id, usuario_id, cantidad)
    values (p_funcion_id, auth.uid(), p_cantidad)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya estás anotado en la lista de espera de esta función';
  end;

  return json_build_object('id', v_id);
end;
$$;

-- Mis listas de espera, con la posicion de cada una
create or replace function public.mis_listas_espera()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(fila order by (fila->>'inicio')), '[]'::json)
  from (
    select json_build_object(
      'id', l.id,
      'funcionId', l.funcion_id,
      'pelicula', p.nombre,
      'sala', s.nombre,
      'inicio', f.inicio,
      'cantidad', l.cantidad,
      'estado', l.estado,
      'venceEn', l.vence_en,
      'posicion', (
        select count(*) from public.lista_espera x
        where x.funcion_id = l.funcion_id
          and (x.estado = 'esperando' or (x.estado = 'avisado' and x.vence_en > now()))
          and x.created_at <= l.created_at
      )
    ) as fila
    from public.lista_espera l
    join public.funciones f on f.id = l.funcion_id
    join public.peliculas p on p.id = f.pelicula_id
    join public.salas s on s.id = f.sala_id
    where l.usuario_id = auth.uid()
      and (l.estado = 'esperando' or (l.estado = 'avisado' and l.vence_en > now()))
  ) t;
$$;

-- Salirse de la lista. Si tenia una reserva, se la pasa al siguiente.
create or replace function public.salir_lista_espera(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funcion uuid;
begin
  update public.lista_espera
  set estado = 'cancelada'
  where id = p_id and usuario_id = auth.uid() and estado in ('esperando', 'avisado')
  returning funcion_id into v_funcion;

  if v_funcion is not null then
    perform public.avanzar_lista_espera(v_funcion);
  end if;
end;
$$;

revoke execute on function public.anotarse_lista_espera(uuid, int) from public, anon;
revoke execute on function public.mis_listas_espera() from public, anon;
revoke execute on function public.salir_lista_espera(uuid) from public, anon;
grant  execute on function public.anotarse_lista_espera(uuid, int) to authenticated;
grant  execute on function public.mis_listas_espera() to authenticated;
grant  execute on function public.salir_lista_espera(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- Aviso de estreno por fecha (completa la 029)
--
-- La 029 avisaba solo cuando el admin cambiaba el estado de la pelicula. Pero
-- una pelicula "Proximamente" tambien se vuelve visible sola al llegar su fecha
-- de estreno. avisar_estrenos() cubre los dos casos, y alertas_estreno.avisada_en
-- evita avisar dos veces.
-- ---------------------------------------------------------------------
alter table public.alertas_estreno
  add column if not exists avisada_en timestamptz;

-- las alertas de peliculas que ya estan en cartelera no deben avisar ahora
update public.alertas_estreno a
set avisada_en = now()
from public.peliculas p
where p.id = a.pelicula_id
  and a.avisada_en is null
  and (p.estado = 'en_cartelera' or (p.estado = 'proximamente' and p.fecha_estreno <= current_date));

create or replace function public.avisar_estrenos()
returns void
language sql
security definer
set search_path = public
as $$
  with avisar as (
    update public.alertas_estreno a
    set avisada_en = now()
    from public.peliculas p
    where p.id = a.pelicula_id
      and a.avisada_en is null
      and (p.estado = 'en_cartelera' or (p.estado = 'proximamente' and p.fecha_estreno <= current_date))
    returning a.usuario_id, p.id as pelicula_id, p.nombre
  )
  insert into public.notificaciones (usuario_id, titulo, mensaje, enlace)
  select usuario_id, 'Ya podés sacar tus entradas', nombre || ' ya está en cartelera.', '/pelicula/' || pelicula_id
  from avisar;
$$;

revoke execute on function public.avisar_estrenos() from public, anon, authenticated;

-- el trigger de la 029 ahora usa la misma funcion
create or replace function public.avisar_estreno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.avisar_estrenos();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- pg_cron: una vez por minuto pasa las reservas vencidas al siguiente de la
-- lista y avisa los estrenos que llegaron por fecha.
--
-- Hay que activar la extension antes: Supabase > Database > Extensions >
-- pg_cron. Si no esta activa, este bloque avisa y no hace nada; despues de
-- activarla se puede volver a correr solo este bloque.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cine-moran-cada-minuto',
      '* * * * *',
      'select public.vencer_reservas_lista_espera(); select public.avisar_estrenos();'
    );
  else
    raise notice 'pg_cron no esta activo: activalo en Database > Extensions y volve a correr este bloque';
  end if;
end;
$$;
