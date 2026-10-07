import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // espera a que se restaure la sesión (si no, al recargar la página
  // parecería que no hay nadie logueado)
  await authService.sesionLista;

  if (authService.currentUser()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};