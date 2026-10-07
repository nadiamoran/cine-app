# Permisos y roles de CineMoran — qué puede hacer cada uno y por qué

Guía para explicar (y defender) la lógica de permisos del proyecto. Para cada permiso hay: **qué es**, **por qué se decidió así** y **dónde se usa** en el código.

Rutas de código relativas a `cine-moran/src/app/`. Las migraciones están en `supabase/migraciones/`.

---

## 0. La idea central: tres capas, y la que manda es la base

El sistema tiene cuatro tipos de usuario (campo `rol` de la tabla `profiles`):

| Quién | Cómo se identifica | Resumen |
|---|---|---|
| **Visitante** | Sin sesión | Mira la cartelera y puede comprar sin registrarse. |
| **Cliente** | `rol = 'cliente'` (valor por defecto) | Todo lo del visitante + perfil, puntos, cupón, reseñas, alertas, historial. |
| **Empleado** | `rol = 'empleado'` | Solo valida entradas y retira candy. |
| **Administrador** | `rol = 'administrador'` | Administra el cine: películas, funciones, salas, productos, combos y cupones. |

Los permisos se aplican en **tres capas**, de la más débil a la más fuerte:

1. **Menú (UI):** el `nav` solo muestra los links que corresponden al rol. Es comodidad, no seguridad.
2. **Guards del router (Angular):** bloquean la navegación a pantallas que no corresponden. Tampoco es seguridad real: alguien con la clave pública podría saltarse el front.
3. **Base de datos (RLS + funciones `security definer`):** la regla verdadera. Aunque alguien manipule el front o llame a la API directo, la base rechaza lo que no le corresponde.

**Por qué así:** el front corre en el navegador del usuario, así que nunca es confiable. La validación del front existe para dar buena experiencia (no mostrar botones inútiles, avisar rápido). La **autoridad** está en Postgres. Esto cumple el requerimiento **RNF-08**: *"las reglas de acceso se aplican en la base (RLS) y no solo en el front"*.

### Las dos herramientas de la base

**RLS (Row Level Security):** reglas por tabla que dicen quién puede leer, insertar, modificar o borrar cada fila. Con RLS activado y sin política, **todo está bloqueado por defecto**: se abre solo lo que se necesita (principio de mínimo privilegio).

**Funciones `security definer`:** funciones de Postgres que corren con los permisos de su dueño, no del que las llama. Sirven para que un usuario ejecute **una operación concreta y controlada** (ej. `crear_orden`) sin darle acceso directo a las tablas. Adentro, la función decide qué se puede hacer.

### Cómo sabe la base quién es admin

[001_salas_butacas_y_seguridad.sql](../supabase/migraciones/001_salas_butacas_y_seguridad.sql) define una función auxiliar usada en casi todas las políticas:

```sql
public.tiene_rol(array['administrador'])      -- ¿el usuario logueado tiene alguno de estos roles?
```

- Es `security definer`: lee `profiles` con permisos propios, así las políticas de otras tablas la pueden usar sin depender de las de `profiles` (y sin riesgo de recursión infinita).
- Se le quita el permiso de ejecución a `anon`: un visitante no puede ni llamarla.
- **Por qué una sola función:** el criterio de "quién es admin" vive en un único lugar. Si cambia, se cambia ahí y no en 30 políticas.

### Nadie puede darse un rol a sí mismo

En la misma migración se resolvió un agujero de seguridad: la política "usuario actualiza su propio perfil" no limitaba **qué columnas** se podían tocar, así que cualquiera con la clave pública podía ejecutar `update profiles set rol = 'administrador'`.

**Solución:** permisos **por columna**. Se le quitó al cliente el permiso de escribir `rol` (y `puntos`), que solo se modifica desde adentro de funciones de la base:

```sql
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, nombre, apellido, fecha_nacimiento, tipo_sangre, color_ojos, dias_vacaciones) ...
grant update (nombre, apellido, fecha_nacimiento, ...) ...
```

El rol queda en `'cliente'` por defecto. Los roles `empleado` y `administrador` se asignan manualmente desde el panel de Supabase.

**Por qué es mejor así:** si el alta de administradores fuera una función de la app, sería la puerta de ataque más obvia. Dejarlo fuera de la app elimina la posibilidad de escalar privilegios.

