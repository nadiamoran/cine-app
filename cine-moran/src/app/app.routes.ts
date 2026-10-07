import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
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
        loadComponent: () =>
          import('./features/admin/crear-pelicula/crear-pelicula.component').then(
            (m) => m.CrearPeliculaComponent,
          ),
      },
      {
        path: 'crear-funcion',
        loadComponent: () =>
          import('./features/admin/crear-funcion/crear-funcion.component').then(
            (m) => m.CrearFuncionComponent,
          ),
      },
      {
        path: 'salas',
        loadComponent: () =>
          import('./features/admin/gestionar-salas/gestionar-salas.component').then(
            (m) => m.GestionarSalasComponent,
          ),
      },
      {
        path: 'cupones',
        loadComponent: () =>
          import('./features/admin/gestionar-cupones/gestionar-cupones.component').then(
            (m) => m.GestionarCuponesComponent,
          ),
      },
      {
        path: 'crear-producto',
        loadComponent: () =>
          import('./features/admin/crear-producto/crear-producto.component').then(
            (m) => m.CrearProductoComponent,
          ),
      },
      {
        // la misma pantalla del empleado, pero dentro del marco de admin
        path: 'validar',
        loadComponent: () =>
          import('./features/empleado/validar-entrada/validar-entrada.component').then(
            (m) => m.ValidarEntradaComponent,
          ),
      },
      {
        path: 'actividad',
        loadComponent: () =>
          import('./features/admin/actividad/actividad.component').then(
            (m) => m.ActividadComponent,
          ),
      },
      {
        path: 'recompensas',
        loadComponent: () =>
          import('./features/admin/recompensas/recompensas.component').then(
            (m) => m.RecompensasComponent,
          ),
      },
      {
        path: 'crear-combo',
        loadComponent: () =>
          import('./features/admin/crear-combo/crear-combo.component').then(
            (m) => m.CrearComboComponent,
          ),
      },
    ],
  },

  {
    path: '**',
    redirectTo: '',
  },
];