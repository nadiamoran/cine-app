# CineMoran

Sistema web para un cine de un solo edificio con varias salas. Los clientes pueden ver la cartelera, leer reseñas, elegir butacas en tiempo real, comprar entradas y productos del candy bar, y descargar sus entradas en PDF con QR. Los empleados validan esas entradas en la puerta y el administrador maneja todo el cine desde un panel propio.

Trabajo práctico N.° 1 de Programación IV (UTN) — Nadia Moran.

- **App desplegada:** https://cine-moran.web.app
- **Documento de requerimientos y estado de cada uno:** [`docs/requerimientos.md`](docs/requerimientos.md)
- **Permisos de cada rol y por qué:** [`docs/permisos-y-roles.md`](docs/permisos-y-roles.md)

---

## Qué se puede hacer

**Cliente (o visitante sin cuenta)**
- Ver la cartelera con buscador y filtro por género. Las 3 películas más vendidas aparecen primero, con su leyenda.
- Ver la sección Próximamente y activar una alerta en una película.
- Ver el detalle de cada película: funciones, reseñas y puntuación promedio.
- Elegir butacas en un mapa que se actualiza en vivo cuando otra persona compra.
- Comprar entradas (estándar, accesibles o VIP), productos y combos, y descargar el PDF con un QR por entrada.
- Si está registrado: cupón de bienvenida, puntos por cada compra, canje de puntos por entradas o productos, crédito por cancelaciones, historial de compras, "Mis películas" y reseñas de lo que ya vio.

**Empleado**
- Validar entradas con la cámara o escribiendo el código, y entregar el candy bar con el mismo código.

**Administrador**
- Películas (con preventa), funciones (sueltas o programadas por días y horarios), salas y precios de entradas, productos, combos, cupones y recompensas.
- Reporte de facturación por día exportable a PDF y Excel, rankings de películas y productos, y un log de actividad.

---

## Stack

| | |
|---|---|
| Front | Angular 22 (componentes standalone, signals, zoneless) |
| Backend | Supabase: Postgres, autenticación, storage de imágenes y Realtime |
| Formularios | Reactive Forms, con validadores propios |
| PDF y QR | jsPDF y qrcode (se generan en el navegador) |
| Excel | SheetJS (`xlsx`) para exportar el reporte |
| PWA | `@angular/service-worker` y manifest |
| Deploy | Firebase Hosting |

---

## Cómo correrlo

1. Clonar el repo e instalar dependencias:
   ```bash
   cd cine-moran
   npm install
   ```
2. En `src/environments/environment.ts` van la URL y la clave pública (anon key) del proyecto de Supabase.
3. Crear la base: en el SQL Editor de Supabase correr primero `supabase/schema.sql` y después las migraciones de `supabase/migraciones/` **en orden**, de la 001 a la 027. Cada migración dice al principio cuáles necesita antes.
4. Levantar la app:
   ```bash
   npm start
   ```
   Queda en `http://localhost:4200`.
5. Los roles de empleado y administrador se asignan a mano desde Supabase (a propósito, ver más abajo):
   ```sql
   update profiles set rol = 'administrador' where id = (select id from auth.users where email = 'mail@ejemplo.com');
   ```

**Deploy:** `npm run build` y después `firebase deploy --only hosting`.

---

## Estructura

```
cine-moran/src/app/
├── core/            # autenticación, guards y cliente de Supabase
├── shared/          # menú, pie de página, pipes, directivas y validadores
└── features/
    ├── auth/            # login y registro
    ├── catalogo/        # cartelera, detalle, reseñas, próximamente y preventa
    ├── mis-peliculas/   # historial visual de lo que vio el cliente
    ├── salas/           # mapa de butacas (componente reutilizable)
    ├── funciones/       # funciones y precios por formato
    ├── ordenes/         # compra, cancelación y PDF de las entradas
    ├── candy-bar/       # productos y combos
    ├── puntos/          # recompensas y movimientos de puntos
    ├── perfil/          # perfil del cliente
    ├── empleado/        # validación de entradas
    └── admin/           # panel (menú lateral) y todas las pantallas de administración

supabase/
├── schema.sql       # tablas iniciales
└── migraciones/     # 001 a 027, cada una con un cambio y su explicación
```

Organicé el código **por funcionalidad** y no por tipo de archivo: todo lo de una parte del sistema (componentes, servicio y modelo) está junto, así es más fácil encontrarlo. Cada pantalla se carga recién cuando se entra (lazy loading).

---

## Arquitectura

```
Angular (navegador)  ──►  Supabase
  pantallas                ├─ Auth (sesión)
  servicios ─── supabase-js├─ Postgres: tablas + RLS + funciones SQL
  guards                   ├─ Storage (afiches y fotos)
                           └─ Realtime (butacas vendidas)
```

La app no tiene un servidor propio: Angular habla directo con Supabase. Por eso **la seguridad y las reglas del negocio están en la base**, no en el front:

