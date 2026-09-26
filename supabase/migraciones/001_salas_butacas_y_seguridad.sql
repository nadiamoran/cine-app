-- =====================================================================
-- Migracion 001 - Salas y butacas + correccion de seguridad
--
-- Se ejecuta UNA vez en Supabase > SQL Editor. Es re-ejecutable: usa
-- "if not exists" / "drop ... if exists" / "create or replace".
--
-- Contenido:
--   1. Funcion auxiliar tiene_rol()
--   2. Seguridad: nadie puede cambiarse el rol a si mismo (RNF-08)
--   3. Administrador puede editar y borrar peliculas
--   4. Tablas salas y butacas + funcion crear_sala() (RF-13, 14, 15)
--   5. Salas de ejemplo
--   6. Vista para mostrar el nombre del autor de cada resena
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Funcion auxiliar: "el usuario logueado tiene alguno de estos roles?"
--    security definer: lee profiles con permisos del duenio de la funcion,
--    asi las politicas de otras tablas la pueden usar sin depender de las
--    politicas de profiles (y sin riesgo de recursion infinita).
-- ---------------------------------------------------------------------
create or replace function public.tiene_rol(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = any (roles)
  );
$$;

revoke execute on function public.tiene_rol(text[]) from public, anon;
grant  execute on function public.tiene_rol(text[]) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Seguridad en profiles
--
--    PROBLEMA: la politica "usuario actualiza su propio perfil" no limita
--    QUE columnas se pueden cambiar. Cualquiera con la clave publica de la
--    app podia hacer  update profiles set rol = 'administrador'  sobre su
--    propia fila (lo mismo al insertar su perfil).
--
--    SOLUCION: permisos por columna. Se le quita al cliente el permiso de
--    escribir "rol"; queda en su valor por defecto ('cliente'). Los roles
--    'empleado' y 'administrador' se asignan desde el SQL Editor (o una
--    funcion de admin mas adelante).
-- ---------------------------------------------------------------------
revoke insert, update on public.profiles from anon, authenticated;

grant insert (id, nombre, apellido, fecha_nacimiento, tipo_sangre, color_ojos, dias_vacaciones)
  on public.profiles to authenticated;

grant update (nombre, apellido, fecha_nacimiento, tipo_sangre, color_ojos, dias_vacaciones)
  on public.profiles to authenticated;


-- ---------------------------------------------------------------------
-- 3. Peliculas: el administrador tambien puede editar y borrar
--    (con RLS activado y sin politica, esas operaciones estaban bloqueadas)
-- ---------------------------------------------------------------------
drop policy if exists "administrador actualiza peliculas" on public.peliculas;
create policy "administrador actualiza peliculas"
  on public.peliculas for update to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

drop policy if exists "administrador borra peliculas" on public.peliculas;
create policy "administrador borra peliculas"
  on public.peliculas for delete to authenticated
  using (public.tiene_rol(array['administrador']));


-- ---------------------------------------------------------------------
-- 4. Salas y butacas
--
--    Forma de cada sala (mails del 01/01 y 12/02):
--      - Filas A a T, SIN la K  -> 19 filas
--      - Fila J: accesible, bloques de 2 / 10 / 2 butacas      (RF-14)
--      - Filas R, S, T: VIP                                    (RF-15)
--      - Resto: estandar, bloques de 4 / 20 / 4 butacas        (RF-13)
--    "columna" es el bloque (1, 2 o 3); "numero" cuenta de corrido en la
--    fila (1 a 28 en filas normales, 1 a 14 en la accesible).
-- ---------------------------------------------------------------------
create table if not exists public.salas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.butacas (
  id       uuid primary key default gen_random_uuid(),
  sala_id  uuid not null references public.salas(id) on delete cascade,
  fila     text not null check (fila ~ '^[A-T]$'),
  columna  smallint not null check (columna between 1 and 3),
  numero   smallint not null check (numero >= 1),
  tipo     text not null default 'estandar'
           check (tipo in ('estandar', 'vip', 'accesible')),
  unique (sala_id, fila, numero)
);

