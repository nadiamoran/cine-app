import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { permisoGuard } from './core/guards/permiso.guard';
import { authGuard } from './core/guards/auth.guard';
import { empleadoGuard } from './core/guards/empleado.guard';
import { confirmarSalidaGuard } from './core/guards/confirmar-salida.guard';

export const routes: Routes = [



    {
    path: '',
    loadComponent: () =>
      import('./features/catalogo/catalogo.component').then((m) => m.CatalogoComponent),
  },


  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  {
    path: 'registro',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },


   {
    path: 'pelicula/:id',
    loadComponent: () =>
      import('./features/catalogo/detalle/detalle-pelicula.component').then(
        (m) => m.DetallePeliculaComponent,
      ),
  },

    {
    path: 'proximamente',
    loadComponent: () =>
      import('./features/catalogo/proximamente/proximamente.component').then(
        (m) => m.ProximamenteComponent,
      ),
  },

  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/perfil/perfil.component').then((m) => m.PerfilComponent),
  },

  {
    path: 'mis-peliculas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/mis-peliculas/mis-peliculas.component').then(
        (m) => m.MisPeliculasComponent,
      ),
  },

  {
    path: 'notificaciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/notificaciones/notificaciones.component').then(
        (m) => m.NotificacionesComponent,
      ),
  },

  {
    path: 'proponer',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/propuestas/proponer-pelicula/proponer-pelicula.component').then(
        (m) => m.ProponerPeliculaComponent,
      ),
  },

  {
    path: 'funcion/:id',
    canDeactivate: [confirmarSalidaGuard],
    loadComponent: () =>
      import('./features/ordenes/seleccion-butacas/seleccion-butacas.component').then(
        (m) => m.SeleccionButacasComponent,
      ),
  },

  {
    // canMatch (no canActivate): si el usuario no es empleado/admin, el router
    // sigue evaluando otras rutas en vez de activar esta a medias
    path: 'empleado/validar',
    canMatch: [empleadoGuard],
    loadComponent: () =>
      import('./features/empleado/validar-entrada/validar-entrada.component').then(
        (m) => m.ValidarEntradaComponent,
      ),
  },

   {
    // agrupa todo lo de admin bajo un mismo guard: canActivateChild se fija
    // antes de entrar a CUALQUIER ruta hija, sin repetir canActivate en cada una
    path: 'admin',
    canActivateChild: [adminGuard],
    // marco común (menú lateral); cada hija se carga dentro de su <router-outlet>
    loadComponent: () =>
      import('./features/admin/layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/panel/panel-admin.component').then(
            (m) => m.PanelAdminComponent,
          ),
      },
      {
        path: 'crear-pelicula',
        canActivate: [permisoGuard],
        data: { permiso: 'peliculas' },
        loadComponent: () =>
          import('./features/admin/crear-pelicula/crear-pelicula.component').then(
            (m) => m.CrearPeliculaComponent,
          ),
      },
      {
        path: 'crear-funcion',
        canActivate: [permisoGuard],
        data: { permiso: 'funciones' },
        loadComponent: () =>
          import('./features/admin/crear-funcion/crear-funcion.component').then(
            (m) => m.CrearFuncionComponent,
          ),
      },
      {
        path: 'salas',
        canActivate: [permisoGuard],
        data: { permiso: 'salas' },
        loadComponent: () =>
          import('./features/admin/gestionar-salas/gestionar-salas.component').then(
            (m) => m.GestionarSalasComponent,
          ),
      },
      {
        path: 'cupones',
        canActivate: [permisoGuard],
        data: { permiso: 'cupones' },
        loadComponent: () =>
          import('./features/admin/gestionar-cupones/gestionar-cupones.component').then(
            (m) => m.GestionarCuponesComponent,
          ),
      },
      {
        path: 'crear-producto',
        canActivate: [permisoGuard],
        data: { permiso: 'productos' },
        loadComponent: () =>
          import('./features/admin/crear-producto/crear-producto.component').then(
            (m) => m.CrearProductoComponent,
          ),
      },
      {
        // la misma pantalla del empleado, pero dentro del marco de admin
        path: 'validar',
        canActivate: [permisoGuard],
        data: { permiso: 'validar' },
        loadComponent: () =>
          import('./features/empleado/validar-entrada/validar-entrada.component').then(
            (m) => m.ValidarEntradaComponent,
          ),
      },
      {
        path: 'reportes',
        canActivate: [permisoGuard],
        data: { permiso: 'reportes' },
        loadComponent: () =>
          import('./features/admin/reportes/reportes.component').then(
            (m) => m.ReportesComponent,
          ),
      },
      {
        path: 'actividad',
        canActivate: [permisoGuard],
        data: { permiso: 'actividad' },
        loadComponent: () =>
          import('./features/admin/actividad/actividad.component').then(
            (m) => m.ActividadComponent,
          ),
      },
      {
        path: 'recompensas',
        canActivate: [permisoGuard],
        data: { permiso: 'recompensas' },
        loadComponent: () =>
          import('./features/admin/recompensas/recompensas.component').then(
            (m) => m.RecompensasComponent,
          ),
      },
      {
        path: 'propuestas',
        canActivate: [permisoGuard],
        data: { permiso: 'propuestas' },
        loadComponent: () =>
          import('./features/admin/propuestas/gestionar-propuestas.component').then(
            (m) => m.GestionarPropuestasComponent,
          ),
      },
      {
        path: 'crear-combo',
        canActivate: [permisoGuard],
        data: { permiso: 'combos' },
        loadComponent: () =>
          import('./features/admin/crear-combo/crear-combo.component').then(
            (m) => m.CrearComboComponent,
          ),
      },
      {
        path: 'roles',
        canActivate: [permisoGuard],
        data: { permiso: 'admin' },
        loadComponent: () =>
          import('./features/admin/roles/gestionar-roles.component').then(
            (m) => m.GestionarRolesComponent,
          ),
      },
      {
        path: 'usuarios',
        canActivate: [permisoGuard],
        data: { permiso: 'admin' },
        loadComponent: () =>
          import('./features/admin/roles/asignar-roles.component').then(
            (m) => m.AsignarRolesComponent,
          ),
      },
    ],
  },

  {
    path: '**',
    redirectTo: '',
  },
];