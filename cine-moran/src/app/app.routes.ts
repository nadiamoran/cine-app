import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
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
    path: 'sala/:id',
    loadComponent: () =>
      import('./features/salas/mapa-sala.component').then((m) => m.MapaSalaComponent),
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
    children: [
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
    ],
  },

  {
    path: '**',
    redirectTo: '',
  },
];