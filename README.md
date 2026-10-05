# CineMoran

Sistema web para un cine: cartelera con buscador, reseñas, funciones con asignación automática de sala (también recurrentes), compra de entradas con selección de butacas, candy bar y combos, cupones y puntos, PDF con QR, validación de entradas por parte de empleados y un panel de administración.

Trabajo práctico de Programación IV (UTN) — Nadia Moran.

**App desplegada:** https://cine-moran.web.app
**Requerimientos y estado de cada uno:** [`docs/requerimientos.md`](docs/requerimientos.md)

## Stack

- **Angular 22**, componentes standalone, `provideZonelessChangeDetection` (todo el estado que cambia en pantalla usa signals) y rutas con carga diferida (`loadComponent`).
- **Supabase**: base de datos Postgres, autenticación, storage de imágenes (buckets `peliculas` y `candy`) y la lógica de negocio sensible (ver más abajo).
- **Reactive Forms** para todos los formularios, con validadores propios.
- **jsPDF** y **qrcode** para generar las entradas en PDF, del lado del navegador.
- **PWA** (`@angular/service-worker` + manifest) y **Firebase Hosting** para el despliegue.

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

1. El cliente elige una función y ve el mapa de butacas con las que ya están vendidas (se consulta al entrar a la pantalla; todavía no se actualiza sola si alguien más compra mientras se está mirando — eso requiere Supabase Realtime). Selecciona butacas libres y, si quiere, productos del candy bar y combos.
2. Los **combos especiales** aparecen destacados con foto. Si un combo incluye entradas, esas butacas no se cobran sueltas: se paga solo el precio del combo (cubre entradas generales, no VIP).
3. Al confirmar, `crear_orden()` crea la orden, sus butacas y sus productos en una sola transacción, aplica el cupón que corresponda y suma los puntos.
4. Se genera un PDF (`jsPDF`) con **una página por butaca comprada**: cada entrada se valida por separado en la puerta. Cada página tiene un QR (`qrcode`) con el id de esa butaca-en-esa-orden, más el mismo código como texto por si el lector no funciona.
5. Un usuario `empleado` (o `administrador`) entra a "Validar entrada", escanea el QR con la cámara (API nativa `BarcodeDetector`, si el navegador la soporta) o escribe el código. Con "Validar entrada" marca esa butaca como usada; con "Retirar candy bar" entrega los productos de la orden con ese mismo código. Ninguno de los dos se puede repetir.

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

- Butacas en tiempo real (Supabase Realtime) y precio mayor para las butacas VIP.
- Destacar las 3 más vendidas en la cartelera (el contador `ventas` todavía no se actualiza).
- Cancelación con crédito, canje de puntos y "Mis películas".
- Preventa y envío de las alertas de "Próximamente".
- Reportes de facturación (con exportación a PDF y Excel), gráficos y log de actividad en el panel de administración.
