-- =====================================================================
-- Migracion 002 - Solo el administrador sube afiches al bucket "peliculas"
--
-- Requiere haber ejecutado antes la migracion 001 (usa public.tiene_rol).
--
-- PROBLEMA: la politica "autenticado sube imagenes peliculas" deja que
-- CUALQUIER usuario logueado (un cliente comun) suba archivos al bucket.
-- Sin limite de cantidad ni de tipo, sirve para llenar el almacenamiento.
--
-- La lectura publica se mantiene: los afiches tienen que verse en la web
-- sin iniciar sesion.
-- =====================================================================

drop policy if exists "autenticado sube imagenes peliculas" on storage.objects;
drop policy if exists "administrador sube imagenes peliculas" on storage.objects;

create policy "administrador sube imagenes peliculas"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'peliculas'
    and public.tiene_rol(array['administrador'])
  );

-- Para poder reemplazar o borrar un afiche mas adelante (solo administrador)
drop policy if exists "administrador gestiona imagenes peliculas" on storage.objects;
create policy "administrador gestiona imagenes peliculas"
  on storage.objects for update to authenticated
  using      (bucket_id = 'peliculas' and public.tiene_rol(array['administrador']))
  with check (bucket_id = 'peliculas' and public.tiene_rol(array['administrador']));

drop policy if exists "administrador borra imagenes peliculas" on storage.objects;
create policy "administrador borra imagenes peliculas"
  on storage.objects for delete to authenticated
  using (bucket_id = 'peliculas' and public.tiene_rol(array['administrador']));