---

# PARTE 1 — Permisos del ADMINISTRADOR

El administrador es quien **configura el negocio**. Todo lo que modifica el catálogo, los precios o la operación del cine es exclusivo suyo.

### 1.1 Gestionar películas (alta, edición, baja)

- **Qué es:** crear películas con nombre, sinopsis, duración, géneros, restricción de edad y **estado** (`en_cartelera`, `proximamente`, `baja`); editarlas y borrarlas.
- **Por qué solo admin:** el catálogo es lo primero que ve cualquier cliente. Si cualquiera pudiera modificarlo, podría publicar o borrar películas.
- **Cómo se implementó:**
  - Base: políticas `"administrador crea peliculas"` ([schema.sql](../supabase/schema.sql)), `"administrador actualiza peliculas"` y `"administrador borra peliculas"` ([migración 001](../supabase/migraciones/001_salas_butacas_y_seguridad.sql)), todas con `tiene_rol(array['administrador'])`.
  - Front: ruta `/admin/crear-pelicula`, componente [crear-pelicula.component.ts](../cine-moran/src/app/features/admin/crear-pelicula/crear-pelicula.component.ts).
- **Decisión de diseño — estado explícito:** la [migración 013](../supabase/migraciones/013_estado_pelicula.sql) reemplazó la lógica vieja (`visible_home` + `fecha_estreno` futura) por un campo `estado` que **elige el administrador**. Una "baja" oculta la película sin borrarla, así se conservan las órdenes y reseñas históricas. Esto cubre el RF-21 (el admin decide qué aparece en inicio).

### 1.2 Subir imágenes (afiches y fotos de productos)

- **Qué es:** subir y reemplazar las imágenes de películas, productos y combos.
- **Por qué solo admin:** el bucket es público para **leer** (cualquiera ve el afiche), pero si cualquiera pudiera **subir**, tendrías el storage lleno de archivos ajenos y costos.
- **Cómo:** políticas de `storage.objects` en [002](../supabase/migraciones/002_storage_solo_admin_sube_imagenes.sql) (bucket `peliculas`) y [016](../supabase/migraciones/016_combos_con_entrada.sql) (bucket `candy`): leer es público, escribir exige `tiene_rol(array['administrador'])`.

### 1.3 Gestionar salas y butacas

- **Qué es:** crear salas (que nacen con su mapa de 19 filas A–T sin K, bloques 4/20/4, fila J accesible, filas R/S/T VIP) y **habilitarlas o deshabilitarlas**.
- **Por qué solo admin:** modificar una sala altera el mapa donde los clientes eligen butacas.
- **Cómo:**
  - `crear_sala(p_nombre)` es `security definer` y verifica el rol adentro ([001](../supabase/migraciones/001_salas_butacas_y_seguridad.sql)). Las tablas `salas` y `butacas` tienen lectura pública (los clientes necesitan ver el mapa) y escritura solo del administrador.
  - Front: [gestionar-salas.component.ts](../cine-moran/src/app/features/admin/gestionar-salas/gestionar-salas.component.ts).
- **Decisión de diseño — deshabilitar en vez de borrar:** la [migración 015](../supabase/migraciones/015_sala_habilitada.sql) agrega `habilitada`. Una sala deshabilitada deja de recibir funciones nuevas, pero **las funciones ya programadas no se tocan**, para no romper compras existentes.

### 1.4 Gestionar funciones (programar, editar, eliminar)

- **Qué es:** crear funciones sueltas o **recurrentes** (ej. lun/mar/vie a las 18 hs), editarlas y borrarlas. **La sala nunca la elige la persona: la asigna el sistema.**
- **Por qué solo admin:** las funciones definen precios y horarios, y la regla de negocio exige que dos funciones **no se superpongan** en una sala y que haya **30 minutos** de margen (RF-19 y RF-20).
- **Cómo:**
  - `asignar_funcion` ([003](../supabase/migraciones/003_funciones.sql)/[015](../supabase/migraciones/015_sala_habilitada.sql)), `editar_funcion` ([014](../supabase/migraciones/014_editar_funcion.sql)) y `programar_funciones` ([018](../supabase/migraciones/018_programar_funciones.sql)) son `security definer` y empiezan con `if not tiene_rol(array['administrador']) then raise exception`.
  - Borrar: política `"administrador borra funciones"`.
  - Front: [crear-funcion.component.ts](../cine-moran/src/app/features/admin/crear-funcion/crear-funcion.component.ts) (formulario individual + formulario de programación recurrente con vista previa).
