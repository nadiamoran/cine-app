import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OrdenesService } from '../ordenes/ordenes.service';
import { PeliculaVista } from '../ordenes/orden.model';

// RF-12: historial visual de las películas que vio el usuario (póster,
// fecha y su calificación). Si todavía no la calificó, lleva al detalle,
// que es donde está el formulario de reseña.
@Component({
  selector: 'app-mis-peliculas',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './mis-peliculas.component.html',
})
export class MisPeliculasComponent implements OnInit {
  readonly estrellas = [1, 2, 3, 4, 5];

  cargando = signal(true);
  peliculas = signal<PeliculaVista[]>([]);

  constructor(
    private authService: AuthService,
    private ordenesService: OrdenesService,
  ) {}

  async ngOnInit() {
    const usuario = this.authService.currentUser();
    if (usuario) {
      this.peliculas.set(await this.ordenesService.getPeliculasVistas(usuario.id));
    }
    this.cargando.set(false);
  }
}
