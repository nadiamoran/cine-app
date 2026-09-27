import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FuncionesService } from '../../funciones/funciones.service';
import { Funcion } from '../../funciones/funcion.model';
import { SalasService } from '../../salas/salas.service';
import { Sala, Butaca } from '../../salas/sala.model';
import { PeliculasService } from '../../catalogo/peliculas.service';
import { Pelicula } from '../../catalogo/pelicula.model';
import { OrdenesService } from '../ordenes.service';
import { Orden } from '../orden.model';
import { AuthService } from '../../../core/auth/auth.service';
import { ButacaComponent } from '../../salas/butaca/butaca.component';
import { agruparPorFilaYBloque, calcularAnchosBloque, anchoBloqueRem } from '../../salas/butacas.utils';
import { ComponentePuedeSalir } from '../../../core/guards/confirmar-salida.guard';

@Component({
  selector: 'app-seleccion-butacas',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, ButacaComponent],
  templateUrl: './seleccion-butacas.component.html',
})
export class SeleccionButacasComponent implements OnInit, ComponentePuedeSalir {
  cargando = signal(true);
  funcion = signal<Funcion | null>(null);
  pelicula = signal<Pelicula | null>(null);
  sala = signal<Sala | null>(null);
  butacas = signal<Butaca[]>([]);
  ocupadas = signal<Set<string>>(new Set());
  seleccionadas = signal<Set<string>>(new Set());

  comprando = signal(false);
  errorMsg = signal<string | null>(null);
  ordenConfirmada = signal<Orden | null>(null);

  emailForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  filas = computed(() => agruparPorFilaYBloque(this.butacas()));

  // ancho de cada bloque (según la fila más ancha en esa posición), para que
  // la fila accesible ocupe el mismo espacio físico que las demás
  anchosBloqueRem = computed(() =>
    calcularAnchosBloque(this.butacas()).map((cantidad) => anchoBloqueRem(cantidad)),
  );

  cantidadSeleccionada = computed(() => this.seleccionadas().size);
  total = computed(() => this.cantidadSeleccionada() * (this.funcion()?.precio ?? 0));

  // detalle de qué butacas eligió (ej: "J3, J4, R5"), para que confirme antes
  // de pagar exactamente dónde se va a sentar, no solo cuántas entradas son
  etiquetaSeleccion = computed(() => {
    const ids = this.seleccionadas();
    return this.butacas()
      .filter((b) => ids.has(b.id))
      .sort((a, b) => a.fila.localeCompare(b.fila) || a.numero - b.numero)
      .map((b) => `${b.fila}${b.numero}`)
      .join(', ');
  });

  // RF-25: edad minima segun la restriccion de la pelicula (0 = sin restriccion)
  edadMinima = computed(() => {
    const r = this.pelicula()?.restriccionEdad;
    return r === '+18' ? 18 : r === '+13' ? 13 : 0;
  });

  edadUsuario = computed<number | null>(() => {
    const fechaNacimiento = this.authService.currentUser()?.fechaNacimiento;
    if (!fechaNacimiento) return null;

    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const todaviaNoCumplioEsteAño =
      hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
    if (todaviaNoCumplioEsteAño) edad--;
    return edad;
  });

  // sin restriccion: cualquiera puede comprar, incluso anonimo.
  // con restriccion: hay que estar logueado y cumplir la edad minima.
  puedeComprar = computed(() => {
    if (this.edadMinima() === 0) return true;
    const edad = this.edadUsuario();
    return edad !== null && edad >= this.edadMinima();
  });

  constructor(
    private route: ActivatedRoute,
    private funcionesService: FuncionesService,
    private salasService: SalasService,
    private peliculasService: PeliculasService,
    private ordenesService: OrdenesService,
    protected authService: AuthService,
  ) {}

  async ngOnInit() {
    this.cargando.set(true);
    const funcionId = this.route.snapshot.paramMap.get('id')!;

    const [funcion, ocupadas] = await Promise.all([
      this.funcionesService.getById(funcionId),
      this.ordenesService.getButacasOcupadas(funcionId),
    ]);

    this.funcion.set(funcion);
    this.ocupadas.set(ocupadas);

    if (funcion) {
      const [pelicula, sala, butacas] = await Promise.all([
        this.peliculasService.getById(funcion.peliculaId),
        this.salasService.getById(funcion.salaId),
        this.salasService.getButacas(funcion.salaId),
      ]);
      this.pelicula.set(pelicula);
      this.sala.set(sala);
      this.butacas.set(butacas);
    }

    this.cargando.set(false);
  }

  estaSeleccionada(butacaId: string): boolean {
    return this.seleccionadas().has(butacaId);
  }

  estaOcupada(butacaId: string): boolean {
    return this.ocupadas().has(butacaId);
  }

  onSeleccionarButaca(butaca: Butaca) {
    const actuales = new Set(this.seleccionadas());
    if (actuales.has(butaca.id)) {
      actuales.delete(butaca.id);
    } else {
      actuales.add(butaca.id);
    }
    this.seleccionadas.set(actuales);
  }

  async onConfirmar() {
    this.errorMsg.set(null);
    const usuario = this.authService.currentUser();

    let email = usuario?.email ?? '';
    if (!usuario) {
      if (this.emailForm.invalid) {
        this.emailForm.markAllAsTouched();
        return;
      }
      email = this.emailForm.getRawValue().email;
    }

    if (this.cantidadSeleccionada() === 0) {
      this.errorMsg.set('Elegí al menos una butaca.');
      return;
    }

    this.comprando.set(true);
    const { orden, error } = await this.ordenesService.crear(
      this.funcion()!.id,
      Array.from(this.seleccionadas()),
      email,
    );
    this.comprando.set(false);

    if (error) {
      // "duplicate key" es lo que tira Postgres si alguien ya compro esa butaca justo antes
      this.errorMsg.set(
        error.includes('duplicate key')
          ? 'Alguien acaba de comprar una de estas butacas. Elegí otra.'
          : error,
      );
      return;
    }

    this.ordenConfirmada.set(orden);
    this.seleccionadas.set(new Set());
  }

  puedeSalir(): boolean {
    return this.cantidadSeleccionada() === 0 || !!this.ordenConfirmada();
  }
}