- **Por qué una función de la base y no lógica en Angular:** el cálculo de "¿hay sala libre?" necesita ser **atómico**. Si dos admins programan a la vez en el front, ambos verían libre la misma sala. En la base, el chequeo y la inserción ocurren juntos, así que no hay solapamientos posibles.

### 1.5 Gestionar candy bar: productos, categorías y combos

- **Qué es:** crear productos con categoría, foto y precio; armar **combos** (entradas incluidas + productos a precio fijo) y destacarlos en la compra.
- **Por qué solo admin:** definen precios que se cobran.
- **Cómo:** [011_candy_bar.sql](../supabase/migraciones/011_candy_bar.sql): lectura pública (`"productos publicos"`, `"combos publicos"`) y políticas `"administrador gestiona productos"`, `"...combos"`, `"...categorias"`, `"...combo_productos"` con `for all`.
- **Front:** [crear-producto](../cine-moran/src/app/features/admin/crear-producto/crear-producto.component.ts) y [crear-combo](../cine-moran/src/app/features/admin/crear-combo/crear-combo.component.ts).

### 1.6 Gestionar cupones y su porcentaje

- **Qué es:** crear cupones (bienvenida, por edad) y **cambiar el porcentaje** cuando quiera (RF-38).
- **Por qué solo admin, y por qué también no pueden *verse*:** un cupón es una decisión comercial. La política de lectura de `cupones` **también es solo del administrador** (`"cupones visibles para administrador"`). Un cliente no puede consultar la tabla para ver qué descuentos existen y cómo "calificar" para ellos. El descuento se aplica solo, adentro de `crear_orden`.
- **Cómo:** [010_cupones.sql](../supabase/migraciones/010_cupones.sql). Front: [gestionar-cupones.component.ts](../cine-moran/src/app/features/admin/gestionar-cupones/gestionar-cupones.component.ts).
- **Decisión de diseño — una sola tabla para todos los cupones:** en vez de tablas separadas, cada cupón tiene condiciones (`requiere_primera_compra`, `requiere_edad_minima`). Nuevos cupones se crean **sin tocar código**.

### 1.7 Validar entradas (también puede)

- El administrador **también** puede validar entradas y retirar candy. Es una decisión consciente: si el empleado falta, el admin puede cubrirlo. Ver sección 3.

### 1.8 Qué NO tiene el administrador (y por qué)

- **No tiene perfil de cliente:** no acumula puntos ni historial de compras. Al ingresar, va a su **panel de administración** (`/admin`), no a `/perfil`. Detalle en [perfil.component.ts](../cine-moran/src/app/features/perfil/perfil.component.ts): si el rol es administrador, redirige a `/admin`. **Por qué:** esas pantallas no le sirven; evita mostrar datos vacíos.
- **No puede crearse a sí mismo ni a otros administradores desde la app:** ver sección 0.

### Cómo se aplica en el front para el admin

| Capa | Dónde | Qué hace |
|---|---|---|
| Menú | [nav.component.html](../cine-moran/src/app/shared/nav/nav.component.html) | `@if (rol === 'administrador')` muestra un solo link, **Administración** (`/admin`). Adentro, el [layout de admin](../cine-moran/src/app/features/admin/layout/admin-layout.component.html) muestra un **menú lateral** agrupado (Programación, Candy bar, Clientes, Control) y carga cada pantalla en su propio `<router-outlet>` (rutas hijas). El empleado ve solo **Validar entrada**. |
| Guard | [admin.guard.ts](../cine-moran/src/app/core/guards/admin.guard.ts) | `canActivateChild` en la ruta `/admin`: protege el panel y todas las pantallas hijas con **un solo** guard. |
| Base | RLS + funciones | La barrera real. |

**Por qué `canActivateChild`:** se declara una vez en el padre (`path: 'admin'`) y cubre todas las hijas. Si mañana se agrega una pantalla admin, queda protegida sola, sin riesgo de olvidarse el guard.

