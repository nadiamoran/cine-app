import { Component, OnInit, computed, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RecompensasService } from '../../puntos/recompensas.service';
import { Recompensa, TipoRecompensa } from '../../puntos/recompensa.model';
import { CandyBarService } from '../../candy-bar/candy-bar.service';
import { Producto } from '../../candy-bar/producto.model';
import { Formato } from '../../funciones/funcion.model';

// RF-42: el admin configura cuántos puntos cuesta cada recompensa
// (ej: entrada = 500 puntos, pochoclo grande = 150 puntos)
@Component({
  selector: 'app-recompensas',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './recompensas.component.html',
})
export class RecompensasComponent implements OnInit {
  readonly formatos: Formato[] = ['2d', '3d', '4d', '5d'];

  cargando = signal(true);
  recompensas = signal<Recompensa[]>([]);

  // buscador y filtro del listado (mismo mecanismo que en Películas)
  busqueda = signal('');
  filtro = signal('');

  // se recalcula solo cuando cambian la lista, la búsqueda o el filtro
  recompensasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    return this.recompensas().filter(
      (f) => (!texto || (f.nombre).toLowerCase().includes(texto)) && (!filtro || f.tipo === filtro),
    );
  });
  productos = signal<Producto[]>([]);
  guardandoId = signal<string | null>(null);

  // el formulario queda oculto hasta que se toca "Nueva recompensa"
  mostrarFormulario = signal(false);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal<string | null>(null);

  recompensaForm = new FormGroup({
    tipo: new FormControl<TipoRecompensa>('entrada', { nonNullable: true }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    productoId: new FormControl('', { nonNullable: true }),
    formato: new FormControl<Formato | ''>('', { nonNullable: true }),
    puntos: new FormControl(500, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
  });

  constructor(
    private recompensasService: RecompensasService,
    private candyBarService: CandyBarService,
  ) {}

  async ngOnInit() {
    const [productos] = await Promise.all([this.candyBarService.getProductosActivos(), this.recargar()]);
    this.productos.set(productos);
  }

  private async recargar() {
    this.cargando.set(true);
    this.recompensas.set(await this.recompensasService.getTodas());
    this.cargando.set(false);
  }

  detalle(recompensa: Recompensa): string {
    if (recompensa.tipo === 'producto') return 'Producto del candy bar';
    return recompensa.formato
      ? `Entrada general, solo funciones ${recompensa.formato.toUpperCase()}`
      : 'Entrada general, cualquier formato';
  }

  onNueva() {
    this.recompensaForm.reset();
    this.errorMsg.set(null);
    this.exito.set(null);
    this.mostrarFormulario.set(true);
  }

  onCancelar() {
    this.recompensaForm.reset();
    this.errorMsg.set(null);
    this.mostrarFormulario.set(false);
  }

  // si elige un producto, sugiero su nombre (lo puede cambiar)
  onElegirProducto(productoId: string) {
    const producto = this.productos().find((p) => p.id === productoId);
    if (producto && !this.recompensaForm.controls.nombre.value) {
      this.recompensaForm.controls.nombre.setValue(producto.nombre);
    }
  }

  async onSubmit() {
    this.errorMsg.set(null);
    this.exito.set(null);

    if (this.recompensaForm.invalid) {
      this.recompensaForm.markAllAsTouched();
      return;
    }

    const valores = this.recompensaForm.getRawValue();
    if (valores.tipo === 'producto' && !valores.productoId) {
      this.errorMsg.set('Elegí el producto del candy bar.');
      return;
    }

    this.guardando.set(true);
    const { error } = await this.recompensasService.crear({
      nombre: valores.nombre.trim(),
      tipo: valores.tipo,
      productoId: valores.productoId || null,
      formato: valores.formato || null,
      puntos: valores.puntos,
    });
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.exito.set('Recompensa creada.');
    this.recompensaForm.reset();
    this.mostrarFormulario.set(false);
    await this.recargar();
  }

  async onGuardarPuntos(recompensa: Recompensa, valor: string) {
    const puntos = Math.floor(Number(valor));
    if (!puntos || puntos < 1) {
      this.errorMsg.set('Los puntos tienen que ser 1 o más.');
      return;
    }

    this.errorMsg.set(null);
    this.guardandoId.set(recompensa.id);
    const { error } = await this.recompensasService.actualizarPuntos(recompensa.id, puntos);
    this.guardandoId.set(null);

    if (error) this.errorMsg.set(error);
    await this.recargar();
  }

  async onToggleActiva(recompensa: Recompensa) {
    this.errorMsg.set(null);
    this.guardandoId.set(recompensa.id);
    const { error } = await this.recompensasService.actualizarActiva(recompensa.id, !recompensa.activa);
    this.guardandoId.set(null);

    if (error) this.errorMsg.set(error);
    await this.recargar();
  }
}
