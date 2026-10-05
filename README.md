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

## Roles

`profiles.rol` puede ser `cliente`, `empleado` o `administrador`. Un usuario nuevo siempre arranca como `cliente`; los otros roles se asignan a mano desde el SQL Editor de Supabase (no hay una pantalla para eso, a propósito: es una operación sensible y poco frecuente).