---

# PARTE 2 — Permisos del CLIENTE

El cliente es quien **compra**. Sus permisos se resumen en: *ver casi todo lo público, comprar, y ver/modificar solo lo que es suyo.*

Hay dos niveles: **visitante** (sin cuenta) y **cliente registrado**.

### 2.1 Ver la cartelera, funciones, salas, mapa y candy bar (público)

- **Qué es:** cualquiera, incluso sin cuenta, ve películas, próximas funciones, detalle, reseñas, el mapa de butacas y los productos.
- **Por qué público:** el negocio es vender. Pedir login para **mirar** espanta compradores. El cliente lo pidió explícitamente: reseñas y funciones visibles **antes** de comprar (RF-08, RF-11).
- **Cómo:** políticas `for select to public using (true)` en `peliculas` ("catalogo publico"), `funciones`, `salas`, `butacas`, `productos`, `combos`, `resenas`. Son de **solo lectura**: ninguna permite escribir.

### 2.2 Comprar entradas — registrado o anónimo

- **Qué es:** elegir butacas, sumar productos o combos y confirmar. **Se puede comprar sin registrarse** (RF-24), dejando un email.
- **Por qué:** sacar la fricción del registro aumenta las ventas. Como contrapartida, el anónimo **no** recibe cupón ni puntos: son los incentivos para registrarse.
- **Cómo:** el cliente **no inserta en `ordenes`** directamente. Llama a `crear_orden(...)`, una función `security definer` con `grant execute ... to anon, authenticated` ([004](../supabase/migraciones/004_ordenes.sql) y siguientes).
  - Front: [seleccion-butacas.component.ts](../cine-moran/src/app/features/ordenes/seleccion-butacas/seleccion-butacas.component.ts), con el formulario de email solo si no hay sesión (`@if (!authService.currentUser())`).
- **Por qué una función y no un insert directo:** `crear_orden` hace **todo junto o nada** (RNF-09): valida precio, edad, butacas, aplica cupón, suma puntos, inserta orden, butacas y productos. Si algo falla, Postgres deshace la operación completa.
  - **El precio lo calcula la base**, no el front. Si el cliente mandara el total desde Angular, podría manipularlo desde las herramientas del navegador y pagar $0. Acá no puede.

### 2.3 No poder comprar la misma butaca que otro

- **Qué es:** dos personas no pueden quedarse con la misma butaca.
- **Por qué en la base y no en el front:** la regla es `unique (funcion_id, butaca_id)` en `orden_butacas` ([004](../supabase/migraciones/004_ordenes.sql)). Si dos compras llegan al mismo milisegundo, Postgres acepta una y **siempre** rechaza la segunda. Una validación en Angular nunca alcanza sola.
- **Cómo lo ve el cliente:** la vista `butacas_ocupadas` expone **solo** `funcion_id + butaca_id` (sin comprador ni código). Y con Supabase Realtime ([019](../supabase/migraciones/019_butacas_en_tiempo_real.sql)) el mapa se actualiza en vivo (RF-23).
- **Por qué una tabla pública aparte (`butacas_vendidas`):** `orden_butacas` no puede ser pública porque **su `id` es el código del QR**. Si cualquiera la leyera, podría copiar entradas ajenas. `butacas_vendidas` dice "esta butaca está vendida" y nada más.

### 2.4 Restricción de edad

- **Qué es:** no se puede comprar una película +13 o +18 si no se cumple la edad (RF-25).
- **Cómo:** se valida **dentro de `crear_orden`** ([005](../supabase/migraciones/005_edad_minima_en_orden.sql)): lee `fecha_nacimiento` de `profiles`. Si es un anónimo y la película tiene restricción, se exige iniciar sesión.
- **Por qué en la base:** el dato de nacimiento vive en la base y la compra pasa por ahí. Un front podría "olvidarse" de chequear o ser evadido.
- **Front:** `edadMinima` en [seleccion-butacas.component.ts](../cine-moran/src/app/features/ordenes/seleccion-butacas/seleccion-butacas.component.ts) solo avisa antes de que el usuario intente.

### 2.5 Perfil propio

