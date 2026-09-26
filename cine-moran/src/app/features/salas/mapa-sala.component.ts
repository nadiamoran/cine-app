import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SalasService } from './salas.service';
import { Sala, Butaca } from './sala.model';
import { ButacaTipoDirective } from '../../shared/directives/butaca-tipo.directive';

@Component({
  selector: 'app-mapa-sala',
  standalone: true,
  imports: [ButacaTipoDirective],
  templateUrl: './mapa-sala.component.html',
})
export class MapaSalaComponent implements OnInit {
  sala = signal<Sala | null>(null);
  butacas = signal<Butaca[]>([]);
  cargando = signal(true);

  // agrupa las butacas planas en filas, para poder dibujar el grid fila por fila
  filas = computed(() => {
    const agrupadas = new Map<string, Butaca[]>();
    for (const b of this.butacas()) {
      if (!agrupadas.has(b.fila)) agrupadas.set(b.fila, []);
      agrupadas.get(b.fila)!.push(b);
    }
    return Array.from(agrupadas.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  constructor(
    private route: ActivatedRoute,
    private salasService: SalasService,
  ) {}

  async ngOnInit() {
    const salaId = this.route.snapshot.paramMap.get('id')!;
    this.cargando.set(true);

    const [sala, butacas] = await Promise.all([
      this.salasService.getById(salaId),
      this.salasService.getButacas(salaId),
    ]);

    this.sala.set(sala);
    this.butacas.set(butacas);
    this.cargando.set(false);
  }
}