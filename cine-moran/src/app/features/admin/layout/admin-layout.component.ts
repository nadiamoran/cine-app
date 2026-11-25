import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { GRUPOS_ADMIN } from '../secciones-admin';

// Marco común de todas las pantallas de admin: menú lateral a la izquierda y,
// a la derecha, un <router-outlet> donde se carga la pantalla hija elegida
// (rutas hijas de "admin" en app.routes.ts). El menú muestra solo las
// secciones que el usuario puede usar.
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent {
  grupos = computed(() =>
    GRUPOS_ADMIN.map((grupo) => ({
      titulo: grupo.titulo,
      links: grupo.secciones.filter((seccion) => this.authService.tienePermiso(seccion.permiso)),
    })).filter((grupo) => grupo.links.length > 0),
  );

  constructor(private authService: AuthService) {}
}
