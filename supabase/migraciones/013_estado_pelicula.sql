-- Migracion 013 - Estado de la pelicula: en cartelera, proximamente o baja
--
-- Reemplaza la logica de "visible_home" + "fecha_estreno en el futuro" por un
-- estado explicito que elige el administrador.

alter table public.peliculas
  add column if not exists estado text not null default 'en_cartelera'
  check (estado in ('en_cartelera', 'proximamente', 'baja'));

-- paso las peliculas existentes al estado que les corresponde segun los datos viejos
update public.peliculas set estado = 'baja' where visible_home = false;
update public.peliculas set estado = 'proximamente'
  where visible_home = true and fecha_estreno > current_date;
