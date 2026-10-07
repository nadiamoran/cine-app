import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
})
export class NavComponent {
  // menú del celular (RNF-10): en pantallas chicas los links se esconden
  // detrás del botón ☰
  menuAbierto = signal(false);

  constructor(protected authService: AuthService) {}

  // a dónde lleva "Hola, X": cada rol a su pantalla (solo el cliente tiene perfil)
  inicioUsuario(): string {
    const rol = this.authService.currentUser()?.rol;
    if (rol === 'administrador') return '/admin';
    if (rol === 'empleado') return '/empleado/validar';
    return '/perfil';
  }

  // al tocar un link se cierra el menú del celular
  cerrarMenu() {
    this.menuAbierto.set(false);
  }

  logout() {
    this.authService.logout();
  }
}
