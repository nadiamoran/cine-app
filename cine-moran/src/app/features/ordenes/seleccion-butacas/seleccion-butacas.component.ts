import { Component, DestroyRef, OnInit, signal, computed } from '@angular/core';
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
import { METODOS_PAGO, MetodoPago, OrdenConButacas } from '../orden.model';
import { TicketsService } from '../tickets.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ButacaComponent } from '../../salas/butaca/butaca.component';
import { agruparPorFilaYBloque, calcularAnchosBloque, anchoBloqueRem } from '../../salas/butacas.utils';
import { ComponentePuedeSalir } from '../../../core/guards/confirmar-salida.guard';
import { CandyBarService } from '../../candy-bar/candy-bar.service';
import { Categoria, Producto, Combo } from '../../candy-bar/producto.model';
import { detalleCombo } from '../../candy-bar/combo.utils';
import { infoPreventa, precioVigente } from '../../catalogo/preventa.utils';
import { RecompensasService } from '../../puntos/recompensas.service';
import { Recompensa } from '../../puntos/recompensa.model';

@Component({
  selector: 'app-seleccion-butacas',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, ButacaComponent],
  templateUrl: './seleccion-butacas.component.html',
})
export class SeleccionButacasComponent implements OnInit, ComponentePuedeSalir {
  readonly detalleCombo = detalleCombo;

  cargando = signal(true);
  funcion = signal<Funcion | null>(null);
  pelicula = signal<Pelicula | null>(null);
  sala = signal<Sala | null>(null);
  butacas = signal<Butaca[]>([]);
  ocupadas = signal<Set<string>>(new Set());
  seleccionadas = signal<Set<string>>(new Set());

  comprando = signal(false);
  errorMsg = signal<string | null>(null);
  // aviso cuando otra persona compra una butaca que este usuario tenía elegida
  avisoButacas = signal<string | null>(null);
  compraConfirmada = signal<OrdenConButacas | null>(null);
  generandoPdf = signal(false);

  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  combos = signal<Combo[]>([]);
  cantidadesProductos = signal<Map<string, number>>(new Map());
  cantidadesCombos = signal<Map<string, number>>(new Map());

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

  totalCandy = computed(() => {
    let suma = 0;
    for (const [id, cantidad] of this.cantidadesProductos()) {
      suma += (this.productos().find((p) => p.id === id)?.precio ?? 0) * cantidad;
    }
    for (const [id, cantidad] of this.cantidadesCombos()) {
      suma += (this.combos().find((c) => c.id === id)?.precio ?? 0) * cantidad;
    }
    return suma;
  });

  // RF-29: si la película está en preventa, estándar y VIP llevan el descuento
  // (mismo cálculo que crear_orden; el precio que se cobra lo decide la base)
  preventa = computed(() => {
    const pelicula = this.pelicula();
    return pelicula ? infoPreventa(pelicula) : null;
  });

  precioEstandar = computed(() => {
    const precio = this.funcion()?.precio ?? 0;
    const preventa = this.preventa();
    return preventa ? precioVigente(precio, preventa) : precio;
  });

  precioVip = computed(() => {
    const precio = this.funcion()?.precioVip ?? 0;
    const preventa = this.preventa();
    return preventa ? precioVigente(precio, preventa) : precio;
  });

  // RF-15: las VIP tienen su propio precio (funcion.precioVip)
  butacasVipSeleccionadas = computed(() => {
    const ids = this.seleccionadas();
    return this.butacas().filter((b) => ids.has(b.id) && b.tipo === 'vip').length;
  });

  // estándar + accesibles: pagan el precio común. Los combos cubren solo estas
  butacasGeneralesSeleccionadas = computed(
    () => this.cantidadSeleccionada() - this.butacasVipSeleccionadas(),
  );

  // entradas generales que se cobran sueltas (las demás vienen en un combo
  // o se pagan con puntos)
  generalesACobrar = computed(() =>
    Math.max(
      this.butacasGeneralesSeleccionadas() - this.entradasEnCombos() - this.entradasCanjeadas(),
      0,
    ),
  );

  // ---- RF-41: canje de puntos (solo usuarios registrados) ----
  recompensas = signal<Recompensa[]>([]);
  cantidadesRecompensas = signal<Map<string, number>>(new Map());

  puntosDisponibles = computed(() => this.authService.currentUser()?.puntos ?? 0);

  // las entradas limitadas a un formato solo aparecen en funciones de ese formato
  recompensasAplicables = computed(() => {
    const formato = this.funcion()?.formato;
    return this.recompensas().filter((r) => r.tipo === 'producto' || !r.formato || r.formato === formato);
  });

  puntosAUsar = computed(() => {
    let suma = 0;
    for (const [id, cantidad] of this.cantidadesRecompensas()) {
      suma += (this.recompensas().find((r) => r.id === id)?.puntos ?? 0) * cantidad;
    }
    return suma;
  });

