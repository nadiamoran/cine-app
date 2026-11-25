import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { GRUPOS_ADMIN } from '../secciones-admin';

// Pantalla de inicio del administrador (en vez del perfil de cliente, que
// muestra puntos e historial de compras que al admin no le sirven). Muestra
// las secciones que el usuario puede usar: todas para el administrador, solo
// las de su rol para un rol personalizado.
@Component({
  selector: 'app-panel-admin',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './panel-admin.component.html',
})
export class PanelAdminComponent {
  secciones = computed(() =>
    GRUPOS_ADMIN.flatMap((grupo) => grupo.secciones).filter((seccion) =>
      this.authService.tienePermiso(seccion.permiso),
    ),
  );

  constructor(protected authService: AuthService) {}
}
