import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
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
  ) {}

  async ngOnInit() {
    this.cargando.set(true);
    this.historial.set(await this.ordenesService.getHistorial());
    this.cargando.set(false);
  }
}
