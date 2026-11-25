import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

// Deja entrar al panel de admin al administrador y a quien tenga un rol
// personalizado con algún permiso. Qué sección puede ver cada uno lo decide
// permisoGuard, ruta por ruta.
export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // espera a que se restaure la sesión (si no, al recargar la página
  // parecería que no hay nadie logueado)
  await authService.sesionLista;

  if (authService.tieneAccesoAdmin()) {
    return true;
  }

  router.navigate(['/']);
  return false;
};
