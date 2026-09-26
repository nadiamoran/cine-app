import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SalasService } from './salas.service';
import { Sala, Butaca } from './sala.model';
import { ButacaComponent } from './butaca/butaca.component';

@Component({
  selector: 'app-mapa-sala',
  standalone: true,
  imports: [ButacaComponent],
  templateUrl: './mapa-sala.component.html',
})
export class MapaSalaComponent implements OnInit {
  sala = signal<Sala | null>(null);
  butacas = signal<Butaca[]>([]);
  cargando = signal(true);

  // ids de las butacas que el usuario fue tocando en esta visita a la pantalla
  seleccionadas = signal<Set<string>>(new Set());

  // agrupa las butacas planas en filas, para poder dibujar el grid fila por fila
  filas = computed(() => {
    const agrupadas = new Map<string, Butaca[]>();
    for (const b of this.butacas()) {
      if (!agrupadas.has(b.fila)) agrupadas.set(b.fila, []);
      agrupadas.get(b.fila)!.push(b);
    }
    return Array.from(agrupadas.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  cantidadSeleccionada = computed(() => this.seleccionadas().size);

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

  estaSeleccionada(butacaId: string): boolean {
    return this.seleccionadas().has(butacaId);
  }

  // recibe el evento (output) del componente hijo app-butaca y decide qué hacer:
  // si ya estaba elegida la deselecciona, si no, la agrega
  onSeleccionarButaca(butaca: Butaca) {
    const actuales = new Set(this.seleccionadas());
    if (actuales.has(butaca.id)) {
      actuales.delete(butaca.id);
    } else {
      actuales.add(butaca.id);
    }
    this.seleccionadas.set(actuales);
  }
}