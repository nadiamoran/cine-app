import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PeliculasService } from '../peliculas.service';
import { AlertasService } from './alertas.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Pelicula } from '../pelicula.model';

@Component({
  selector: 'app-proximamente',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './proximamente.component.html',
})
export class ProximamenteComponent implements OnInit {
  peliculas = signal<Pelicula[]>([]);
  alertasActivas = signal<Set<string>>(new Set());
  cargando = signal(true);

  constructor(
    private peliculasService: PeliculasService,
    private alertasService: AlertasService,
    protected authService: AuthService,
  ) {}

  async ngOnInit() {
    this.cargando.set(true);
    this.peliculas.set(await this.peliculasService.getProximamente());

    const user = this.authService.currentUser();
    if (user) {
      this.alertasActivas.set(await this.alertasService.getAlertasUsuario(user.id));
    }

    this.cargando.set(false);
  }

  tieneAlerta(peliculaId: string): boolean {
    return this.alertasActivas().has(peliculaId);
  }

  async toggleAlerta(peliculaId: string) {
    const user = this.authService.currentUser();
    if (!user) return;

    const activa = this.tieneAlerta(peliculaId);
    const set = new Set(this.alertasActivas());

    if (activa) {
      await this.alertasService.desactivar(peliculaId, user.id);
      set.delete(peliculaId);
    } else {
      await this.alertasService.activar(peliculaId, user.id);
      set.add(peliculaId);
    }

    this.alertasActivas.set(set);
  }
}