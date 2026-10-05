# CineMoran

Sistema web para un cine: cartelera con buscador, reseñas, funciones con asignación automática de sala (también recurrentes), compra de entradas con selección de butacas, candy bar y combos, cupones y puntos, PDF con QR, validación de entradas por parte de empleados y un panel de administración.

Trabajo práctico de Programación IV (UTN) — Nadia Moran.

**App desplegada:** https://cine-moran.web.app
**Requerimientos y estado de cada uno:** [`docs/requerimientos.md`](docs/requerimientos.md)

## Stack

- **Angular 22**, componentes standalone, `provideZonelessChangeDetection` (todo el estado que cambia en pantalla usa signals) y rutas con carga diferida (`loadComponent`).
- **Supabase**: base de datos Postgres, autenticación, storage de imágenes (buckets `peliculas` y `candy`), Realtime y la lógica de negocio sensible (ver más abajo).
- **Reactive Forms** para todos los formularios, con validadores propios.
- **jsPDF** y **qrcode** para generar las entradas en PDF, del lado del navegador.
- **PWA** (`@angular/service-worker` + manifest) y **Firebase Hosting** para el despliegue.

## Cómo correrlo

```bash
cd cine-moran
npm install
ng serve
```

La app apunta al proyecto de Supabase configurado en `cine-moran/src/environments/environment.ts` (la clave ahí es la clave pública, protegida por las políticas de la base — no es un secreto). Hay un solo entorno: la misma base se usa en desarrollo y en la app desplegada.

### Base de datos

Para levantar la base desde cero: primero `supabase/schema.sql` (el estado original: `profiles`, `peliculas`, `resenas`, `alertas_estreno`) y después los archivos de `supabase/migraciones/` **en orden**, en el SQL Editor de Supabase:

| # | Migración | Qué agrega |
|---|---|---|
| 001 | `salas_butacas_y_seguridad` | Salas y butacas (`crear_sala()`), función `tiene_rol()`, corrección de permisos de `profiles`, 3 salas de ejemplo |
| 002 | `storage_solo_admin_sube_imagenes` | Solo el admin sube imágenes al bucket `peliculas` |
| 003 | `funciones` | Funciones y `asignar_funcion()` (sala automática, 30 min de margen) |
| 004 | `ordenes` | Órdenes, `orden_butacas` con `unique(funcion_id, butaca_id)` y `crear_orden()` |
| 005 | `edad_minima_en_orden` | La restricción +13/+18 también se valida en la base |
| 006 | `resena_requiere_haber_visto` | Solo reseña quien compró una entrada de una función que ya pasó |
| 007 | `crear_orden_devuelve_butacas` | `crear_orden()` devuelve el detalle de las butacas (para el PDF) |
| 008 | `validar_entrada` | `validar_entrada()` para empleados; el código se usa una sola vez |
| 009 | `puntos_y_perfil` | Puntos de fidelización (1 por peso) |
| 010 | `cupones` | Cupón de bienvenida (20 %) y cupones por edad, configurables |
| 011 | `candy_bar` | Categorías, productos y combos |
| 012 | `candy_bar_en_la_compra` | Productos en la compra y `retirar_candy()` con el mismo código |
| 013 | `estado_pelicula` | Estado de la película: en cartelera, próximamente o baja |
| 014 | `editar_funcion` | `editar_funcion()` reasignando sala con las mismas reglas |
| 015 | `sala_habilitada` | Habilitar / deshabilitar salas; solo las habilitadas reciben funciones |
| 016 | `combos_con_entrada` | Combos con entradas incluidas y foto (bucket `candy`); `crear_orden()` descuenta esas entradas |
| 017 | `foto_producto` | Foto de los productos |
| 018 | `programar_funciones` | `programar_funciones()`: funciones recurrentes con vista previa |
| 019 | `butacas_en_tiempo_real` | Tabla `butacas_vendidas` + triggers, publicada en Supabase Realtime |

## Estructura del proyecto

```
cine-moran/src/app/
├── core/                    # autenticación, guards, cliente de Supabase (compartido)
├── shared/                  # nav, pipes, directivas y validadores reutilizables
└── features/
    ├── auth/                # login, registro
    ├── catalogo/            # cartelera, detalle de película, reseñas, próximamente
    ├── salas/               # salas, mapa de butacas (componente reutilizable)
    ├── funciones/           # horarios de proyección
    ├── ordenes/             # selección de butacas, compra, generación de PDF
    ├── candy-bar/           # productos, categorías y combos
    ├── perfil/              # perfil del cliente (datos, puntos, historial)
    ├── empleado/            # validación de entradas y retiro del candy bar
    └── admin/               # panel y pantallas de administración
        ├── panel/               # inicio del administrador
        ├── crear-pelicula/      # Películas
        ├── crear-funcion/       # Funciones (única o programada)
        ├── gestionar-salas/     # Salas
        ├── crear-producto/      # Productos
        ├── crear-combo/         # Combos
        └── gestionar-cupones/   # Cupones
```