  faltanPuntos = computed(() => this.puntosAUsar() > this.puntosDisponibles());

  entradasCanjeadas = computed(() => {
    let suma = 0;
    for (const [id, cantidad] of this.cantidadesRecompensas()) {
      if (this.recompensas().find((r) => r.id === id)?.tipo === 'entrada') suma += cantidad;
    }
    return suma;
  });

  cantidadRecompensa(id: string): number {
    return this.cantidadesRecompensas().get(id) ?? 0;
  }

  onCambiarCantidadRecompensa(id: string, valor: string) {
    this.cantidadesRecompensas.set(this.actualizarCantidad(this.cantidadesRecompensas(), id, valor));
  }

  entradasEnCombos = computed(() => {
    let suma = 0;
    for (const [id, cantidad] of this.cantidadesCombos()) {
      suma += (this.combos().find((c) => c.id === id)?.entradasIncluidas ?? 0) * cantidad;
    }
    return suma;
  });

  // combos y entradas canjeadas cubren solo butacas generales (no VIP)
  faltanButacasParaCombos = computed(
    () => this.entradasEnCombos() + this.entradasCanjeadas() > this.butacasGeneralesSeleccionadas(),
  );

  // las entradas que trae un combo no se cobran sueltas: se paga el precio del combo
  // (el total real lo vuelve a calcular crear_orden en la base)
  total = computed(
    () =>
      this.generalesACobrar() * this.precioEstandar() +
      this.butacasVipSeleccionadas() * this.precioVip() +
      this.totalCandy(),
  );

  // ---- RF-28 / S-2: pago (simulado) y uso del crédito ----
  readonly metodosPago = METODOS_PAGO;
  usarCredito = signal(false);
  metodoPago = signal<MetodoPago | null>(null);

  creditoDisponible = computed(() => this.authService.currentUser()?.credito ?? 0);

  // estimación: el cupón lo aplica la base, así que lo real puede ser menor
  creditoAAplicar = computed(() =>
    this.usarCredito() ? Math.min(this.creditoDisponible(), this.total()) : 0,
  );

  aPagar = computed(() => this.total() - this.creditoAAplicar());

  etiquetaMetodo(metodo: string | null): string | null {
    return this.metodosPago.find((m) => m.valor === metodo)?.etiqueta ?? null;
  }

