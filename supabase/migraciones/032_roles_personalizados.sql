-- Migracion 032 - Roles personalizados
--
-- "El sistema de roles es un poco acotado, nos gustaria poder tener roles que
-- permitan acceder a ciertas partes del administrador que podamos configurar.
-- Ejemplo: crear un rol que permita acceder solo a la parte de reportes, y
-- luego elegir al usuario que queremos darle dicho rol." (ultimo mail)
--
-- Requiere todas las migraciones anteriores (001 a 031).
--
-- Decision (S-24): se CONSERVAN los tres roles de siempre (cliente, empleado,
-- administrador) y los roles personalizados se SUMAN: un rol personalizado es
-- un nombre + una lista de permisos, y un usuario puede tener uno (columna
-- profiles.rol_id). Cada permiso corresponde a una seccion del panel de admin.
-- El administrador siempre tiene todos los permisos.
--
-- Como se aplican en la base (lo que importa: RNF-08):
--   1. tiene_permiso('reportes') = es administrador, o su rol personalizado
--      incluye ese permiso.
--   2. Politicas: las del administrador NO se tocan. Se AGREGAN politicas nuevas
--      para quien tenga el permiso. En Postgres las politicas permisivas se
--      suman (alcanza con que una deje pasar), asi que el administrador sigue
--      igual y el rol personalizado puede lo mismo, pero solo en su seccion.
--   3. Funciones con chequeo adentro (asignar_funcion, reportes, etc.): su
--      chequeo "es administrador" pasa a ser "es administrador o tiene el
--      permiso". Se hace sobre la definicion que ya existe, asi no se copian
--      los cuerpos y no se rompe ninguna version.
--   4. Quien asigna roles es solo el administrador (asignar_rol), y rol_id no
--      se puede escribir desde la app: nadie se da permisos a si mismo.


-- ---------------------------------------------------------------------
-- Roles personalizados
-- ---------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique check (length(trim(nombre)) > 0),
  permisos    text[] not null default '{}'
              check (permisos <@ array['peliculas', 'funciones', 'salas', 'productos', 'combos',
                                       'cupones', 'recompensas', 'reportes', 'actividad',
                                       'propuestas', 'validar']),
  created_at  timestamptz not null default now()
);

alter table public.roles enable row level security;

drop policy if exists "administrador gestiona roles" on public.roles;
create policy "administrador gestiona roles"
  on public.roles for all to authenticated
  using (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

-- rol_id no esta entre las columnas que el cliente puede escribir (la 001
-- solo le deja modificar sus datos personales), asi que solo cambia por asignar_rol
alter table public.profiles
  add column if not exists rol_id uuid references public.roles(id) on delete set null;


-- ---------------------------------------------------------------------
-- tiene_permiso(): el equivalente de tiene_rol() para las secciones
-- ---------------------------------------------------------------------
create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles pr
    left join public.roles r on r.id = pr.rol_id
    where pr.id = auth.uid()
      and (pr.rol = 'administrador' or p_permiso = any (coalesce(r.permisos, '{}')))
  );
$$;

revoke execute on function public.tiene_permiso(text) from public, anon;
grant  execute on function public.tiene_permiso(text) to authenticated;

-- permisos del usuario logueado, para que la app arme el menu y los guards
create or replace function public.mis_permisos()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when pr.rol = 'administrador' then
      array['peliculas', 'funciones', 'salas', 'productos', 'combos', 'cupones',
            'recompensas', 'reportes', 'actividad', 'propuestas', 'validar']
    else coalesce(r.permisos, '{}')
  end
  from public.profiles pr
  left join public.roles r on r.id = pr.rol_id
  where pr.id = auth.uid();
$$;

revoke execute on function public.mis_permisos() from public, anon;
grant  execute on function public.mis_permisos() to authenticated;


