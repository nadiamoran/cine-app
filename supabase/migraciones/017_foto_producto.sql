-- Migracion 017 - Foto de los productos del candy bar
--
-- Requiere las migraciones 011 y 016 ya aplicadas (la 016 crea el bucket
-- "candy", donde tambien se guardan estas fotos, en la carpeta productos/).

alter table public.productos
  add column if not exists imagen_url text;