  // detalle de qué butacas eligió (ej: "J3, J4, R5"), para que confirme antes
  // de pagar exactamente dónde se va a sentar, no solo cuántas entradas son
  etiquetaSeleccion = computed(() => {
    const ids = this.seleccionadas();
    return this.butacas()
      .filter((b) => ids.has(b.id))
      .sort((a, b) => a.fila.localeCompare(b.fila) || a.numero - b.numero)
      .map((b) => `${b.fila}${b.numero}${b.tipo === 'vip' ? ' (VIP)' : ''}`)
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
    private ticketsService: TicketsService,
    private candyBarService: CandyBarService,
    private recompensasService: RecompensasService,
    protected authService: AuthService,
    private destroyRef: DestroyRef,
  ) {}

  async ngOnInit() {
    this.cargando.set(true);
    const funcionId = this.route.snapshot.paramMap.get('id')!;
    // con la sesión ya restaurada (las recompensas dependen del usuario)
    await this.authService.sesionLista;

    const [funcion, ocupadas, categorias, productos, combos, recompensas] = await Promise.all([
      this.funcionesService.getById(funcionId),
      this.ordenesService.getButacasOcupadas(funcionId),
      this.candyBarService.getCategorias(),
      this.candyBarService.getProductosActivos(),
      this.candyBarService.getCombosActivos(),
      // los anónimos no tienen puntos: no hace falta traerlas
      this.authService.currentUser() ? this.recompensasService.getActivas() : Promise.resolve([]),
    ]);

    this.funcion.set(funcion);
    this.ocupadas.set(ocupadas);
    this.categorias.set(categorias);
    this.productos.set(productos);
    this.combos.set(combos);
    this.recompensas.set(recompensas);

    if (funcion) {
      const [pelicula, sala, butacas] = await Promise.all([
        this.peliculasService.getById(funcion.peliculaId),
        this.salasService.getById(funcion.salaId),
        this.salasService.getButacas(funcion.salaId),
      ]);
      this.pelicula.set(pelicula);
      this.sala.set(sala);
      this.butacas.set(butacas);

      // Realtime: desde acá, cada compra de otra persona se refleja sola en
      // el mapa. La suscripción se corta al salir de la pantalla.
      const dejarDeEscuchar = this.ordenesService.escucharButacas(
        funcion.id,
        (butacaId) => this.onButacaOcupada(butacaId),
        (butacaId) => this.onButacaLiberada(butacaId),
      );
      this.destroyRef.onDestroy(dejarDeEscuchar);
    }

    this.cargando.set(false);
  }

  private onButacaOcupada(butacaId: string) {
    const ocupadas = new Set(this.ocupadas());
    ocupadas.add(butacaId);
    this.ocupadas.set(ocupadas);

    // si es mi propia compra en curso, el evento puede llegar antes que la
    // respuesta de crear_orden: no es "otra persona", no aviso nada
    if (this.comprando() || !this.seleccionadas().has(butacaId)) return;

    // otra persona compró una butaca que yo tenía elegida: la saco y aviso
    const seleccionadas = new Set(this.seleccionadas());
    seleccionadas.delete(butacaId);
    this.seleccionadas.set(seleccionadas);

    const butaca = this.butacas().find((b) => b.id === butacaId);
    this.avisoButacas.set(
      `Alguien acaba de comprar la butaca ${butaca ? butaca.fila + butaca.numero : ''}. Elegí otra.`,
    );
  }

  private onButacaLiberada(butacaId: string) {
    const ocupadas = new Set(this.ocupadas());
    ocupadas.delete(butacaId);
    this.ocupadas.set(ocupadas);
  }

  estaSeleccionada(butacaId: string): boolean {
    return this.seleccionadas().has(butacaId);
  }

  estaOcupada(butacaId: string): boolean {
    return this.ocupadas().has(butacaId);
  }

  onSeleccionarButaca(butaca: Butaca) {
    this.avisoButacas.set(null);
    const actuales = new Set(this.seleccionadas());
    if (actuales.has(butaca.id)) {
      actuales.delete(butaca.id);
    } else {
      actuales.add(butaca.id);
    }
    this.seleccionadas.set(actuales);
  }

  productosDeCategoria(categoriaId: string): Producto[] {
    return this.productos().filter((p) => p.categoriaId === categoriaId);
  }

  cantidadProducto(id: string): number {
    return this.cantidadesProductos().get(id) ?? 0;
  }

  cantidadCombo(id: string): number {
    return this.cantidadesCombos().get(id) ?? 0;
  }

  onCambiarCantidadProducto(id: string, valor: string) {
    this.cantidadesProductos.set(this.actualizarCantidad(this.cantidadesProductos(), id, valor));
  }

  onCambiarCantidadCombo(id: string, valor: string) {
    this.cantidadesCombos.set(this.actualizarCantidad(this.cantidadesCombos(), id, valor));
  }

  private actualizarCantidad(mapa: Map<string, number>, id: string, valor: string): Map<string, number> {
    const cantidad = Math.max(0, Math.floor(Number(valor) || 0));
    const actuales = new Map(mapa);
    if (cantidad === 0) {
      actuales.delete(id);
    } else {
      actuales.set(id, cantidad);
    }
    return actuales;
  }

  // un id repetido tantas veces como la cantidad elegida: asi lo espera crear_orden
  private idsRepetidos(mapa: Map<string, number>): string[] {
    const resultado: string[] = [];
    for (const [id, cantidad] of mapa) {
      for (let i = 0; i < cantidad; i++) resultado.push(id);
    }
    return resultado;
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

    if (this.faltanButacasParaCombos()) {
      return;
    }

    if (this.faltanPuntos()) {
      this.errorMsg.set('No te alcanzan los puntos para ese canje.');
      return;
    }

    // si el crédito no cubre todo, hace falta un medio de pago (la base
    // lo vuelve a exigir)
    if (this.aPagar() > 0 && !this.metodoPago()) {
      this.errorMsg.set('Elegí un medio de pago.');
      return;
    }

    this.comprando.set(true);
    const { resultado, error } = await this.ordenesService.crear(
      this.funcion()!.id,
      Array.from(this.seleccionadas()),
      email,
      this.idsRepetidos(this.cantidadesProductos()),
      this.idsRepetidos(this.cantidadesCombos()),
      this.usarCredito(),
      this.metodoPago(),
      this.idsRepetidos(this.cantidadesRecompensas()),
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

    this.compraConfirmada.set(resultado);
    this.seleccionadas.set(new Set());
    this.cantidadesProductos.set(new Map());
    this.cantidadesCombos.set(new Map());
    this.cantidadesRecompensas.set(new Map());
    this.usarCredito.set(false);
    this.metodoPago.set(null);
    await this.authService.recargarPerfil(); // para que se vean los puntos ganados y el crédito
  }

  async onDescargarPdf() {
    const resultado = this.compraConfirmada();
    const funcion = this.funcion();
    const pelicula = this.pelicula();
    if (!resultado || !funcion || !pelicula) return;

    this.generandoPdf.set(true);
    try {
      await this.ticketsService.generarPdf({ resultado, funcion, pelicula });
    } finally {
      this.generandoPdf.set(false);
    }
  }

  puedeSalir(): boolean {
    return this.cantidadSeleccionada() === 0 || !!this.compraConfirmada();
  }
}