- **Qué es:** ver y editar sus **propios** datos (nombre, apellido, fecha de nacimiento, etc.).
- **Por qué solo el propio:** tiene datos personales (tipo de sangre, color de ojos, nacimiento). RNF-08 exige protegerlos.
- **Cómo:** `profiles` tiene políticas `auth.uid() = id` (cada uno ve solo su fila) y los permisos de **columna** de la sección 0: el cliente **no puede** modificar `rol` ni `puntos`.
- **Excepción cuidadosa:** las reseñas muestran el nombre del autor. En vez de abrir `profiles` a todos (expondría tipo de sangre, etc.), se creó una **vista** `resenas_con_autor` que expone *solo* el nombre ([001](../supabase/migraciones/001_salas_butacas_y_seguridad.sql)).
- **Front:** `/perfil` protegida por [auth.guard.ts](../cine-moran/src/app/core/guards/auth.guard.ts) (`canActivate`).

### 2.6 Ver su propio historial de compras

- **Qué es:** el listado de sus compras.
- **Cómo:** política `"usuario ve sus propias ordenes"` ([004](../supabase/migraciones/004_ordenes.sql)): `auth.uid() = usuario_id` (también deja ver todas a admin y empleado). Y `"usuario ve butacas de sus propias ordenes"` ([006](../supabase/migraciones/006_resena_requiere_haber_visto.sql)).
- **Front:** `getHistorial()` en [ordenes.service.ts](../cine-moran/src/app/features/ordenes/ordenes.service.ts) hace un `select` sin filtro de usuario: **no hace falta**, la base ya devuelve solo lo suyo. Esa es la gracia de RLS: aunque el front se olvide de filtrar, nadie ve compras ajenas.

### 2.7 Escribir reseñas — solo si vio la película

- **Qué es:** calificar con 1 a 5 estrellas y comentar, pero **solo quien ya vio la película**.
- **Por qué:** el cliente pidió que las reseñas sirvan de guía a otros. Sin este chequeo, cualquiera podía calificar sin haber ido nunca (la política original solo pedía estar logueado).
- **Cómo:** [006](../supabase/migraciones/006_resena_requiere_haber_visto.sql) agrega la función `usuario_vio_pelicula()` y la usa en la política de insert: exige una orden **confirmada** con una butaca en una función de esa película **que ya pasó** (`inicio <= now()`). Hay además `unique (pelicula_id, usuario_id)`: una reseña por persona y película.
- **Por qué `security definer`:** `orden_butacas` no es legible para clientes; un `exists` común dentro de la política fallaría **incluso para quien sí compró**.
- **Front:** `yaVioPelicula()` en [ordenes.service.ts](../cine-moran/src/app/features/ordenes/ordenes.service.ts) solo decide si **mostrar** el formulario (en [detalle-pelicula.component.html](../cine-moran/src/app/features/catalogo/detalle/detalle-pelicula.component.html)). La base lo rechazaría igual: el front evita mostrar algo que va a fallar.

### 2.8 Alertas de estreno

- **Qué es:** el usuario registrado marca una película de "Próximamente" para que le avisen (RF-07).
- **Cómo:** `alertas_estreno` con tres políticas, todas con `auth.uid() = usuario_id`: cada usuario ve, crea y borra **solo las suyas** ([schema.sql](../supabase/schema.sql)). Front: [alertas.service.ts](../cine-moran/src/app/features/catalogo/proximamente/alertas.service.ts).

### 2.9 Cupón de bienvenida y puntos (solo registrado)

- **Qué es:** el registrado recibe 20 % en su primera compra (RF-37) y gana **1 punto por peso** (RF-40). Los puntos **no se transfieren** (RF-43).
- **Cómo:** todo ocurre adentro de `crear_orden` ([009](../supabase/migraciones/009_puntos_y_perfil.sql), [010](../supabase/migraciones/010_cupones.sql)): suma puntos solo si `auth.uid()` no es nulo. El cliente no puede escribir `puntos` (permiso de columna), y **no existe ninguna función** que mueva puntos entre usuarios: es una decisión a propósito, y por eso la regla se cumple por diseño.
- **Aplicación del cupón:** automática, un solo cupón por compra (el de mayor porcentaje entre los que cumple). No hay pantalla para "ingresar código", porque el cliente nunca la pidió.