Cada feature tiene su propio `.service.ts` para hablar con Supabase y su(s) componente(s). El único servicio compartido "de infraestructura" es `SupabaseService` (`core/supabase.service.ts`): un solo cliente de Supabase para toda la app, en vez de que cada servicio cree el suyo. Esto da una sola sesión de autenticación y una sola configuración para cuando se sume Realtime.

## Dónde vive la lógica de negocio

La decisión de arquitectura más importante del proyecto: **las reglas que importan de verdad no dependen de que el código de Angular las respete**, viven en la base de datos (políticas de RLS y funciones `security definer`). Un guard de Angular solo mejora la experiencia (evita que alguien vea una pantalla que no le corresponde); la regla real está un nivel más abajo, para que no se pueda saltear editando el JavaScript del navegador o llamando a la API directo.

| Regla | Dónde vive | Por qué ahí |
|---|---|---|
| Nadie puede asignarse el rol de administrador a sí mismo | Permisos por columna en `profiles` | La política de "actualizar mi perfil" no alcanza para bloquear una sola columna; hace falta revocar el `update` de esa columna puntual |
| Dos personas no pueden comprar la misma butaca para la misma función | Restricción `unique(funcion_id, butaca_id)` en `orden_butacas`, dentro de `crear_orden()` | Es la única forma de garantizarlo bajo concurrencia real; una validación en Angular llega tarde si dos compras entran casi al mismo tiempo |
| Una función no puede ir a una sala ocupada en ese horario (30 min de margen, según la duración de la película) | `asignar_funcion()`, `editar_funcion()` y `programar_funciones()` | El admin nunca elige la sala: el sistema la busca sola, solo entre salas habilitadas |
| Una función con entradas vendidas no cambia de sala ni se puede borrar | `editar_funcion()` y la clave foránea de `ordenes` | Las butacas compradas pertenecen a esa sala |
| No se puede comprar una entrada +13/+18 sin cumplir la edad | `crear_orden()` (además de un chequeo igual en Angular, para la experiencia) | Alguien podría llamar a la función SQL directo, sin pasar por la pantalla |
| El total de la compra (cupón, productos, combos con entradas incluidas) | `crear_orden()` | El precio nunca se toma del navegador; Angular solo muestra una estimación |
| Un combo cubre entradas generales, no VIP | `crear_orden()` | Cuenta las butacas no VIP elegidas y rechaza la compra si no alcanzan |
| Solo puede dejar reseña quien ya vio la película | Política de insert en `resenas`, usando `usuario_vio_pelicula()` | La regla tiene que sobrevivir aunque no se pase por el formulario de Angular |
| Una entrada validada o un candy bar retirado no se pueden volver a usar | `validar_entrada()` y `retirar_candy()` (columnas `validada_en` y `retirado_en`) | La validación la hace un empleado desde otra pantalla; la regla vive donde están los datos |
| Solo el admin sube imágenes y modifica el catálogo | Políticas de RLS y de Storage con `tiene_rol()` | Un cliente logueado no puede llenar el almacenamiento ni cambiar precios |

## Compra de entradas y validación (QR)

1. El cliente elige una función y ve el mapa de butacas con las que ya están vendidas. El mapa se actualiza **en tiempo real** (ver más abajo): si otra persona compra mientras se está mirando, esa butaca se marca ocupada al instante. Selecciona butacas libres y, si quiere, productos del candy bar y combos.
2. Los **combos especiales** aparecen destacados con foto. Si un combo incluye entradas, esas butacas no se cobran sueltas: se paga solo el precio del combo (cubre entradas generales, no VIP).
3. Al confirmar, `crear_orden()` crea la orden, sus butacas y sus productos en una sola transacción, aplica el cupón que corresponda y suma los puntos.
4. Se genera un PDF (`jsPDF`) con **una página por butaca comprada**: cada entrada se valida por separado en la puerta. Cada página tiene un QR (`qrcode`) con el id de esa butaca-en-esa-orden, más el mismo código como texto por si el lector no funciona.
5. Un usuario `empleado` (o `administrador`) entra a "Validar entrada", escanea el QR con la cámara (API nativa `BarcodeDetector`, si el navegador la soporta) o escribe el código. Con "Validar entrada" marca esa butaca como usada; con "Retirar candy bar" entrega los productos de la orden con ese mismo código. Ninguno de los dos se puede repetir.

## Butacas en tiempo real (Supabase Realtime)

