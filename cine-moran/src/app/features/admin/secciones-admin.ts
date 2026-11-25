// Cada sección del panel de admin y el permiso que hace falta para entrar.
// Un rol personalizado es una lista de estos permisos (migración 032).
// 'admin' = solo el administrador (roles y usuarios no se pueden delegar).
export type Permiso =
  | 'peliculas'
  | 'funciones'
  | 'salas'
  | 'productos'
  | 'combos'
  | 'cupones'
  | 'recompensas'
  | 'reportes'
  | 'actividad'
  | 'propuestas'
  | 'validar';

export interface SeccionAdmin {
  ruta: string;
  texto: string;
  detalle: string;
  permiso: Permiso | 'admin';
}

export const GRUPOS_ADMIN: { titulo: string; secciones: SeccionAdmin[] }[] = [
  {
    titulo: 'Programación',
    secciones: [
      { ruta: '/admin/crear-pelicula', texto: 'Películas', detalle: 'Altas, géneros y estado', permiso: 'peliculas' },
      { ruta: '/admin/crear-funcion', texto: 'Funciones', detalle: 'Programar, editar y cancelar', permiso: 'funciones' },
      { ruta: '/admin/salas', texto: 'Salas', detalle: 'Nuevas salas y habilitación', permiso: 'salas' },
      { ruta: '/admin/propuestas', texto: 'Propuestas', detalle: 'Películas que piden los clientes', permiso: 'propuestas' },
    ],
  },
  {
    titulo: 'Candy bar',
    secciones: [
      { ruta: '/admin/crear-producto', texto: 'Productos', detalle: 'Candy bar, categorías y fotos', permiso: 'productos' },
      { ruta: '/admin/crear-combo', texto: 'Combos', detalle: 'Entrada + candy a precio fijo', permiso: 'combos' },
    ],
  },
  {
    titulo: 'Clientes',
    secciones: [
      { ruta: '/admin/cupones', texto: 'Cupones', detalle: 'Descuentos y porcentajes', permiso: 'cupones' },
      { ruta: '/admin/recompensas', texto: 'Recompensas', detalle: 'Canje de puntos', permiso: 'recompensas' },
    ],
  },
  {
    titulo: 'Control',
    secciones: [
      { ruta: '/admin/reportes', texto: 'Reportes', detalle: 'Facturación y rankings', permiso: 'reportes' },
      { ruta: '/admin/actividad', texto: 'Actividad', detalle: 'Funciones, precios y validaciones', permiso: 'actividad' },
      { ruta: '/admin/validar', texto: 'Validar entrada', detalle: 'QR o código manual', permiso: 'validar' },
    ],
  },
  {
    titulo: 'Accesos',
    secciones: [
      { ruta: '/admin/roles', texto: 'Roles', detalle: 'Crear roles con permisos', permiso: 'admin' },
      { ruta: '/admin/usuarios', texto: 'Usuarios', detalle: 'Asignar un rol a cada usuario', permiso: 'admin' },
    ],
  },
];

// los permisos que se pueden darle a un rol (sin 'admin')
export const PERMISOS: { clave: Permiso; texto: string }[] = GRUPOS_ADMIN.flatMap((grupo) =>
  grupo.secciones
    .filter((seccion) => seccion.permiso !== 'admin')
    .map((seccion) => ({ clave: seccion.permiso as Permiso, texto: seccion.texto })),
);