### 2.10 Qué NO puede hacer el cliente

| No puede | Cómo se impide | Dónde |
|---|---|---|
| Entrar a `/admin` | `canActivateChild` + RLS | [admin.guard.ts](../cine-moran/src/app/core/guards/admin.guard.ts) |
| Crear o editar películas, funciones, salas, productos | Políticas y funciones con `tiene_rol(admin)` | Migraciones 001, 003, 011, 014, 015, 018 |
| Ver los cupones existentes | La lectura de `cupones` es solo del admin | [010](../supabase/migraciones/010_cupones.sql) |
| Cambiarse el rol o los puntos | Permiso de columna revocado | [001](../supabase/migraciones/001_salas_butacas_y_seguridad.sql) |
| Ver compras o perfiles de otros | RLS `auth.uid() = ...` | [004](../supabase/migraciones/004_ordenes.sql), `schema.sql` |
| Validar entradas | `validar_entrada` exige empleado o admin | [008](../supabase/migraciones/008_validar_entrada.sql) |
| Saltarse la restricción de edad | Validada adentro de `crear_orden` | [005](../supabase/migraciones/005_edad_minima_en_orden.sql) |
| Pagar un precio distinto | El total lo calcula la base | `crear_orden` |

---

# PARTE 3 — Complemento: el EMPLEADO

No lo pediste explícitamente, pero hay que tenerlo presente porque define dónde termina el cliente y dónde empieza el admin.

- **Qué puede:** validar entradas (por QR o código a mano) y retirar productos del candy bar con el mismo código (RF-48, RF-49, RF-32).
- **Qué NO puede:** nada administrativo. Es el rol de **menor alcance** de los tres con privilegios.
- **Cómo:**
  - `validar_entrada` ([008](../supabase/migraciones/008_validar_entrada.sql)) y `retirar_candy` ([012](../supabase/migraciones/012_candy_bar_en_la_compra.sql)) verifican `tiene_rol(array['empleado','administrador'])` adentro.
  - Validan en la base que el código exista, que la orden no esté cancelada y que **no haya sido usada antes** (RF-50: el QR deja de funcionar). Guardan quién y cuándo validó (`validada_por`, `validada_en`): es la base del log de actividad (RF-55).
  - Front: [validacion.service.ts](../cine-moran/src/app/features/empleado/validacion.service.ts) y [validar-entrada.component.ts](../cine-moran/src/app/features/empleado/validar-entrada/validar-entrada.component.ts).
  - Guard: [empleado.guard.ts](../cine-moran/src/app/core/guards/empleado.guard.ts) con **`canMatch`**: si no tiene el rol, la pantalla ni siquiera se descarga (lazy loading).
- **Por qué validar y retirar son acciones independientes:** se puede retirar el candy sin haber validado la entrada, y viceversa. Refleja cómo ocurre en un cine real.
- **Por qué un administrador también puede validar:** para cubrir al empleado.

---

# PARTE 4 — Resumen comparativo

| Acción | Visitante | Cliente | Empleado | Admin |
|---|:-:|:-:|:-:|:-:|
| Ver cartelera, funciones, reseñas, mapa de butacas | ✅ | ✅ | ✅ | ✅ |
| Ver butacas ocupadas en tiempo real | ✅ | ✅ | ✅ | ✅ |
| Comprar entradas y candy (con email) | ✅ | ✅ | ✅ | ✅ |
| Cupón de bienvenida y puntos | ❌ | ✅ | — | — |
| Registrarse / iniciar sesión | ✅ | — | — | — |
| Ver y editar su propio perfil (sin `rol` ni `puntos`) | ❌ | ✅ | ✅ | ✅ |
| Ver su historial de compras | ❌ | ✅ | ✅ (todas) | ✅ (todas) |
| Escribir reseña (solo si vio la película) | ❌ | ✅ | ✅ | ✅ |
| Activar alerta de estreno | ❌ | ✅ | ✅ | ✅ |
| Validar entradas y retirar candy | ❌ | ❌ | ✅ | ✅ |
| Crear/editar/borrar películas | ❌ | ❌ | ❌ | ✅ |
| Programar, editar y borrar funciones | ❌ | ❌ | ❌ | ✅ |
| Crear y habilitar/deshabilitar salas | ❌ | ❌ | ❌ | ✅ |
| Productos, categorías y combos | ❌ | ❌ | ❌ | ✅ |
| Cupones (ver y cambiar porcentajes) | ❌ | ❌ | ❌ | ✅ |
| Subir imágenes | ❌ | ❌ | ❌ | ✅ |
| Cambiarse el rol | ❌ | ❌ | ❌ | ❌ (solo desde Supabase) |

