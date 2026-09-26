import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

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
    path: 'admin/crear-pelicula',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/crear-pelicula/crear-pelicula.component').then(
        (m) => m.CrearPeliculaComponent,
      ),
  },
  
  {
    path: '**',
    redirectTo: '',
  },
];