create index if not exists butacas_sala_idx on public.butacas (sala_id);

alter table public.salas   enable row level security;
alter table public.butacas enable row level security;

-- cualquiera puede ver las salas y el mapa; solo el administrador las modifica
drop policy if exists "salas publicas" on public.salas;
create policy "salas publicas" on public.salas for select to public using (true);

drop policy if exists "butacas publicas" on public.butacas;
create policy "butacas publicas" on public.butacas for select to public using (true);

drop policy if exists "administrador gestiona salas" on public.salas;
create policy "administrador gestiona salas"
  on public.salas for all to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

drop policy if exists "administrador gestiona butacas" on public.butacas;
create policy "administrador gestiona butacas"
  on public.butacas for all to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

-- Crea una sala con todas sus butacas segun las reglas de arriba.
-- Devuelve el id de la sala nueva.
create or replace function public.crear_sala(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala     uuid;
  v_fila     text;
  v_bloques  int[];
  v_tipo     text;
  v_col      int;
  v_numero   int;
  i          int;
begin
  -- desde la app solo el administrador; desde el SQL Editor (auth.uid() nulo) se permite
  if auth.uid() is not null and not public.tiene_rol(array['administrador']) then
    raise exception 'Solo un administrador puede crear salas';
  end if;

  insert into public.salas (nombre) values (p_nombre) returning id into v_sala;

  foreach v_fila in array array['A','B','C','D','E','F','G','H','I','J',
                                'L','M','N','O','P','Q','R','S','T']
  loop
    v_bloques := case when v_fila = 'J' then array[2, 10, 2] else array[4, 20, 4] end;
    v_tipo    := case
                   when v_fila = 'J'                then 'accesible'
                   when v_fila in ('R', 'S', 'T')   then 'vip'
                   else 'estandar'
                 end;
    v_numero := 0;

    for v_col in 1..3 loop
      for i in 1..v_bloques[v_col] loop
        v_numero := v_numero + 1;
        insert into public.butacas (sala_id, fila, columna, numero, tipo)
        values (v_sala, v_fila, v_col, v_numero, v_tipo);
      end loop;
    end loop;
  end loop;

  return v_sala;
end;
$$;

revoke execute on function public.crear_sala(text) from public, anon;
grant  execute on function public.crear_sala(text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Salas de ejemplo (cambiar la cantidad o los nombres si hace falta)
--    Solo se crean si todavia no existen, asi se puede re-ejecutar.
-- ---------------------------------------------------------------------
select public.crear_sala('Sala 1') where not exists (select 1 from public.salas where nombre = 'Sala 1');
select public.crear_sala('Sala 2') where not exists (select 1 from public.salas where nombre = 'Sala 2');
select public.crear_sala('Sala 3') where not exists (select 1 from public.salas where nombre = 'Sala 3');


-- ---------------------------------------------------------------------
-- 6. Nombre del autor de cada resena
--
--    PROBLEMA: resenas se lee con  select('*, profiles(nombre)')  pero
--    profiles solo deja ver la fila propia, asi que el nombre de los demas
--    usuarios llega vacio. Abrir profiles a todos expondria tipo de sangre,
--    color de ojos, etc.
--
--    SOLUCION: una vista que expone SOLO el nombre. Las vistas se ejecutan
--    con los permisos de su duenio, por eso pueden leer profiles.
--    (El linter de Supabase la marca como "Security Definer View": es
--    esperado, expone unicamente id de resena y nombre.)
-- ---------------------------------------------------------------------
create or replace view public.resenas_con_autor as
  select r.id,
         r.pelicula_id,
         r.usuario_id,
         r.estrellas,
         r.comentario,
         r.created_at,
         p.nombre as nombre_usuario
  from public.resenas r
  join public.profiles p on p.id = r.usuario_id;

grant select on public.resenas_con_autor to anon, authenticated;
