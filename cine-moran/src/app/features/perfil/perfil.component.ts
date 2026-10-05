import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OrdenesService } from '../ordenes/ordenes.service';
import { CompraHistorial } from '../ordenes/orden.model';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './perfil.component.html',
})
export class PerfilComponent implements OnInit {
  cargando = signal(true);
  historial = signal<CompraHistorial[]>([]);

  constructor(
    protected authService: AuthService,
    private ordenesService: OrdenesService,
    private router: Router,
  ) {}

  async ngOnInit() {
    // el admin no tiene puntos ni compras: su "perfil" es el panel de administración
    if (this.authService.currentUser()?.rol === 'administrador') {
      this.router.navigate(['/admin'], { replaceUrl: true });
      return;
    }

    this.cargando.set(true);
    this.historial.set(await this.ordenesService.getHistorial());
    this.cargando.set(false);
  }
}
