-- Migracion 006 - Solo puede dejar resena quien ya vio la pelicula
--
-- Requiere las migraciones 004 y 005 ya aplicadas (usan las tablas de ordenes).
--
-- El mail del cliente dice que las resenas se tienen que poder VER antes de
-- comprar (para que sirvan de guia a otros usuarios) -- eso no dice nada sobre
-- quien puede ESCRIBIR una. Sin este chequeo, cualquiera podia calificar una
-- pelicula sin haberla visto nunca. Ahora hace falta tener una orden
-- confirmada con una butaca en una funcion de esa pelicula, y que esa funcion
-- ya haya pasado (si es a futuro, todavia no la vio).

-- Se usa una funcion (en vez de un exists directo en la policy) porque
-- orden_butacas no tiene policy de lectura para usuarios comunes: un exists
-- comun ahi adentro se hubiera rechazado solo, incluso para quien si compro.
-- security definer evita ese problema, igual que tiene_rol().
create or replace function public.usuario_vio_pelicula(p_pelicula_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ordenes o
    join public.orden_butacas ob on ob.orden_id = o.id
    join public.funciones f on f.id = ob.funcion_id
    where o.usuario_id = auth.uid()
      and o.estado = 'confirmada'
      and f.pelicula_id = p_pelicula_id
      and f.inicio <= now()
  );
$$;

revoke execute on function public.usuario_vio_pelicula(uuid) from public, anon;
grant  execute on function public.usuario_vio_pelicula(uuid) to authenticated;

drop policy if exists "usuario crea su propia resena" on public.resenas;

create policy "usuario crea su propia resena"
  on public.resenas for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and public.usuario_vio_pelicula(pelicula_id)
  );

-- Ademas: que un usuario vea el detalle de sus propias compras (util para
-- "usuario_vio_pelicula" de arriba y para un futuro historial de compras).
drop policy if exists "usuario ve butacas de sus propias ordenes" on public.orden_butacas;
create policy "usuario ve butacas de sus propias ordenes"
  on public.orden_butacas for select to authenticated
  using (
    exists (
      select 1 from public.ordenes o
      where o.id = orden_butacas.orden_id and o.usuario_id = auth.uid()
    )
  );