> Nota: las filas "Ver su historial de compras" para empleado y administrador reflejan la política de `ordenes` de la migración 004, que les permite leer todas las órdenes. Las demás filas de empleado y admin como "perfil", "reseña" y "alerta" son una consecuencia de que tienen una cuenta registrada; el panel del admin no usa `/perfil`.

---

# PARTE 5 — Por qué estas decisiones fueron mejores (argumentos para la defensa)

1. **Seguridad en la base, no en el front.** Es la única capa que no se puede saltear desde el navegador. El front (menú y guards) solo mejora la experiencia. *Frase útil:* "Si apago Angular y llamo a la API directo, las reglas siguen valiendo."
2. **Mínimo privilegio.** Todas las tablas tienen RLS activo: por defecto nada se puede, y se abre solo lo necesario. Los clientes **no tienen `insert` en órdenes**; usan una función controlada.
3. **Operaciones críticas como funciones atómicas.** `crear_orden`, `asignar_funcion` y `validar_entrada` se ejecutan completas o no se ejecutan. Se evita la doble venta, el solapamiento de salas y el doble uso de un QR.
4. **El servidor es dueño de los cálculos.** Precio, descuento, edad, puntos: nada de eso lo decide el navegador.
5. **Datos sensibles protegidos.** Tipo de sangre, color de ojos y fecha de nacimiento solo los ve su dueño. Para mostrar el nombre del autor de una reseña se usó una **vista** y no se abrió `profiles`.
6. **No hay forma de escalar privilegios.** Nadie puede cambiarse el rol ni sumarse puntos; no hay función de transferencia de puntos; los administradores se dan de alta fuera de la app.
7. **Un solo criterio de "quién es quién".** `tiene_rol()` centraliza la regla. Un cambio de política de roles se hace en un solo lugar.
8. **Baja lógica en vez de borrar.** Películas con estado `baja` y salas `habilitada = false` conservan el historial y no rompen compras existentes.
9. **Guards elegidos según el caso.** `canActivate` para el perfil, `canActivateChild` para todo el admin (un único punto), `canMatch` para el empleado (no descarga el código si no corresponde) y `canDeactivate` para no perder una selección de butacas.
10. **Se separó lo público de lo sensible.** La tabla `butacas_vendidas` y la vista `butacas_ocupadas` exponen solo lo mínimo para que el mapa funcione en vivo, sin filtrar los códigos QR.

---

## Preguntas que pueden hacerte

- **¿Qué pasa si un cliente escribe `/admin` en la barra?** El `adminGuard` lo redirige a inicio. Y aunque llegara a la pantalla, cualquier acción de escritura la rechazaría la base (RLS y `tiene_rol`).
- **¿Y si un cliente llama a la API de Supabase directo con su clave pública?** Solo puede lo que RLS le permite: leer lo público y lo suyo. No puede crear películas, cambiarse el rol ni ver compras ajenas.
- **¿Por qué los clientes no insertan directamente en `ordenes`?** Porque la compra implica muchos pasos que deben ser atómicos y confiables (precio, edad, butacas, cupón, puntos). La función los hace todos juntos en el servidor.
- **¿Por qué el precio no viene del front?** Porque el front es manipulable. Calcularlo en la base impide pagar un monto alterado.
- **¿Cómo se hace administrador a alguien?** Desde el panel de Supabase (SQL Editor), a propósito. Así no existe un endpoint que alguien pueda abusar para darse ese rol.
- **¿Por qué el admin no tiene perfil de cliente?** Porque no compra ni acumula puntos; su pantalla de inicio es el panel de administración.
- **¿Por qué las reseñas exigen haber visto la película?** Para que las calificaciones sean confiables como guía para otros compradores. La regla vive en la base: `usuario_vio_pelicula()`.