- **RLS (Row Level Security)** en todas las tablas: por defecto nadie puede leer ni escribir nada, y se habilita solo lo necesario. Cada cliente ve solo sus compras, solo el admin modifica el catálogo, etc.
- **Funciones SQL** para las operaciones importantes. Por ejemplo, `crear_orden` hace toda la compra en una sola transacción (precio, edad, butacas, cupón, crédito, puntos, canje) y, si algo falla, no se guarda nada.
- **Triggers** para lo que tiene que pasar siempre: sumar ventas, liberar butacas al cancelar y registrar el log de actividad.

El front valida también, pero para dar una mejor experiencia (avisar antes de enviar). La regla real está en la base, porque cualquiera podría llamar a la API salteándose Angular.

---

## Decisiones técnicas

**La base calcula los precios.** El total de una compra lo calcula `crear_orden`, nunca el navegador. Si el precio viniera del front, se podría modificar desde las herramientas del navegador.

**Una butaca no se puede vender dos veces.** Hay un índice único en la base por función y butaca (solo para compras vigentes). Si dos personas confirman la misma butaca al mismo tiempo, la base acepta una y rechaza la otra.

**Butacas en tiempo real con una tabla aparte.** El mapa escucha la tabla `butacas_vendidas` con Supabase Realtime. No escucha `orden_butacas` porque el id de cada fila es el código del QR, y esa tabla no puede ser pública.

**Asignación automática de salas.** La sala nunca la elige el admin: la busca la base, respetando que no haya superposición y que queden 30 minutos entre funciones. Las funciones recurrentes se generan todas juntas, con una vista previa antes de crearlas.

**Precios por formato y tipo de butaca.** Hay una tabla de precios (2D, 3D, 4D y 5D, estándar y VIP) que se configura en Salas. Cada función toma el precio de su formato, así el admin no lo carga a mano en cada una.

**Preventa por película.** Se activa desde la película con un descuento en pesos. La venta abre 7 días antes del estreno y desde el estreno vuelve sola al precio normal.

**Cancelación con crédito.** Hasta 2 horas antes y si no se usó la entrada. Se devuelve el total como crédito (nunca dinero), se descuentan los puntos ganados y la butaca se libera para volver a venderse. El crédito se usa después junto con otro medio de pago.

**Pago simulado.** El cliente no definió un medio de pago, así que no hay pasarela real: se elige tarjeta de crédito, débito o Mercado Pago y queda registrado en la orden.

**Puntos y canje.** 1 punto por peso pagado con dinero (no con crédito). Se canjean al comprar por las recompensas que configura el admin. No existe ninguna operación para pasar puntos entre usuarios.

**Log de actividad con triggers.** Quién creó una función, quién cambió un precio y quién validó un QR lo registra la base automáticamente. Solo el admin lo puede leer y nadie lo puede borrar desde la app.

**Los roles se asignan fuera de la app.** El cliente no puede cambiar su rol ni sus puntos (permisos por columna en `profiles`). Los empleados y administradores se dan de alta desde Supabase, para que no exista una pantalla que alguien pueda usar para darse permisos.

**Guards que esperan la sesión.** La sesión se recupera de forma asíncrona al abrir la app, así que los guards esperan a que termine antes de decidir. Sin eso, al recargar la página parecía que no había nadie logueado.

**Reactive Forms con validadores propios.** Por ejemplo, la fecha de nacimiento no puede ser futura y las fechas tienen que tener un año válido.

**Fechas en castellano.** La app usa el idioma `es-AR`, así los pipes de fecha y número muestran "jueves 09/10" y "$13.500".

---

## Temas de la materia que se usan

| Tema | Dónde |
|---|---|
| Rutas y lazy loading | `app.routes.ts`: todas las pantallas con `loadComponent`; el admin con rutas hijas dentro de un layout con menú lateral |
| Input / Output | Mapa de butacas (`butaca` recibe la butaca y emite la selección), tarjeta de película, vista previa de preventa |
| Servicios | Un servicio por funcionalidad (películas, funciones, órdenes, candy bar, recompensas, reportes, etc.) |
| HTTP | A través de `supabase-js`, que hace los pedidos a la API REST de Supabase |
| Formularios | Reactive Forms en todos los formularios, con validadores propios en `shared/validators` |
| Guards | `authGuard`, `adminGuard` (protege todas las rutas hijas de admin), `empleadoGuard` (`canMatch`) y `confirmarSalidaGuard` (no perder la selección de butacas) |
| Directivas | `butaca-tipo` (estilo según el tipo de butaca) y `routerLinkActive` en los menús |
| Pipes | `duracion` (propio), y `date` y `number` en castellano |
| PWA | Manifest, íconos y service worker; se puede instalar |
| Supabase Realtime | Butacas que se ocupan en vivo mientras otra persona elige |

---

## Pendientes

- La alerta de "Próximamente" se activa, pero todavía no envía la notificación cuando abre la venta (RF-07).
- Quedan algunos campos de fecha con el calendario común del navegador (RNF-02).

El estado detallado de cada requerimiento está en la sección 9 de [`docs/requerimientos.md`](docs/requerimientos.md).
