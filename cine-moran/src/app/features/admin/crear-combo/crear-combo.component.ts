import { Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandyBarService } from '../../candy-bar/candy-bar.service';
import { Combo, Producto } from '../../candy-bar/producto.model';
import { detalleCombo } from '../../candy-bar/combo.utils';

@Component({
  selector: 'app-crear-combo',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './crear-combo.component.html',
})
export class CrearComboComponent implements OnInit {
  @ViewChild('inputImagen') inputImagen?: ElementRef<HTMLInputElement>;

  // combos ya cargados, para poder activarlos o desactivarlos
  cargando = signal(true);
  combos = signal<Combo[]>([]);

  // buscador y filtro del listado (mismo mecanismo que en Películas)
  busqueda = signal('');
  filtro = signal('');

  // se recalcula solo cuando cambian la lista, la búsqueda o el filtro
  combosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    return this.combos().filter(
      (f) => (!texto || (f.nombre).toLowerCase().includes(texto)) && (!filtro || (filtro === 'activo') === f.activo),
    );
  });
  guardandoId = signal<string | null>(null);

  // el formulario queda oculto hasta que se toca "Nuevo combo" o "Editar"
  mostrarFormulario = signal(false);
  // null = creando un combo nuevo; con id = editando ese combo
  editandoId = signal<string | null>(null);
  // foto que ya tiene el combo que se está editando
  imagenActual = signal<string | null>(null);

  productos = signal<Producto[]>([]);
  cantidades = signal<Map<string, number>>(new Map());

  archivoImagen = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal<string | null>(null);

  comboForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    // precio en pesos enteros y mayor a $0
    precio: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)] }),
    entradasIncluidas: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  });

  constructor(private candyBarService: CandyBarService) {}

  async ngOnInit() {
    this.productos.set(await this.candyBarService.getProductosActivos());
    await this.recargar();
  }

  private async recargar() {
    this.cargando.set(true);
    this.combos.set(await this.candyBarService.getCombos());
    this.cargando.set(false);
  }

  readonly detalleCombo = detalleCombo;

  cantidadDe(productoId: string): number {
    return this.cantidades().get(productoId) ?? 0;
  }

  onCambiarCantidad(productoId: string, valor: string) {
    const cantidad = Math.max(0, Number(valor) || 0);
    const actuales = new Map(this.cantidades());
    if (cantidad === 0) {
      actuales.delete(productoId);
    } else {
      actuales.set(productoId, cantidad);
    }
    this.cantidades.set(actuales);
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.archivoImagen.set(archivo);

    // vista previa local, todavía no sube nada
    this.previewUrl.set(archivo ? URL.createObjectURL(archivo) : null);
  }

  async onCambiarEstado(combo: Combo, valor: string) {
    this.errorMsg.set(null);
    this.exito.set(null);
    this.guardandoId.set(combo.id);
    const { error } = await this.candyBarService.actualizarComboActivo(combo.id, valor === 'activo');
    this.guardandoId.set(null);

    if (error) {
      this.errorMsg.set(error);
    }
    await this.recargar();
  }

  onNuevoCombo() {
    this.limpiarFormulario();
    this.exito.set(null);
    this.editandoId.set(null);
    this.mostrarFormulario.set(true);
  }

  // abre el mismo formulario del alta con los datos y productos del combo
  onEditar(combo: Combo) {
    this.limpiarFormulario();
    this.exito.set(null);
    this.comboForm.setValue({
      nombre: combo.nombre,
      precio: combo.precio,
      entradasIncluidas: combo.entradasIncluidas,
    });
    this.cantidades.set(new Map(combo.productos.map((p) => [p.productoId, p.cantidad])));
    this.imagenActual.set(combo.imagenUrl);
    this.editandoId.set(combo.id);
    this.mostrarFormulario.set(true);
    // el formulario está arriba del listado: lo llevo a la vista
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCancelar() {
    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(false);
  }

  async onSubmit() {
    this.errorMsg.set(null);
    this.exito.set(null);

    if (this.comboForm.invalid) {
      this.comboForm.markAllAsTouched();
      return;
    }

    if (this.cantidades().size === 0) {
      this.errorMsg.set('Elegí al menos un producto para el combo.');
      return;
    }

    this.guardando.set(true);

    let imagenUrl: string | null = null;
    if (this.archivoImagen()) {
      imagenUrl = await this.candyBarService.subirImagenCombo(this.archivoImagen()!);
    }

    const productos = Array.from(this.cantidades().entries()).map(([productoId, cantidad]) => ({
      productoId,
      cantidad,
    }));

    const datos = { ...this.comboForm.getRawValue(), imagenUrl, productos };
    const id = this.editandoId();
    const { error } = id
      ? await this.candyBarService.actualizarCombo(id, datos)
      : await this.candyBarService.crearCombo(datos);
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.exito.set(id ? 'Combo actualizado.' : 'Combo creado.');
    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(false);
    await this.recargar();
  }

  private limpiarFormulario() {
    this.comboForm.reset();
    this.cantidades.set(new Map());
    this.archivoImagen.set(null);
    this.previewUrl.set(null);
    this.imagenActual.set(null);
    this.errorMsg.set(null);
    if (this.inputImagen) this.inputImagen.nativeElement.value = '';
  }
}
