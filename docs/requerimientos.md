# Documento de requerimientos — Sistema de venta de entradas "CineMoran"

**Materia:** Programación IV — TP 1 (2026 C2)
**Alumna:** Nadia Moran
**Cliente:** Empresario Importante (cine de un solo edificio con varias salas)
**Fuente:** intercambio de 10 mails (01/01/2020 al 10/03/2020) + consigna del TP
**Última actualización:** 04/10/2026 — se agregó el estado de implementación de cada requerimiento (sección 9)

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
| RF-28 | El **cupón** se aplica como **descuento** sobre la compra, y el **crédito** de la cuenta se puede usar como parte del pago, **junto con otros métodos de pago**. Los puntos no son un medio de pago: se canjean por recompensas (RF-41). | 30/01, 10/03 | A |
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
| RNF-02 | **Fechas y horas:** el cliente **no quiere el calendario desplegable** (manda una imagen como ejemplo de lo que no quiere): pide una forma de cargar fechas y horas que no haga perder tiempo buscando y **sin scroll excesivo**. | 28/02 |
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

## 5. Modelo de datos

Tablas que existen hoy en Supabase (creadas por `supabase/schema.sql` y las migraciones 001 a 027):

| Tabla | Para qué |
|---|---|
| `profiles` | Datos del registro, rol (`cliente` / `empleado` / `administrador`), puntos acumulados y crédito disponible. El cliente solo puede modificar sus datos personales: rol, puntos y crédito los cambian funciones de la base |
| `peliculas` | Nombre, imagen, sinopsis, duración, géneros (`text[]`), restricción de edad, fecha de estreno, estado (`en_cartelera` / `proximamente` / `baja`), ventas (entradas vendidas, las mantienen triggers) y descuento de preventa en pesos (vacío = sin preventa) |
| `resenas` | Una reseña por usuario y película (1 a 5 estrellas + comentario) |
| `alertas_estreno` | Usuarios que pidieron aviso de una película próxima |
| `salas` | Nombre y si está habilitada para recibir funciones nuevas |
| `butacas` | Fila, bloque, número y tipo (`estandar` / `vip` / `accesible`) de cada butaca de cada sala |
| `funciones` | Película, sala asignada, inicio, fin, formato, idioma, precio estándar y precio VIP (copiados de `precios_entrada` según el formato) |
| `precios_entrada` | Tabla de precios del cine: un precio estándar y uno VIP por formato (2D, 3D, 4D, 5D). La VIP siempre es mayor |
| `ordenes` | Compra: función, usuario (o email si es anónimo), total, crédito usado, medio de pago (simulado), puntos ganados, puntos canjeados, estado y fecha de cancelación |
| `orden_butacas` | Cada butaca comprada; su id es el código del QR. Guarda cuándo y quién la validó, si se pagó con puntos y si la compra se canceló (una butaca solo puede estar en una compra vigente por función) |
| `cupones` | Cupón de bienvenida (primera compra) y cupones por edad mínima, con porcentaje configurable |
| `categorias_producto`, `productos` | Candy bar: categorías y productos (con foto y estado activo / dado de baja) |
| `combos`, `combo_productos` | Combos a precio fijo: entradas generales incluidas, productos, foto y estado |
| `orden_productos` | Productos y combos de cada compra (los canjeados con puntos van a $0 con su recompensa); guarda cuándo se retiraron en el candy bar |
| `butacas_vendidas` | Solo función + butaca de lo vendido (sin códigos ni compradores). La mantienen triggers y es la tabla que escucha Realtime |
| `creditos_movimientos` | Historial del crédito de cada usuario: + por cancelación, − por uso en una compra |
| `recompensas` | Lo que se paga con puntos y cuántos puntos cuesta: entrada general gratis (para cualquier formato o uno solo) o un producto del candy bar. La configura el admin; no se borran, se desactivan |
| `puntos_movimientos` | Historial de puntos de cada usuario (es el historial de canjes del perfil): + por compra, − por canje, y los ajustes al cancelar |
| `activity_log` | Log de actividad del personal: quién (nombre y rol), qué acción, detalle y fecha y hora. Lo llenan triggers de la base; solo el admin lo lee y nadie lo puede editar ni borrar desde la app |

Los reportes no tienen tablas propias: se calculan en el momento con tres funciones de la base (migración 027) que agrupan y suman los datos de `ordenes`, `orden_butacas`, `orden_productos` y `combo_productos`. Solo las puede usar el administrador.

