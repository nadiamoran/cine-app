import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

// canMatch (no canActivate): si no matchea, el router sigue probando otras
// rutas en vez de activar esta a medias. Un administrador también puede
// validar entradas, no solo el rol "empleado".
export const empleadoGuard: CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const rol = authService.currentUser()?.rol;
  if (rol === 'empleado' || rol === 'administrador') {
    return true;
  }

  router.navigate(['/']);
  return false;
};
