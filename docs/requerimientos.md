# Documento de requerimientos — Sistema de venta de entradas "CineMoran"

**Materia:** Programación IV — TP 1 (2026 C2)
**Alumna:** Nadia Moran
**Cliente:** Empresario Importante (cine de un solo edificio con varias salas)
**Fuente:** intercambio de 10 mails (01/01/2020 al 10/03/2020) + consigna del TP

---

## 1. Introducción

### 1.1 Objetivo
Construir una aplicación web para un cine donde los clientes puedan comprar entradas (y productos del candy bar) online, recibir un PDF con un QR, y donde el personal pueda administrar el cine y validar entradas.

### 1.2 Alcance
Incluye: cartelera, compra de entradas con selección de butacas en tiempo real, candy bar y combos, cupones, puntos de fidelización, reseñas, preventa, cancelaciones con crédito, panel de administración, validación de QR, reportes y log de actividad.

No incluye (ver 6): pasarela de pago real, y el mapa del cine (el cliente todavía no dio luz verde).

### 1.3 Roles

| Rol | Descripción |
|---|---|
| **Visitante / comprador anónimo** | Ve la cartelera y puede comprar sin registrarse, siempre que pague. No obtiene cupón ni puntos. |
| **Usuario registrado** | Tiene perfil, cupón de bienvenida, puntos, crédito, historial y reseñas. |
| **Administrador** | Controla salas, funciones, butacas, productos, combos, cupones, recompensas, reportes y log. |
| **Empleado** | Solo escanea/valida QR (cine y candy bar). Puede ingresar el código a mano. |

---

## 2. Requerimientos funcionales

Prioridad: **A** = imprescindible (lo pidió el cliente y define el sistema), **M** = importante, **B** = deseable / si da el tiempo.
"Mail" indica en qué mensaje del cliente aparece el requerimiento.

### 2.1 Cartelera y películas (público)

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-01 | Toda película tiene: nombre, duración, imagen y sinopsis. | 01/01 | A |
| RF-02 | Cada película tiene uno o más **géneros**. | 16/01 | A |
| RF-03 | Cada película tiene **restricción de edad**: sin restricción, +13 o +18. | 12/02 | A |
| RF-04 | La página principal muestra primero las **3 películas más vendidas**. | 16/01 | A |
| RF-05 | El listado de películas tiene **buscador** por nombre y **filtro por género** (una película puede tener varios; el filtro debe contemplarlo). | 16/01 | A |
| RF-06 | Sección **Próximamente** con películas que se estrenan en las próximas semanas. | 08/03 | M |
| RF-07 | El usuario registrado puede **activar una alerta** en una película próxima y recibir una notificación cuando se abra la venta. | 08/03 | M |
| RF-08 | El detalle de película muestra sus funciones (horario, formato 2D/3D/4D/5D, idioma), reseñas y **puntuación promedio**, **antes** de sacar entradas. | 16/01 | A |

### 2.2 Reseñas

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-09 | Un usuario califica una película con **1 a 5 estrellas** y un **comentario corto**. | 16/01 | A |
| RF-10 | Se muestra el **promedio** de estrellas por película. | 16/01 | A |
| RF-11 | Las reseñas son visibles antes de comprar entradas. | 16/01 | A |
| RF-12 | Sección **"Mis películas"**: historial visual de lo que vio el usuario (póster, fecha, su calificación). | 08/03 | M |

### 2.3 Salas, butacas y funciones

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-13 | Cada sala tiene **20 filas (A–T)** y **3 columnas** (bloques) de **4, 20 y 4** butacas. | 01/01 | A |
| RF-14 | Las filas **J y K** se reemplazan por una **fila de butacas accesibles** con **2, 10 y 2** butacas por columna. Se resaltan visualmente distinto. | 12/02 | A |
| RF-15 | Las filas **R, S y T** son **VIP**: precio mayor y marca visual distinta en el mapa. Antes de pagar, el usuario debe ver claramente que compra VIP. | 10/03 | A |
| RF-16 | El admin puede controlar salas y la **distribución de butacas**. | 06/02 | M |
| RF-17 | El admin crea/edita **funciones**: película, horario, formato (2D/3D/4D/5D), idioma (castellano/subtitulada). | 01/01 | A |
| RF-18 | Una función puede ser **recurrente** (ej.: lunes, martes y viernes a las 18 hs). | 06/02 | A |
| RF-19 | La **sala se asigna automáticamente** por el sistema. En ningún caso dos funciones pueden solaparse en la misma sala. | 06/02 | A |
| RF-20 | Entre el fin de una función y el inicio de la siguiente en la misma sala debe haber **al menos 30 minutos** (se calcula con la duración de la película). | 01/01 | A |
| RF-21 | El admin elige **qué películas aparecen** en la página de inicio. | 01/01 | A |

