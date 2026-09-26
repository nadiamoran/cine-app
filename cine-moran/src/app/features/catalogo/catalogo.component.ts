import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PeliculasService } from './peliculas.service';
import { Pelicula } from './pelicula.model';
import { TarjetaPeliculaComponent } from './tarjeta-pelicula/tarjeta-pelicula.component';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [TarjetaPeliculaComponent],
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

  constructor(
    private peliculasService: PeliculasService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  async ngOnInit() {
    // si vienen de un link con ?q=...&genero=..., arrancamos con ese filtro
    // ya puesto (por ej. "compartir" una búsqueda, o volver atrás con el navegador)
    const queryParams = this.route.snapshot.queryParamMap;
    this.busqueda.set(queryParams.get('q') ?? '');
    this.generoSeleccionado.set(queryParams.get('genero'));

    this.cargando.set(true);
    const data = await this.peliculasService.getCartelera();
    this.peliculas.set(data);
    this.cargando.set(false);
  }

  onBusquedaChange(valor: string) {
    this.busqueda.set(valor);
    this.actualizarQueryParams();
  }

  onGeneroChange(valor: string) {
    this.generoSeleccionado.set(valor || null);
    this.actualizarQueryParams();
  }

  // refleja el filtro actual en la URL, sin agregar una entrada nueva al
  // historial por cada letra que se tipea (replaceUrl)
  private actualizarQueryParams() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.busqueda() || null, genero: this.generoSeleccionado() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}