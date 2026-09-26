# Mapa: temas vistos en clase → CineMoran

Fuente: repo de la cátedra (`acostaamericonicolas/Progra4`, carpeta `A342-2-main`). La consigna pide usar "todos los temas vistos en clase" y defender las decisiones, así que este mapa sirve de guía de trabajo y de machete para la defensa.

Última revisión completa: 2026-09-26.

Estado: ✅ ya lo usás · 🟡 lo usás a medias · ❌ falta · ⚠️ lo usás distinto a la clase (hay que poder justificarlo)

## 1. Temas de clase

| Carpeta de clase | Tema | Dónde encaja en el TP | Estado |
|---|---|---|---|
| `clase1` | Componentes standalone, interpolación, `@if` / `@for`, signals | Todo el front | ✅ |
| `inputOutput` | `input()`, `output()` | `TarjetaPeliculaComponent` (input.required) y `ButacaComponent` (input + output, usado en el mapa de sala) | ✅ |
| `directivas` | Directiva de atributo (`HostListener`, `Renderer2`) | `appButacaTipo` | ✅ |
| `directivas` | Directiva estructural (`TemplateRef`, `ViewContainerRef`) | Falta una **estructural por rol** (`*appRol="'administrador'"`), igual que `appAdmin` de clase. Hoy el nav oculta botones a mano con `@if` | ❌ |
| `pipes` | Pipe propio | `duracion` | ✅ |
| `pipes` | Pipe de filtrado (`filtro-pipe`) | El buscador de la cartelera filtra con un `computed()`, no con un pipe. Se puede dejar así (es válido) o pasar a un pipe `filtro` como el de clase, para tener los dos enfoques | 🟡 |
| `rutas` | `loadComponent` (lazy), parámetros, `**` | Todas las rutas | ✅ |
| `rutas` | Rutas hijas, `queryParams` | `/admin/crear-pelicula` y `/admin/crear-funcion` son rutas planas, no hijas de `/admin`. El buscador no usa `queryParams` (se pierde el filtro al recargar) | ❌ |
| `guards` | `canActivate` | `adminGuard` en las 2 rutas de admin | ✅ |
| `guards` | `canActivate` (solo sesión) | `authGuard` existe (`core/guards/auth.guard.ts`) pero **no lo usa ninguna ruta todavía** — queda listo para el día que exista `/perfil` o `/mis-peliculas` | 🟡 |
| `guards` | `canActivateChild`, `canMatch`, `canDeactivate` | Ninguno implementado. `canActivateChild` encaja si `/admin` pasa a tener rutas hijas; `canDeactivate` en "crear función"/"crear película" para avisar si hay cambios sin guardar | ❌ |
| `clase-formularios` | Reactive Forms, validadores sincrónicos y asincrónicos | Los 4 formularios (login, registro, crear película, reseña) ya usan `FormGroup`/`FormControl`. Validador sincrónico propio: `fechaNoFuturaValidator`. Todavía no hay ningún validador **asincrónico** (ej: contra Supabase) | 🟡 |
| `ejemploSupabase` | `createClient`, `signUp`, `signInWithPassword`, `from().select/insert/update` | `SupabaseService` + servicios por feature | ✅ |
| `modulos` | `NgModule` clásico | Angular actual usa standalone. Alcanza con explicar la diferencia en la defensa | — |

## 2. Cosas de tu proyecto que se apartan de la clase

### 2.1 `SupabaseService` central
En clase cada servicio hace su propio `createClient(...)`. Vos tenés **un único cliente** compartido: una sola sesión de auth, una sola conexión de Realtime cuando llegue, una sola configuración. Es mejor y conviene conservarlo así.

### 2.2 Zoneless (`provideZonelessChangeDetection`)
Sirve para explicar por qué todo el estado que cambia en pantalla usa signals (si mutaras una variable común sin signal, la vista no se actualizaría sola).

## 3. Lo que NO se vio en clase pero el cliente exige (justificar en la defensa)

| Necesidad | Estado | Herramienta |
|---|---|---|
| Asignación automática de sala, sin superposición ni menos de 30 min entre funciones | ✅ hecho | Función SQL `asignar_funcion()` (`supabase/migraciones/003_funciones.sql`), corre en la base, no se puede saltear desde el front |
| Reglas de acceso (admin/empleado/cliente) | ✅ hecho | RLS + funcion `tiene_rol()` (`supabase/migraciones/001_...sql`) |
| Butacas en tiempo real | ❌ falta | Supabase Realtime sobre la tabla que registre qué butacas están tomadas por una compra en curso |
| Consistencia al comprar la misma butaca | ❌ falta | Función SQL/RPC con restricción `unique` para que dos compras no tomen la misma butaca en la misma función |
| PDF con QR | ❌ falta | `qrcode` + `jspdf`, generados en el navegador |
| Escaneo de QR + código a mano | ❌ falta | `html5-qrcode` o `BarcodeDetector`, con un input de respaldo |
| Exportar PDF/Excel + gráficos | ❌ falta | `jspdf-autotable`, `xlsx` (SheetJS), `chart.js` |
| PWA | ❌ falta | `ng add @angular/pwa` |

## 4. Bugs reales encontrados en la revisión del 2026-09-26

Estos no tienen que ver con "temas de clase", son errores que estaban en el código y ya se corrigieron:

1. **El menú de navegación nunca se veía.** `NavComponent` estaba importado en `app.ts` pero nunca puesto en `app.html` ni agregado al array `imports` del componente. Se agregó `<app-nav />` antes del `<router-outlet />`.
2. **Los estilos globales no se aplicaban a nada.** `app.css` es el `styleUrl` de `AppComponent`, y ese componente solo tiene `<router-outlet/>` en su plantilla. Con la encapsulación por defecto de Angular, ninguna de esas reglas (formularios, botones, colores de butacas, tarjetas) llegaba a los elementos reales, porque esos se renderizan dentro de las rutas, no dentro de `AppComponent`. Se movió todo a `src/styles.css`, que sí es global.

## 5. Orden recomendado para lo que falta

1. `queryParams` en el buscador de la cartelera (rápido, un tema de clase pendiente).
2. Rutas hijas para `/admin` + `canActivateChild`.
3. Guard de empleado (`canMatch`, para la futura validación de QR).
4. `canDeactivate` en los formularios de admin.
5. Directiva estructural `*appRol`.
6. Un validador asincrónico contra Supabase (ej: al crear una función, que no se pueda repetir exactamente el mismo horario+película).
7. Después de esto, seguir con el núcleo de negocio que falta: compra de entradas, PDF+QR, candy bar.
