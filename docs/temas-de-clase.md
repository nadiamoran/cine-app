# Mapa: temas vistos en clase → CineMoran

Fuente: repo de la cátedra (`acostaamericonicolas/Progra4`, carpeta `A342-2-main`). La consigna pide usar "todos los temas vistos en clase" y defender las decisiones, así que este mapa sirve de guía de trabajo y de machete para la defensa.

Estado: ✅ ya lo usás · 🟡 lo usás a medias · ❌ falta · ⚠️ lo usás distinto a la clase (hay que poder justificarlo)

## 1. Temas de clase

| Carpeta de clase | Tema | Dónde encaja en el TP | Estado |
|---|---|---|---|
| `clase1` | Componentes standalone, interpolación, `@if` / `@for`, signals | Todo el front | ✅ |
| `rutas` | `loadComponent` (lazy), rutas hijas, `**`, parámetros y `queryParams` | Ya usás lazy, `:id` y `**`. Faltan **rutas hijas** (`/admin/...`, `/perfil/...`) y **queryParams** (`/?genero=terror&q=matrix` para el buscador) | 🟡 |
| `inputOutput` | `input()`, `output()`, `model()`, `@Input`/`@Output` | Componentes chicos reutilizables: `tarjeta-pelicula`, `butaca` (emite la selección al `mapa-sala`), `estrellas` (`model()` para calificar), `resumen-compra` | ❌ |
| `directivas` | Directiva de atributo (`HostListener`, `Renderer2`), directiva estructural (`TemplateRef`, `ViewContainerRef`) | `appButacaTipo` ya está ✅. Falta una **estructural por rol** (`*appRol="'administrador'"`) para mostrar u ocultar botones, igual que `appAdmin` de clase | 🟡 |
| `pipes` | Pipe propio (`nombre-pipe`), pipe de filtrado (`filtro-pipe`) | `duracion` ya está ✅. El **buscador** debería usar un pipe de filtro como el de clase (`filtro`), más un pipe `moneda`/`puntos` | 🟡 |
| `guards` | `canActivate`, `canActivateChild`, `canMatch`, `canDeactivate` | `adminGuard` ✅. Faltan: guard de **empleado** (`canMatch` por rol, como `roleGuard`), `canActivateChild` para todo `/admin`, y **`canDeactivate`** en checkout y en "crear función" (avisar si hay cambios sin guardar, como `formGuard`) | 🟡 |
| `clase-formularios` | **Reactive Forms**: `FormGroup`, `FormControl`, validadores **sincrónicos** y **asincrónicos**, `updateOn: 'blur'` | Registro y login. Validadores propios sugeridos: contraseñas coinciden (sync), mayoría de edad para la película (sync), **cupón válido** o **email ya registrado** (async, contra Supabase) | ⚠️ |
| `ejemploSupabase` | `createClient`, `signUp`, `signInWithPassword`, `from().select/insert/update` | `SupabaseService` + servicios por feature | ✅ (ver nota 2.2) |
| `ejemploInputOutput`, `directivas`, `pipes` | Servicios + `HttpClient` | Solo si consumís una API externa (por ejemplo, imágenes o datos de películas). No es imprescindible | ❌ opcional |
| `modulos` | `NgModule` clásico | Angular actual usa standalone. Alcanza con poder explicar la diferencia en la defensa | — |

## 2. Cosas de tu proyecto que se apartan de la clase

Nada de esto está mal, pero el profesor lo puede preguntar. Tenés que poder responder **por qué**.

### 2.1 Signal Forms (`@angular/forms/signals`) en lugar de Reactive Forms
- Tus 4 formularios (login, registro, crear película, reseñas) usan la API nueva. En clase se vio Reactive Forms con validadores propios.
- **Recomendación:** pasar los formularios a Reactive Forms. La consigna dice "las técnicas vistas en clase", los validadores sync/async de clase encajan justo en el negocio (edad, cupón, email), y evitás defender una API muy nueva. Son pocos formularios.
- Si preferís dejarlos, la defensa es: "ya que usé signals en todo el proyecto, los formularios con signals mantienen un solo modelo mental". Pero exponés el riesgo de que sea experimental.

### 2.2 `SupabaseService` central
- En clase cada servicio hace su propio `createClient(...)`. Vos tenés **un único cliente** compartido. Es mejor: una sola sesión de auth, una sola conexión de Realtime y una sola configuración. **Conservalo** y explicalo así.

### 2.3 `@Injectable({ providedIn: 'root' })` y constructor
- En clase se usa `@Service()` e `inject()`. `@Injectable` funciona igual y es lo más común. Para uniformar con la cátedra podés cambiar a `@Service()` + `inject()`, pero no es urgente.

### 2.4 Zoneless (`provideZonelessChangeDetection`)
- Lo tenés configurado. Sirve para explicar por qué usás signals para todo el estado que cambia en pantalla (si mutás una variable común, la vista no se actualiza).

## 3. Lo que NO se vio en clase pero el cliente exige (hay que justificarlo)

| Necesidad | Herramienta sugerida | Cómo defenderlo |
|---|---|---|
| Butacas en tiempo real | **Supabase Realtime** (canal sobre la tabla de butacas/entradas) | Ya usás Supabase; evita armar un servidor de WebSockets. |
| Consistencia al comprar la misma butaca | **Función SQL/RPC** con transacción y restricción `unique(funcion_id, butaca_id)` | La validación en el front no alcanza: dos clientes podrían comprar a la vez. |
| Reglas de acceso | **RLS** (Row Level Security) en Supabase | El `adminGuard` solo oculta pantallas; la seguridad real tiene que estar en la base. |
| Subida de imágenes | **Supabase Storage** (ya lo usás) | — |
| PDF con QR | Librerías `qrcode` y `jspdf` | Se generan en el navegador, sin backend propio. |
| Escaneo de QR | `html5-qrcode` o `BarcodeDetector` + ingreso manual | Cubre el pedido de "código a mano" si falla el lector. |
| Exportar PDF / Excel + gráficos | `jspdf-autotable`, `xlsx` (SheetJS), `chart.js` | Librerías estándar; los datos salen de vistas SQL. |
| PWA | `ng add @angular/pwa` | Requisito de la consigna. |
| Asignación automática de sala | **Función SQL** (`asignar_sala`) que busca sala libre con margen de 30 min | La regla vive en la base para que no se pueda saltear desde el front. |

## 4. Orden recomendado para cubrir la clase sin perder tiempo

1. `inputOutput`: extraer `tarjeta-pelicula` y `butaca` como componentes con `input()`/`output()`.
2. `rutas`: pasar `/admin/*` a rutas hijas con `canActivateChild`, y sumar `queryParams` al buscador.
3. `guards`: `empleadoGuard` (`canMatch`) y `canDeactivate` en el checkout.
4. `directivas`: `*appRol` estructural.
5. `pipes`: `filtro` en el buscador.
6. `formularios`: migrar a Reactive Forms con validadores propios.