### 2.4 Compra de entradas

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-22 | El cliente elige función, selecciona butacas y paga. | 01/01 | A |
| RF-23 | La disponibilidad de butacas se muestra en **tiempo real**: mientras un usuario elige, ve las ocupadas por otras compras en ese momento. | 12/02 | A |
| RF-24 | Se puede comprar **sin registrarse** (anónimo), siempre que se pague. | 01/01 | A |
| RF-25 | Se bloquea la compra de películas +13 / +18 a usuarios menores de esa edad. | 12/02 | A |
| RF-26 | Toda entrada de película con restricción debe **aclarar que debe asistir un adulto**. | 12/02 | A |
| RF-27 | Al confirmar la compra se genera un **PDF** con los datos de la entrada y un **QR**. | 01/01 | A |
| RF-28 | Se puede aplicar **cupón** y/o **puntos/crédito** como medio de pago junto con otros medios. | 30/01, 10/03 | A |
| RF-29 | **Preventa:** la venta se abre 7 días antes del estreno con precio especial; pasada la fecha vuelve al precio normal. Configurable **por película**. | 08/03 | M |

### 2.5 Candy bar y combos

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-30 | El admin crea **productos** del candy bar (pochoclos, bebidas, etc.) y los agrupa en **categorías**. | 30/01 | A |
| RF-31 | El cliente puede comprar productos **junto con la entrada**. | 30/01 | A |
| RF-32 | Con el **mismo QR** se retiran los productos. | 30/01 | A |
| RF-33 | **Combos** (entrada + pochoclos + bebida) a precio fijo configurable por el admin, **destacados** en la página de compra. | 03/03 | M |

### 2.6 Usuarios y registro

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-34 | Registro con: **email, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos y cantidad de días de vacaciones por año**. | 01/01 | A |
| RF-35 | Inicio y cierre de sesión. | (implícito) | A |
| RF-36 | Perfil con datos, **puntos**, historial de canjes, **crédito** e historial de compras. | 03/03, 10/03 | M |

### 2.7 Cupones

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-37 | Al registrarse, el usuario recibe un **cupón del 20 %** para su primera compra. | 01/01 | A |
| RF-38 | El admin puede **cambiar ese porcentaje** cuando quiera. | 30/01 | A |
| RF-39 | El admin crea **cupones exclusivos para mayores de 50 años**. | 30/01 | M |

### 2.8 Fidelización (puntos)

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-40 | Solo el usuario registrado acumula **1 punto por cada peso gastado**. | 03/03 | M |
| RF-41 | Los puntos se **canjean** por entradas gratis o productos del candy bar. | 03/03 | M |
| RF-42 | El admin configura **cuántos puntos cuesta** cada recompensa (ej.: entrada = 500, pochoclo grande = 150). | 03/03 | M |
| RF-43 | Los puntos **no se transfieren** entre usuarios. | 03/03 | M |

### 2.9 Cancelaciones y crédito

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-44 | El usuario puede **cancelar** una compra hasta **2 horas antes** de la función. | 10/03 | M |
| RF-45 | No hay reembolso en dinero: se le acredita **crédito** en su cuenta. | 10/03 | M |
| RF-46 | El crédito se ve en el perfil y se puede usar **junto con otros métodos de pago**. | 10/03 | M |
| RF-47 | Una entrada cancelada libera las butacas y su QR deja de ser válido. | (derivado) | M |

### 2.10 Validación de QR (empleados)

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-48 | Usuarios **empleado** escanean QR para validar **entradas** (cine) y **retiro de comida** (candy bar). | 06/02 | A |
| RF-49 | Se puede **ingresar el código a mano** si el lector falla. | 06/02 | A |
| RF-50 | Una vez validada la entrada o entregada la comida, el **QR deja de funcionar**. | 06/02 | A |

