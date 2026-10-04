-- Migracion 011 - Candy bar: productos, categorias y combos (RF-30, RF-33)
--
-- Requiere las migraciones 004, 007 y 009 ya aplicadas.

create table public.categorias_producto (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table public.productos (
  id           uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.categorias_producto(id),
  nombre       text not null,
  precio       numeric not null check (precio >= 0),
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.combos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  precio     numeric not null check (precio >= 0),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Que productos (y cuantos de cada uno) forman un combo. Ej: "Combo pareja"
-- = 2 pochoclos + 2 gaseosas.
create table public.combo_productos (
  combo_id    uuid not null references public.combos(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  cantidad    int not null default 1 check (cantidad > 0),
  primary key (combo_id, producto_id)
);

alter table public.categorias_producto enable row level security;
alter table public.productos           enable row level security;
alter table public.combos              enable row level security;
alter table public.combo_productos     enable row level security;

-- catalogo publico: cualquiera puede ver categorias, productos activos y combos activos
create policy "categorias publicas" on public.categorias_producto for select to public using (true);
create policy "productos publicos"  on public.productos           for select to public using (true);
create policy "combos publicos"     on public.combos               for select to public using (true);
create policy "combo_productos publico" on public.combo_productos for select to public using (true);

-- solo el administrador crea/edita el catalogo
create policy "administrador gestiona categorias" on public.categorias_producto
  for all to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

create policy "administrador gestiona productos" on public.productos
  for all to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

create policy "administrador gestiona combos" on public.combos
  for all to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

create policy "administrador gestiona combo_productos" on public.combo_productos
  for all to authenticated
  using      (public.tiene_rol(array['administrador']))
  with check (public.tiene_rol(array['administrador']));

-- categorias de ejemplo, solo si la tabla esta vacia
insert into public.categorias_producto (nombre)
select * from (values ('Pochoclos'), ('Bebidas'), ('Golosinas')) as v(nombre)
where not exists (select 1 from public.categorias_producto);
