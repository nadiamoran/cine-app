import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

// Cada ruta del admin dice qué permiso necesita en su "data" (ej:
// data: { permiso: 'reportes' }). El guard lo lee con route.data, así se
// escribe una sola vez y sirve para todas las secciones.
export const permisoGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.sesionLista;

  if (authService.tienePermiso(route.data['permiso'])) {
    return true;
  }

  // ya está dentro del admin pero esa sección no es suya: vuelve al panel
  router.navigate(['/admin']);
  return false;
};
