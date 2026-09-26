-- =====================================================================
-- CineMoran - esquema ACTUAL de la base (Supabase / PostgreSQL)
--
-- Reconstruido el 2026-09-26 a partir de information_schema, pg_constraint
-- y pg_policies del proyecto del cine. Refleja lo que hay HOY en Supabase.
-- Los cambios posteriores viven en supabase/migraciones/ (uno por archivo,
-- numerados). Este archivo se actualiza cuando se aplica cada migracion.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: datos del usuario registrado (1 a 1 con auth.users)
-- El email y la contrasena viven en auth.users (los maneja Supabase Auth).
-- ---------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  nombre            text not null,
  apellido          text not null,
  fecha_nacimiento  date not null,
  tipo_sangre       text,
  color_ojos        text,
  dias_vacaciones   integer default 0,
  created_at        timestamptz default now(),
  rol               text not null default 'cliente'
                    check (rol in ('cliente', 'empleado', 'administrador'))
);

-- ---------------------------------------------------------------------
-- peliculas
-- ---------------------------------------------------------------------
create table public.peliculas (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  imagen_url        text,
  sinopsis          text,
  duracion_minutos  integer not null,
  generos           text[] not null default '{}',
  restriccion_edad  text not null default 'sin_restriccion'
                    check (restriccion_edad in ('sin_restriccion', '+13', '+18')),
  visible_home      boolean not null default true,
  ventas            integer not null default 0,
  created_at        timestamptz default now(),
  fecha_estreno     date
);

-- ---------------------------------------------------------------------
-- resenas: una por usuario y pelicula
-- ---------------------------------------------------------------------
create table public.resenas (
  id           uuid primary key default gen_random_uuid(),
  pelicula_id  uuid not null references public.peliculas(id) on delete cascade,
  usuario_id   uuid not null references public.profiles(id) on delete cascade,
  estrellas    integer not null check (estrellas between 1 and 5),
  comentario   text,
  created_at   timestamptz default now(),
  unique (pelicula_id, usuario_id)
);

-- ---------------------------------------------------------------------
-- alertas_estreno: el usuario pide aviso cuando salga la venta
-- ---------------------------------------------------------------------
create table public.alertas_estreno (
  id           uuid primary key default gen_random_uuid(),
  pelicula_id  uuid not null references public.peliculas(id) on delete cascade,
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (pelicula_id, usuario_id)
);

-- ---------------------------------------------------------------------
-- Row Level Security (todas las tablas la tienen activada)
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.peliculas       enable row level security;
alter table public.resenas         enable row level security;
alter table public.alertas_estreno enable row level security;

-- profiles
create policy "usuario ve su propio perfil"
  on public.profiles for select to public using (auth.uid() = id);
create policy "usuario inserta su propio perfil"
  on public.profiles for insert to public with check (auth.uid() = id);
create policy "usuario actualiza su propio perfil"
  on public.profiles for update to public using (auth.uid() = id);

-- peliculas
create policy "catalogo publico"
  on public.peliculas for select to public using (true);
create policy "administrador crea peliculas"
  on public.peliculas for insert to authenticated
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.rol = 'administrador'
  ));

-- resenas
create policy "resenas publicas"
  on public.resenas for select to public using (true);
create policy "usuario crea su propia resena"
  on public.resenas for insert to public with check (auth.uid() = usuario_id);

-- alertas_estreno
create policy "usuario ve sus propias alertas"
  on public.alertas_estreno for select to public using (auth.uid() = usuario_id);
create policy "usuario crea su propia alerta"
  on public.alertas_estreno for insert to public with check (auth.uid() = usuario_id);
create policy "usuario borra su propia alerta"
  on public.alertas_estreno for delete to public using (auth.uid() = usuario_id);

-- ---------------------------------------------------------------------
-- Storage: bucket publico para los afiches de las peliculas
-- (las politicas de storage.objects no estan reconstruidas aca)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('peliculas', 'peliculas', true)
on conflict (id) do nothing;