Requerimiento del cliente: mientras alguien elige butacas, tiene que ver las que otra compra ocupa en ese mismo momento.

- **Qué se escucha:** la tabla `butacas_vendidas` (migración 019), que solo tiene `funcion_id` y `butaca_id`. No se escucha `orden_butacas` porque no tiene permiso de lectura para clientes (Realtime respeta RLS, así que no llegaría nada) y porque su `id` es el código del QR: abrirla permitiría copiar entradas ajenas. Tampoco sirve la vista `butacas_ocupadas`, porque Realtime no funciona con vistas.
- **Quién la escribe:** nadie desde la app. Triggers en la base la actualizan cuando se compra una butaca, cuando se borra o cuando una orden pasa a `cancelada`.
- **En Angular:** `OrdenesService.escucharButacas()` abre un canal con `supabase.channel()` y `postgres_changes` (INSERT filtrado por función en el servidor; DELETE filtrado en el cliente, porque Realtime no permite filtrar los DELETE). El componente de compra actualiza el signal `ocupadas` y, si la butaca era una de las elegidas, la quita y avisa. Al salir de la pantalla, `DestroyRef.onDestroy` cierra el canal.
- **Carrera con la propia compra:** el aviso de Realtime puede llegar antes que la respuesta de `crear_orden()`. Mientras la compra está en curso, el evento solo marca la butaca como ocupada y no muestra el aviso de "alguien la compró".

## Administración

El administrador entra a su **panel** (`/admin`) desde "Hola, {nombre}" — no tiene perfil de cliente, porque no acumula puntos ni compra. Todas las pantallas de administración siguen el mismo patrón: **listado arriba, botón "Nuevo" y un formulario que se abre solo cuando hace falta**.

- **Películas**: alta con imagen, géneros elegidos de los ya cargados y estado: En cartelera (se ve en la cartelera), Próximamente (se ve en esa sección) o Baja (no se ve).
- **Funciones**: "Programar funciones" (días de la semana + horarios + período, con vista previa de la sala de cada función) o "Función única"; edición y baja.
- **Salas**: alta (las butacas se crean solas con la forma que definió el cliente) y habilitar / deshabilitar.
- **Productos** y **Combos**: alta con foto, edición (productos) y activar / dar de baja.
- **Cupones**: porcentaje del cupón de bienvenida y cupones por edad.

## Roles

`profiles.rol` puede ser `cliente`, `empleado` o `administrador`. Un usuario nuevo siempre arranca como `cliente`; los otros roles se asignan a mano desde el SQL Editor de Supabase (no hay una pantalla para eso, a propósito: es una operación sensible y poco frecuente).

```sql
update profiles set rol = 'administrador' where id = (select id from auth.users where email = 'mail@ejemplo.com');
```

## Decisiones y supuestos

Los mails del cliente tienen varios puntos ambiguos o contradictorios. Las decisiones tomadas para resolverlos están en [`docs/requerimientos.md`](docs/requerimientos.md) (sección 6).

Otras decisiones técnicas, además de las de la tabla de arriba:

- **Reactive Forms en vez de Signal Forms** (`@angular/forms/signals`): esta última es una API muy nueva de Angular; con Reactive Forms se pueden usar validadores sincrónicos propios (como se vio en clase) y queda más fácil de defender.
- **Pago simulado**: el cliente nunca definió un medio de pago; no hay pasarela real.
- **PDF y QR generados en el navegador**: evita tener que armar un backend propio solo para eso.
- **Funciones recurrentes sin tabla de "programaciones"**: `programar_funciones()` genera todas las funciones del período de una vez. La vista previa ejecuta exactamente la misma lógica y al final deshace los cambios, así lo que se muestra es lo que se va a crear (incluidos los choques entre funciones de la misma tanda).
- **Bajas lógicas**: productos, combos y salas no se borran, se desactivan, porque las compras viejas los referencian.
- **Géneros como arreglo** dentro de `peliculas`: la lista de géneros disponibles se arma con los que ya usan las películas cargadas.

## Despliegue

```bash
cd cine-moran
ng build
firebase deploy --only hosting
```

`firebase.json` publica `dist/cine-moran/browser` y redirige todas las rutas a `index.html` (necesario para que funcionen las rutas de Angular al recargar la página).

## Qué falta

El detalle completo, requerimiento por requerimiento, está en [`docs/requerimientos.md`](docs/requerimientos.md) (sección 9). Lo principal:

- Precio mayor para las butacas VIP.
- Destacar las 3 más vendidas en la cartelera (el contador `ventas` todavía no se actualiza).
- Cancelación con crédito, canje de puntos y "Mis películas".
- Preventa y envío de las alertas de "Próximamente".
- Reportes de facturación (con exportación a PDF y Excel), gráficos y log de actividad en el panel de administración.
