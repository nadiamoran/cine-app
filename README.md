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


## Compra de entradas y validación (QR)

1. El cliente elige una función y ve el mapa de butacas con las que ya están vendidas. El mapa se actualiza **en tiempo real** (ver más abajo): si otra persona compra mientras se está mirando, esa butaca se marca ocupada al instante. Selecciona butacas libres y, si quiere, productos del candy bar y combos.
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

## Qué falta

El detalle completo, requerimiento por requerimiento, está en [`docs/requerimientos.md`](docs/requerimientos.md) (sección 9). Lo principal:

- Precio mayor para las butacas VIP.
- Destacar las 3 más vendidas en la cartelera (el contador `ventas` todavía no se actualiza).
- Cancelación con crédito, canje de puntos y "Mis películas".
- Preventa y envío de las alertas de "Próximamente".
- Reportes de facturación (con exportación a PDF y Excel), gráficos y log de actividad en el panel de administración.