### 2.11 Administración, reportes y auditoría

| ID | Requerimiento | Mail | Prior. |
|---|---|---|---|
| RF-51 | Usuario **administrador** con control de salas, funciones, butacas, productos, etc. | 06/02 | A |
| RF-52 | **Reporte de facturación**: cuánto se facturó por día y cuántas entradas se vendieron. | 28/02 | M |
| RF-53 | **Exportar** el reporte a **PDF** y a **Excel**. | 10/03 | M |
| RF-54 | **Gráficos:** películas más vistas por semana y por mes; producto del candy bar más vendido. | 10/03 | M |
| RF-55 | **Log de actividad:** quién creó qué función, quién modificó un precio, quién validó un QR, con fecha y hora. | 10/03 | M |

---

## 3. Requerimientos no funcionales

| ID | Requerimiento | Fuente |
|---|---|---|
| RNF-01 | **Usabilidad:** interfaces fáciles de navegar y entender, tanto para clientes como para empleados. | 28/02 |
| RNF-02 | **Fechas y horas:** usar selectores simples (calendario, selector de hora) en vez de campos que hagan perder tiempo; **evitar el scroll excesivo**. | 28/02 |
| RNF-03 | **Estilo visual único y producido** (no un template genérico). | Consigna |
| RNF-04 | Aplicación **Angular** con buenas prácticas y las técnicas vistas en clase. | Consigna |
| RNF-05 | **Integración con Supabase** (base de datos, auth, storage y realtime). | Consigna |
| RNF-06 | **PWA** (instalable, manifest, service worker). | Consigna |
| RNF-07 | Aplicación **desplegada con URL funcional**; código en **GitHub**; **README** con arquitectura y decisiones técnicas. | Consigna |
| RNF-08 | **Seguridad:** las reglas de acceso (admin/empleado/cliente) se aplican en la base (RLS) y no solo en el front. Los datos de tipo de sangre, color de ojos, etc. son personales y deben estar protegidos. | Derivado |
| RNF-09 | **Consistencia:** dos personas no pueden comprar la misma butaca; una compra se confirma completa o no se confirma. | Derivado |
| RNF-10 | **Diseño responsive** (uso desde el celular, sobre todo empleados y clientes). | Derivado |

---

## 4. Reglas de negocio (resumen)

1. Sala: 20 filas A–T, 3 bloques (4 / 20 / 4). Filas J–K reemplazadas por una fila accesible (2 / 10 / 2). Filas R, S, T = VIP.
2. En una misma sala, **no puede haber solapamiento** de funciones y debe haber **≥ 30 min** entre el fin de una y el inicio de otra (fin = inicio + duración de la película).
3. El sistema **asigna la sala automáticamente** buscando una sala libre para todo el horario (y para todas las repeticiones de una función recurrente).
4. Comprar sin cuenta está permitido; sin cuenta **no hay cupón, puntos ni crédito**.
5. Cupón de bienvenida: % configurable, **una sola vez**, en la primera compra.
6. Cupón para mayores de 50: solo lo puede usar quien cumpla la condición de edad.
7. Restricción de edad: se calcula con la fecha de nacimiento. Un menor no puede comprar entradas de películas +13/+18 (según corresponda). Toda entrada de película restringida indica que debe ir un adulto.
8. Puntos: 1 punto por peso **efectivamente pagado** (ver supuestos), no transferibles, canjeables según la tabla de recompensas del admin.
9. Cancelación: hasta 2 h antes del inicio de la función; genera crédito por el monto pagado; libera butacas; invalida QR.
10. Un QR se puede usar **una sola vez** para el cine y **una sola vez** para el candy bar.
11. Preventa: desde 7 días antes del estreno hasta la fecha de estreno, con precio especial por película.
12. Toda acción sensible del personal (crear función, modificar precio, validar QR) queda registrada con usuario, fecha y hora.

---

## 5. Modelo de datos preliminar (entidades)

