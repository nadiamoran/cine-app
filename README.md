# CineMoran

Sistema web para un cine: cartelera, reseñas, funciones con asignación automática de sala, compra de entradas con selección de butacas, generación de PDF con QR, y validación de entradas por parte de empleados.

Trabajo práctico de Programación IV (UTN) — Nadia Moran.

**App desplegada:** https://cine-moran.web.app

## Stack

- **Angular 22**, componentes standalone, `provideZonelessChangeDetection` (todo el estado que cambia en pantalla usa signals).
- **Supabase**: base de datos Postgres, autenticación, storage de imágenes y la lógica de negocio sensible (ver más abajo).
- **Reactive Forms** para todos los formularios, con validadores propios.
- **jsPDF** y **qrcode** para generar las entradas en PDF, del lado del navegador.

## Cómo correrlo

```bash
cd cine-moran
npm install
ng serve
```

La app apunta al proyecto de Supabase configurado en `cine-moran/src/environments/environment.ts` (la clave ahí es la clave pública/anónima, protegida por las políticas de la base — no es un secreto).

Para levantar la base desde cero: primero `supabase/schema.sql` (el estado original: `profiles`, `peliculas`, `resenas`, `alertas_estreno`), y después los archivos de `supabase/migraciones/` **en orden** (001, 002, 003...) en el SQL Editor de Supabase.

## Estructura del proyecto

```
cine-moran/src/app/
├── core/                    # autenticación, guards, cliente de Supabase (compartido)
├── shared/                  # nav, pipes, directivas y validadores reutilizables
└── features/
    ├── auth/                # login, registro
    ├── catalogo/             # cartelera, detalle de película, reseñas, próximamente
    ├── salas/                # mapa de butacas (componente reutilizable)
    ├── funciones/            # horarios de proyección
    ├── ordenes/              # selección de butacas, compra, generación de PDF
    ├── empleado/             # validación de entradas (QR o código manual)
    └── admin/                # alta de películas y funciones
```

Cada feature tiene su propio `.service.ts` para hablar con Supabase y su(s) componente(s). El único servicio compartido "de infraestructura" es `SupabaseService` (`core/supabase.service.ts`): un solo cliente de Supabase para toda la app, en vez de que cada servicio cree el suyo. Esto da una sola sesión de autenticación y una sola configuración para cuando se sume Realtime.

## Dónde vive la lógica de negocio

La decisión de arquitectura más importante del proyecto: **las reglas que importan de verdad no dependen de que el código de Angular las respete**, viven en la base de datos (políticas de RLS y funciones `security definer`). Un guard de Angular solo mejora la experiencia (evita que alguien vea una pantalla que no le corresponde); la regla real está un nivel más abajo, para que no se pueda saltear editando el JavaScript del navegador o llamando a la API directo.

Ejemplos concretos:

| Regla | Dónde vive | Por qué ahí |
|---|---|---|
| Nadie puede asignarse el rol de administrador a sí mismo | Permisos por columna en `profiles` | La política de "actualizar mi perfil" no alcanza para bloquear una sola columna; hace falta revocar el `update` de esa columna puntual |
| Dos personas no pueden comprar la misma butaca para la misma función | Restricción `unique(funcion_id, butaca_id)` en `orden_butacas`, dentro de la función `crear_orden()` | Es la única forma de garantizarlo bajo concurrencia real; una validación en Angular llega tarde si dos compras entran casi al mismo tiempo |
| Una función no puede asignarse a una sala ocupada en ese horario (con 30 min de margen) | Función `asignar_funcion()` | El admin nunca elige la sala directamente: el sistema la busca sola |
| No se puede comprar una entrada +13/+18 sin cumplir la edad | Función `crear_orden()` (además de un chequeo igual en Angular, para la experiencia) | Alguien podría llamar a la función SQL directo, sin pasar por la pantalla |
| Solo puede dejar reseña quien ya vio la película | Política de insert en `resenas`, usando la función `usuario_vio_pelicula()` | Mismo motivo: la regla tiene que sobrevivir aunque no se pase por el formulario de Angular |
| Una entrada validada no se puede volver a usar | Función `validar_entrada()`, columna `validada_en` en `orden_butacas` | La validación la hace un empleado desde una pantalla que no es de quien compró; la regla vive donde están los datos |

## Compra de entradas y validación (QR)

1. El cliente elige una función y ve el mapa de butacas con las que ya están vendidas (se consulta al entrar a la pantalla; no se actualiza sola si alguien más compra mientras se está mirando — eso requeriría Supabase Realtime, que todavía no está implementado). Selecciona butacas libres y confirma; `crear_orden()` crea la orden y sus butacas en una sola transacción.
2. Al confirmar, se genera un PDF (`jsPDF`) con **una página por butaca comprada**: cada entrada se valida por separado en la puerta, no todas juntas. Cada página tiene un QR (`qrcode`) que codifica el id de esa butaca-en-esa-orden, más el mismo código como texto por si el lector no funciona.
3. Un usuario con rol `empleado` (o `administrador`) entra a "Validar entrada", escanea el QR con la cámara (API nativa `BarcodeDetector`, si el navegador la soporta) o pega el código a mano, y `validar_entrada()` marca esa butaca como usada. Si se intenta validar de nuevo, se rechaza.

## Roles

`profiles.rol` puede ser `cliente`, `empleado` o `administrador`. Un usuario nuevo siempre arranca como `cliente`; los otros roles se asignan a mano desde el SQL Editor de Supabase (no hay una pantalla para eso, a propósito: es una operación sensible y poco frecuente).

```sql
update profiles set rol = 'administrador' where id = (select id from auth.users where email = 'mail@ejemplo.com');
```

## Decisiones y supuestos

Los mails del cliente (la consigna del TP) tienen varios puntos ambiguos o contradictorios. Las decisiones tomadas para resolverlos, junto con el detalle de requerimientos, están en [`docs/requerimientos.md`](docs/requerimientos.md) (sección 6).

Otras decisiones técnicas, además de las de la tabla de arriba:

- **Reactive Forms en vez de Signal Forms** (`@angular/forms/signals`): esta última es una API muy nueva de Angular; con Reactive Forms se pueden usar validadores sincrónicos propios (como se vio en clase) y queda más fácil de defender.
- **Pago simulado**: el cliente nunca definió un medio de pago; no hay pasarela real.
- **PDF y QR generados en el navegador**: evita tener que armar un backend propio solo para eso.

## Qué falta

- Candy bar, cupones, puntos de fidelización, cancelación con crédito y reportes de facturación: quedaron para después de tener el circuito principal (cartelera → compra → validación) funcionando de punta a punta.
- PWA y despliegue.
