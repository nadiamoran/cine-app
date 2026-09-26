import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculasService } from './peliculas.service';
import { Pelicula } from './pelicula.model';
import { DuracionPipe } from '../../shared/pipes/duracion.pipe';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [RouterLink, DuracionPipe],
  templateUrl: './catalogo.component.html',
})
export class CatalogoComponent implements OnInit {
  peliculas = signal<Pelicula[]>([]);
  cargando = signal(true);

  busqueda = signal('');
  generoSeleccionado = signal<string | null>(null);

  // Lista de géneros disponibles, calculada a partir de las películas
  // que ya trajimos (sin pedirle nada aparte a Supabase)
  generosDisponibles = computed(() => {
    const set = new Set<string>();
    for (const p of this.peliculas()) {
      for (const g of p.generos) set.add(g);
    }
    return Array.from(set).sort();
  });

  // computed: se recalcula solo cuando cambian peliculas(), busqueda() o generoSeleccionado()
  peliculasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const genero = this.generoSeleccionado();

    return this.peliculas().filter((p) => {
      const matchTexto = !texto || p.nombre.toLowerCase().includes(texto);
      const matchGenero = !genero || p.generos.includes(genero);
      return matchTexto && matchGenero;
    });
  });

  constructor(private peliculasService: PeliculasService) {}

  async ngOnInit() {
    this.cargando.set(true);
    const data = await this.peliculasService.getCartelera();
    this.peliculas.set(data);
    this.cargando.set(false);
  }

  onBusquedaChange(valor: string) {
    this.busqueda.set(valor);
  }

  onGeneroChange(valor: string) {
    this.generoSeleccionado.set(valor || null);
  }
}