Diferencias con el modelo preliminar: los géneros quedaron como un arreglo dentro de `peliculas` (no hizo falta una tabla aparte), y la recurrencia no se guarda como `programaciones`: se generan todas las funciones juntas en el momento (ver S-11).

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
| S-6 | Puntos: ¿se ganan sobre el total, o solo sobre lo pagado en dinero? | Se ganan sobre lo **pagado en dinero** (no sobre el crédito usado). | Sí |
| S-7 | Cancelación: ¿se devuelven puntos ganados? ¿y qué pasa con los combos/candy ya retirados? | Al cancelar se **revierten** los puntos ganados; no se puede cancelar si ya se validó el QR. | Sí |
| S-8 | Menores de 13 en película +13 y menores de 18 en +18: ¿pueden ir con adulto? | No pueden **comprar**; sí pueden asistir acompañados de un adulto si lo compra el adulto. | Sí |
| S-9 | "Más vendidas": ¿por entradas o por monto? | Por **cantidad de entradas** vendidas. | No |
| S-10 | Precios de entradas (estándar, VIP, preventa): el cliente no los define. | Se guardan configurables en la base; VIP = recargo sobre el precio base. | Sí |
| S-11 | Función recurrente: ¿hasta cuándo se repite? | Se define **rango de fechas** al crearla (máximo 60 días), con días de la semana y horarios. Antes de crear se muestra una **vista previa** con la sala de cada función y las que no tienen lugar. | Sí |
| S-12 | Un usuario anónimo no tiene cuenta: ¿cómo recibe el PDF? | Se pide un **email** en el checkout y se descarga el PDF en la pantalla de confirmación. | Sí |
| S-13 | Combos "entrada + pochoclos + bebida": ¿qué entrada cubren? | El combo indica cuántas **entradas generales** incluye. El cliente elige sus butacas como siempre y, si elige el combo, esas entradas no se cobran sueltas: paga solo el precio del combo. **Las butacas VIP no entran en el combo.** | No |
| S-14 | ¿Qué pasa con una función que ya tiene entradas vendidas si el admin la edita o la borra? | No se puede **eliminar**. Se puede **editar**, pero no cambia de sala (las butacas compradas son de esa sala): solo se acepta el cambio si esa sala sigue libre. | No |
| S-15 | ¿Qué pasa al deshabilitar una sala? | No recibe **funciones nuevas**; las que ya tenía programadas se mantienen. | No |
| S-16 | Dar de baja un producto o un combo. | No se borra (las compras viejas lo referencian): queda **inactivo**, no se vende y no se puede sumar a combos nuevos. | No |
| S-17 | El admin pidió elegir el género "de los ya cargados". | Los géneros disponibles se toman de las películas existentes; si hace falta uno nuevo, se agrega desde el mismo formulario. | No |
| S-18 | El mail del 06/02 pide que el admin controle "la distribución de las butacas", pero el del 01/01 dice que la forma de las salas "es siempre la misma" (20 filas, bloques de 4, 20 y 4), y los cambios posteriores (fila accesible el 12/02, filas VIP el 10/03) se pidieron para **todas** las salas a la vez. | La distribución es una **regla del negocio** y no un dato de cada sala: cada sala nueva se arma sola con esa forma (`crear_sala`). El admin controla las salas creándolas y habilitándolas / deshabilitándolas, pero no mueve butacas a mano. Así ninguna sala queda distinta de lo que definió el cliente, no se rompen las filas accesibles ni las VIP, y no desaparecen butacas con entradas ya vendidas. | No |

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

---

## 9. Estado de implementación

Referencias: ✅ implementado · 🟡 parcial · ❌ pendiente.

### 9.1 Requerimientos funcionales