`profiles` (usuario + rol) · `peliculas` · `generos` / `pelicula_generos` · `salas` · `butacas` (tipo: estándar / VIP / accesible) · `funciones` (película, sala, inicio, formato, idioma, precio) · `programaciones` (recurrencia) · `entradas` / `ordenes` · `orden_butacas` · `productos` · `categorias_producto` · `combos` · `orden_items` · `cupones` · `resenas` · `alertas_estreno` · `puntos_movimientos` · `recompensas` · `creditos_movimientos` · `activity_log`.

---

## 6. Supuestos, decisiones y puntos a confirmar con el cliente

Estos puntos son ambiguos o se contradicen en los mails. Dejarlos escritos sirve para justificar decisiones en la defensa oral.

| # | Situación en los mails | Decisión adoptada | A confirmar |
|---|---|---|---|
| S-1 | El mail del 12/02 dice que se quitan las filas J y K "para dar espacio a **una** fila accesible" (2/10/2), pero después habla de "filas J y K adaptadas". | Se modela **una sola fila accesible** con 2/10/2 butacas en el lugar de J–K. | Sí |
| S-2 | Pago: el cliente dice "siempre que paguen", pero no nombra medio de pago. | Pago **simulado** (sin pasarela real); se registra el método elegido. | Sí |
| S-3 | "Mapa de todo el cine" no tiene luz verde. | **Fuera de alcance**; opcional al final. | No |
| S-4 | Alertas de "Próximamente": no se aclara el canal de notificación. | Notificación **dentro de la app** (y push de PWA si da el tiempo). | Sí |
| S-5 | El cupón de bienvenida y los de mayores de 50: ¿se acumulan? | **No se acumulan**: una compra usa un solo cupón. | Sí |
| S-6 | Puntos: ¿se ganan sobre el total, o solo sobre lo pagado en dinero? | Se ganan sobre lo **pagado en dinero** (no sobre puntos/crédito usados). | Sí |
| S-7 | Cancelación: ¿se devuelven puntos ganados? ¿y qué pasa con los combos/candy ya retirados? | Al cancelar se **revierten** los puntos ganados; no se puede cancelar si ya se validó el QR. | Sí |
| S-8 | Menores de 13 en película +13 y menores de 18 en +18: ¿pueden ir con adulto? | No pueden **comprar**; sí pueden asistir acompañados de un adulto si lo compra el adulto. | Sí |
| S-9 | "Más vendidas": ¿por entradas o por monto? | Por **cantidad de entradas** vendidas. | No |
| S-10 | Precios de entradas (estándar, VIP, preventa): el cliente no los define. | Se guardan configurables en la base; VIP = recargo sobre el precio base. | Sí |
| S-11 | Función recurrente: ¿hasta cuándo se repite? | Se define **rango de fechas** al crearla. | Sí |
| S-12 | Un usuario anónimo no tiene cuenta: ¿cómo recibe el PDF? | Se pide un **email** en el checkout y se descarga el PDF en la pantalla de confirmación. | Sí |

---

## 7. Priorización y plan de entrega

| Etapa | Contenido | Requerimientos |
|---|---|---|
| **1 — Base** | Auth, roles, catálogo, buscador y filtro por género, detalle, reseñas | RF-01 a 05, 08 a 11, 34, 35, 51 |
| **2 — Núcleo del negocio** | Salas y butacas, funciones con asignación automática, selección de butacas en tiempo real, compra, PDF + QR, restricción de edad | RF-13 a 15, 17 a 20, 22 a 27 |
| **3 — Operación** | Panel admin, validación de QR (empleado), candy bar, cupones | RF-28, 30 a 32, 37 a 39, 48 a 50 |
| **4 — Valor agregado** | Puntos, combos, crédito y cancelación, reportes y log | RF-33, 36, 40 a 47, 52 a 55 |
| **5 — Extras** | Próximamente y alertas, preventa, "Mis películas" | RF-06, 07, 12, 29 |
| **6 — Cierre** | PWA, despliegue, README, ensayo de defensa | RNF-06, RNF-07 |

---

## 8. Trazabilidad con la consigna

| Consigna | Dónde se cubre |
|---|---|
| Documento de requerimientos | Este documento |
| Aplicación con los temas vistos en clase | Sección 3 (RNF-04/05/06), etapas 1–5 |
| Defensa oral | Sección 6 (supuestos y decisiones) |
| App desplegada + GitHub + README | RNF-07, etapa 6 |
