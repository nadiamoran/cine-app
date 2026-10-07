import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// Marco común de todas las pantallas de admin: menú lateral a la izquierda y,
// a la derecha, un <router-outlet> donde se carga la pantalla hija elegida
// (rutas hijas de "admin" en app.routes.ts).
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent {
  readonly grupos = [
    {
      titulo: 'Programación',
      links: [
        { ruta: '/admin/crear-pelicula', texto: 'Películas' },
        { ruta: '/admin/crear-funcion', texto: 'Funciones' },
        { ruta: '/admin/salas', texto: 'Salas' },
      ],
    },
    {
      titulo: 'Candy bar',
      links: [
        { ruta: '/admin/crear-producto', texto: 'Productos' },
        { ruta: '/admin/crear-combo', texto: 'Combos' },
      ],
    },
    {
      titulo: 'Clientes',
      links: [
        { ruta: '/admin/cupones', texto: 'Cupones' },
        { ruta: '/admin/recompensas', texto: 'Recompensas' },
      ],
    },
    {
      titulo: 'Control',
      links: [
        { ruta: '/admin/actividad', texto: 'Actividad' },
        { ruta: '/admin/validar', texto: 'Validar entrada' },
      ],
    },
  ];
}