| ID | Estado | Detalle |
|---|---|---|
| RF-01 | ✅ | Alta de película con nombre, duración, imagen (Supabase Storage) y sinopsis. |
| RF-02 | ✅ | Varios géneros por película, elegidos de los ya cargados (S-17). |
| RF-03 | ✅ | Sin restricción / +13 / +18. |
| RF-04 | ✅ | `peliculas.ventas` cuenta entradas vendidas (S-9) y lo mantienen triggers (migración 020): suma al comprar y resta al cancelar. La cartelera se ordena por ventas y las 3 primeras llevan la leyenda "Más vendida #1, #2, #3". |
| RF-05 | ✅ | Buscador por nombre + filtro por género (contempla varios géneros). Los filtros quedan en la URL. |
| RF-06 | ✅ | Sección Próximamente con las películas en estado "Próximamente", ordenadas por fecha de estreno. |
| RF-07 | 🟡 | Se puede activar y cancelar la alerta; todavía no se envía la notificación. |
| RF-08 | ✅ | Detalle con horarios, formato, idioma, sala, precio, reseñas y promedio. |
| RF-09 | ✅ | 1 a 5 estrellas + comentario; solo quien ya vio la película (regla en la base). |
| RF-10 | ✅ | Promedio en el detalle. |
| RF-11 | ✅ | Reseñas visibles antes de comprar. |
| RF-12 | ✅ | Sección "Mis películas" (solo clientes): una tarjeta por película vista, con póster, última fecha, cantidad de veces y su calificación en estrellas (o "Calificala"). "Vista" = compra confirmada de una función que ya empezó, igual que la regla para dejar reseña. |
| RF-13 | ✅ | Las salas se crean con `crear_sala()`: 20 filas A–T, bloques 4/20/4. |
| RF-14 | ✅ | Fila accesible 2/10/2 en lugar de J–K, con color propio en el mapa. |
| RF-15 | ✅ | Tabla de precios por formato con un monto en pesos para estándar y otro para VIP (pantalla Salas, migración 021); la VIP siempre cuesta más. Cada función toma los precios de su formato. En la compra se ve el precio de cada tipo, el total separado y un aviso destacado antes de confirmar; el PDF muestra el precio real de cada entrada. |
| RF-16 | ✅ | Pantalla Salas: alta de salas, habilitar / deshabilitar y precios de entradas por formato. La distribución de butacas es fija porque la definió el cliente para todas las salas (ver S-18). |
| RF-17 | ✅ | Alta, edición y baja de funciones (película, fecha, hora, formato, idioma, precio). |
| RF-18 | ✅ | "Programar funciones": días de la semana + horarios + período, con vista previa (S-11). |
| RF-19 | ✅ | Sala asignada por la base (`asignar_funcion`, `editar_funcion`, `programar_funciones`); nunca se superponen. |
| RF-20 | ✅ | 30 minutos de margen, calculados con la duración de la película. |
| RF-21 | ✅ | El admin asigna un **estado** a cada película: En cartelera (aparece en la cartelera), Próximamente (aparece en esa sección) o Baja (no aparece en ninguna). |
| RF-22 | ✅ | Elegir función → butacas → confirmar (pago simulado, S-2). |
| RF-23 | ✅ | Supabase Realtime: el mapa se suscribe a `butacas_vendidas` (migración 019) y marca como ocupadas, sin recargar, las butacas que compra otra persona. Si era una butaca elegida, se quita y se avisa. |
| RF-24 | ✅ | Compra anónima con email. |
| RF-25 | ✅ | Validado en Angular y en la base (`crear_orden`). |
| RF-26 | ✅ | Aviso en el detalle y en el PDF ("debe ir acompañado de un adulto"). |
| RF-27 | ✅ | PDF con una página y un QR por butaca. |
| RF-28 | ✅ | El cupón se aplica solo, como descuento. El usuario registrado puede usar su crédito al pagar: cubre hasta el total y el resto se paga con un medio simulado (tarjeta de crédito, débito o Mercado Pago, S-2), que queda registrado en la orden. Los puntos se ganan solo sobre lo pagado con dinero (S-6). Migración 024. |
| RF-29 | ✅ | Configurable por película desde Películas ("Tiene preventa" + descuento en pesos, con vista previa de precios; migración 023). La venta abre 7 días antes del estreno y hasta el día anterior se cobra con el descuento (estándar y VIP, todos los formatos); desde el estreno vuelve sola al precio normal. Lo calcula `crear_orden` según la fecha de compra. |
| RF-30 | ✅ | Productos con categoría, foto, edición y baja. |
| RF-31 | ✅ | Productos y combos en la misma compra. |
| RF-32 | ✅ | Retiro del candy bar con el mismo código (`retirar_candy`). |
| RF-33 | ✅ | Combos con entradas generales incluidas, productos, foto y precio fijo; destacados en la compra (S-13). |
| RF-34 | ✅ | Registro con todos los datos pedidos. |
| RF-35 | ✅ | Login / logout con Supabase Auth. |
| RF-36 | ✅ | Perfil con datos, puntos, crédito disponible, historial de canjes y puntos, movimientos de crédito e historial de compras (con botón para cancelar). El administrador y el empleado no tienen este perfil: van a su panel y a "Validar entrada". |
| RF-37 | ✅ | Cupón "Bienvenida" 20 % en la primera compra. |
| RF-38 | ✅ | Pantalla Cupones: cambiar porcentaje y activar / desactivar. |
| RF-39 | ✅ | Cupones por edad mínima (configurable, ej. 50). |
| RF-40 | ✅ | 1 punto por peso, solo usuarios registrados. |
| RF-41 | ✅ | Se canjea al comprar (migración 025): el cliente registrado elige recompensas en la misma compra. La entrada canjeada es general (no VIP) y no se cobra; el producto va a $0 y se retira con el mismo QR. La base verifica y descuenta los puntos en la misma transacción (si no alcanzan, no se crea nada) y los registra en el historial. Si se cancela la compra, se devuelven. |
| RF-42 | ✅ | Pantalla Recompensas del admin: entrada gratis (cualquier formato o uno solo, ej. "Entrada 2D" 500 pts) o producto del candy bar, con sus puntos editables y activar / desactivar. |
| RF-43 | ✅ | No existe ninguna operación que mueva puntos entre usuarios: solo los suman las compras y los restan los canjes propios, siempre desde funciones de la base. |
| RF-44 a RF-47 | ✅ | `cancelar_orden` (migración 024): solo el dueño registrado, hasta 2 h antes y si no se validó ninguna entrada ni se retiró el candy (S-7). Acredita el total como crédito (nunca dinero) con su movimiento, descuenta los puntos ganados, libera las butacas en tiempo real para volver a venderse y el QR deja de valer. |
| RF-48 | ✅ | Pantalla "Validar entrada" (cámara o código) y "Retirar candy bar". La entrada solo se acepta desde 1 h antes del inicio hasta que termina la función (migración 022). El empleado entra directo a esta pantalla al iniciar sesión. |
| RF-49 | ✅ | Ingreso manual del código. |
| RF-50 | ✅ | Una vez validada o retirada, el código se rechaza. También se rechaza el código de una compra cancelada, tanto para la entrada como para el candy (022). |
| RF-51 | ✅ | Panel de administración con acceso a Películas, Funciones, Salas, Productos, Combos, Cupones, Recompensas, Actividad y Validar entrada. |
| RF-52 | ✅ | Pantalla Reportes del admin: facturación por día y entradas vendidas (compras confirmadas, por día de compra; las canceladas no cuentan), con período elegido por atajos (últimos 7 días, 30 días o este mes) y totales. Lo calcula la base (migración 027). |
| RF-53 | ✅ | El reporte de facturación se exporta a PDF (jsPDF) y a Excel (.xlsx con SheetJS). |
| RF-54 | ✅ | Gráficos de barras (HTML y CSS) de las películas más vistas (entradas vendidas para funciones de la semana o del mes) y de los productos más vendidos (sueltos, en combos y canjeados). |
| RF-55 | ✅ | Pantalla Actividad del admin (migración 026): registra quién creó, editó o eliminó una función, quién modificó un precio (tabla de entradas, preventa, productos y combos, con antes → ahora) y quién validó una entrada o entregó el candy bar, con fecha y hora. Lo registran triggers de la base, así no se puede saltear desde el navegador; solo el admin lo lee y nadie lo puede editar ni borrar. Filtro por tipo. |

