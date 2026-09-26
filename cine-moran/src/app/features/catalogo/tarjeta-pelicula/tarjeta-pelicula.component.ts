import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pelicula } from '../pelicula.model';
import { DuracionPipe } from '../../../shared/pipes/duracion.pipe';

// Componente "tonto": recibe la pelicula por input() y solo la muestra.
// No conoce el buscador ni el filtro de generos, asi el catalogo se puede
// reusar en otras pantallas (ej: "Proximamente" o "Mis peliculas").
@Component({
  selector: 'app-tarjeta-pelicula',
  standalone: true,
  imports: [RouterLink, DuracionPipe],
  templateUrl: './tarjeta-pelicula.component.html',
})
export class TarjetaPeliculaComponent {
  pelicula = input.required<Pelicula>();
}
