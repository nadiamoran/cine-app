import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandyBarService } from '../../candy-bar/candy-bar.service';
import { Combo, Producto } from '../../candy-bar/producto.model';
import { detalleCombo } from '../../candy-bar/combo.utils';

@Component({
  selector: 'app-crear-combo',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './crear-combo.component.html',
})
export class CrearComboComponent implements OnInit {
  @ViewChild('inputImagen') inputImagen?: ElementRef<HTMLInputElement>;

  // combos ya cargados, para poder activarlos o desactivarlos
  cargando = signal(true);
  combos = signal<Combo[]>([]);
  guardandoId = signal<string | null>(null);

  // el formulario de alta queda oculto hasta que se toca "Nuevo combo"
  mostrarFormulario = signal(false);

  productos = signal<Producto[]>([]);
  cantidades = signal<Map<string, number>>(new Map());

  archivoImagen = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal<string | null>(null);

  comboForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    precio: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
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
    this.mostrarFormulario.set(true);
  }

  onCancelar() {
    this.limpiarFormulario();
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

    const { error } = await this.candyBarService.crearCombo({
      ...this.comboForm.getRawValue(),
      imagenUrl,
      productos,
    });
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.exito.set('Combo creado.');
    this.limpiarFormulario();
    this.mostrarFormulario.set(false);
    await this.recargar();
  }

  private limpiarFormulario() {
    this.comboForm.reset();
    this.cantidades.set(new Map());
    this.archivoImagen.set(null);
    this.previewUrl.set(null);
    this.errorMsg.set(null);
    if (this.inputImagen) this.inputImagen.nativeElement.value = '';
  }
}