### 9.2 Requerimientos no funcionales

| ID | Estado | Detalle |
|---|---|---|
| RNF-01 | ✅ | Pantallas de admin con el mismo patrón: listado + botón "Nuevo" + formulario que se abre arriba. |
| RNF-02 | ✅ | No queda ningún calendario: todas las fechas usan un componente propio (`selector-fecha`) con día y mes en desplegables cortos, el año en un desplegable o escrito, y atajos con los próximos 14 días en las fechas de funciones. Avisa si la fecha no existe (ej. 31/02). "Programar funciones" suma chips de días, de horarios y atajos de período. La hora se escribe directo. |
| RNF-03 | ✅ | Estética propia (tema oscuro, dorado, tipografía de marquesina). |
| RNF-04 | ✅ | Angular standalone, signals, zoneless, Reactive Forms, guards, lazy loading. |
| RNF-05 | ✅ | Base de datos, Auth, Storage, funciones SQL y Realtime (RF-23). |
| RNF-06 | ✅ | Manifest + service worker. |
| RNF-07 | ✅ | Firebase Hosting (https://cine-moran.web.app), GitHub y README. |
| RNF-08 | ✅ | RLS y funciones `security definer` en la base. |
| RNF-09 | ✅ | `unique(funcion_id, butaca_id)` y compra en una sola transacción. |
| RNF-10 | ✅ | Diseño adaptado a celular (pantallas de hasta 760px): menú con botón ☰, menú lateral de admin que pasa arriba, mapa de butacas que se desplaza de costado sin desalinearse y con la letra de fila fija, dos películas por fila en la cartelera, listados de admin y tabla de precios que se acomodan, y "Validar entrada" con botones grandes a todo el ancho y la cámara a pantalla completa (es la que usa el empleado desde el celular). |