-- ---------------------------------------------------------------------
-- Asignar un rol a un usuario, y listar usuarios (solo administrador)
-- ---------------------------------------------------------------------
create or replace function public.asignar_rol(p_usuario_id uuid, p_rol_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo el administrador puede asignar roles';
  end if;

  if p_rol_id is not null and not exists (select 1 from public.roles where id = p_rol_id) then
    raise exception 'El rol no existe';
  end if;

  update public.profiles set rol_id = p_rol_id where id = p_usuario_id;
  if not found then
    raise exception 'El usuario no existe';
  end if;
end;
$$;

-- profiles solo deja ver la fila propia y el email esta en auth.users: el
-- administrador necesita esta funcion para ver a quien darle un rol
create or replace function public.listar_usuarios()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_rol(array['administrador']) then
    raise exception 'Solo el administrador puede ver los usuarios';
  end if;

  return (
    select coalesce(json_agg(json_build_object(
             'id', p.id,
             'nombre', p.nombre,
             'apellido', p.apellido,
             'email', u.email,
             'rol', p.rol,
             'rolId', p.rol_id
           ) order by p.apellido, p.nombre), '[]'::json)
    from public.profiles p
    join auth.users u on u.id = p.id
  );
end;
$$;

revoke execute on function public.asignar_rol(uuid, uuid) from public, anon;
revoke execute on function public.listar_usuarios() from public, anon;
grant  execute on function public.asignar_rol(uuid, uuid) to authenticated;
grant  execute on function public.listar_usuarios() to authenticated;


-- ---------------------------------------------------------------------
-- Politicas nuevas: se SUMAN a las del administrador
-- ---------------------------------------------------------------------

-- peliculas
drop policy if exists "permiso peliculas" on public.peliculas;
create policy "permiso peliculas" on public.peliculas for all to authenticated
  using (public.tiene_permiso('peliculas')) with check (public.tiene_permiso('peliculas'));

-- funciones: el administrador solo puede borrar directo (crear y editar pasan
-- por las funciones asignar_funcion / editar_funcion / programar_funciones)
drop policy if exists "permiso funciones" on public.funciones;
create policy "permiso funciones" on public.funciones for delete to authenticated
  using (public.tiene_permiso('funciones'));

-- para ver cuantas compras se acreditarian al cancelar una funcion
drop policy if exists "permiso funciones ve ordenes" on public.ordenes;
create policy "permiso funciones ve ordenes" on public.ordenes for select to authenticated
  using (public.tiene_permiso('funciones'));

-- y para contar la gente en lista de espera
drop policy if exists "permiso funciones ve espera" on public.lista_espera;
create policy "permiso funciones ve espera" on public.lista_espera for select to authenticated
  using (public.tiene_permiso('funciones'));

-- salas y butacas
drop policy if exists "permiso salas" on public.salas;
create policy "permiso salas" on public.salas for all to authenticated
  using (public.tiene_permiso('salas')) with check (public.tiene_permiso('salas'));

drop policy if exists "permiso salas butacas" on public.butacas;
create policy "permiso salas butacas" on public.butacas for all to authenticated
  using (public.tiene_permiso('salas')) with check (public.tiene_permiso('salas'));

-- candy bar
drop policy if exists "permiso productos categorias" on public.categorias_producto;
create policy "permiso productos categorias" on public.categorias_producto for all to authenticated
  using (public.tiene_permiso('productos')) with check (public.tiene_permiso('productos'));

drop policy if exists "permiso productos" on public.productos;
create policy "permiso productos" on public.productos for all to authenticated
  using (public.tiene_permiso('productos')) with check (public.tiene_permiso('productos'));

drop policy if exists "permiso combos" on public.combos;
create policy "permiso combos" on public.combos for all to authenticated
  using (public.tiene_permiso('combos')) with check (public.tiene_permiso('combos'));

drop policy if exists "permiso combos productos" on public.combo_productos;
create policy "permiso combos productos" on public.combo_productos for all to authenticated
  using (public.tiene_permiso('combos')) with check (public.tiene_permiso('combos'));

-- cupones y recompensas
drop policy if exists "permiso cupones" on public.cupones;
create policy "permiso cupones" on public.cupones for all to authenticated
  using (public.tiene_permiso('cupones')) with check (public.tiene_permiso('cupones'));

drop policy if exists "permiso recompensas" on public.recompensas;
create policy "permiso recompensas" on public.recompensas for all to authenticated
  using (public.tiene_permiso('recompensas')) with check (public.tiene_permiso('recompensas'));

-- log de actividad (solo lectura, como para el administrador)
drop policy if exists "permiso actividad" on public.activity_log;
create policy "permiso actividad" on public.activity_log for select to authenticated
  using (public.tiene_permiso('actividad'));

-- propuestas de peliculas: ver y resolver (el permiso para crear la pelicula
-- es otro: 'peliculas')
drop policy if exists "permiso propuestas ve" on public.propuestas_peliculas;
create policy "permiso propuestas ve" on public.propuestas_peliculas for select to authenticated
  using (public.tiene_permiso('propuestas'));

drop policy if exists "permiso propuestas resuelve" on public.propuestas_peliculas;
create policy "permiso propuestas resuelve" on public.propuestas_peliculas for update to authenticated
  using (public.tiene_permiso('propuestas')) with check (public.tiene_permiso('propuestas'));

-- imagenes (Storage)
drop policy if exists "permiso imagenes peliculas" on storage.objects;
create policy "permiso imagenes peliculas" on storage.objects for all to authenticated
  using (bucket_id = 'peliculas' and public.tiene_permiso('peliculas'))
  with check (bucket_id = 'peliculas' and public.tiene_permiso('peliculas'));

drop policy if exists "permiso imagenes candy" on storage.objects;
create policy "permiso imagenes candy" on storage.objects for all to authenticated
  using (bucket_id = 'candy' and (public.tiene_permiso('productos') or public.tiene_permiso('combos')))
  with check (bucket_id = 'candy' and (public.tiene_permiso('productos') or public.tiene_permiso('combos')));


-- ---------------------------------------------------------------------
-- Funciones con chequeo adentro: "es administrador" pasa a ser "es
-- administrador o tiene el permiso de esa seccion".
--
-- Se toma la definicion que ya esta en la base (pg_get_functiondef) y a cada
-- tiene_rol(array[...]) se le suma "OR tiene_permiso('seccion')". Si una
-- funcion ya fue modificada o no tiene el patron, se la saltea y avisa.
-- ---------------------------------------------------------------------
do $$
declare
  v_funcion  record;
  v_def      text;
  v_nueva    text;
  v_permisos jsonb := '{
    "asignar_funcion": "funciones",
    "editar_funcion": "funciones",
    "programar_funciones": "funciones",
    "cancelar_funcion": "funciones",
    "crear_sala": "salas",
    "guardar_precios_entrada": "salas",
    "reporte_facturacion": "reportes",
    "reporte_peliculas_mas_vistas": "reportes",
    "reporte_productos_mas_vendidos": "reportes",
    "validar_entrada": "validar",
    "retirar_candy": "validar"
  }';
begin
  for v_funcion in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (select jsonb_object_keys(v_permisos))
  loop
    v_def := pg_get_functiondef(v_funcion.oid);

    if v_def like '%tiene_permiso%' then
      raise notice '% ya tenia el permiso', v_funcion.proname;
      continue;
    end if;

    v_nueva := regexp_replace(
      v_def,
      '((public\.)?tiene_rol\(ARRAY\[[^\]]*\]\))',
      '(\1 OR public.tiene_permiso(''' || (v_permisos ->> v_funcion.proname) || '''))',
      'g'
    );

    if v_nueva = v_def then
      raise notice '% no tiene el patron esperado: no se modifico', v_funcion.proname;
    else
      execute v_nueva;
      raise notice '% actualizada', v_funcion.proname;
    end if;
  end loop;
end;
$$;
