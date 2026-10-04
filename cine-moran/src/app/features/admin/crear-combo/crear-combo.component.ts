import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandyBarService } from '../../candy-bar/candy-bar.service';
import { Producto } from '../../candy-bar/producto.model';

@Component({
  selector: 'app-crear-combo',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './crear-combo.component.html',
})
export class CrearComboComponent implements OnInit {
  productos = signal<Producto[]>([]);
  cantidades = signal<Map<string, number>>(new Map());

  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal(false);

  comboForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    precio: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  });

  constructor(private candyBarService: CandyBarService) {}

  async ngOnInit() {
    this.productos.set(await this.candyBarService.getProductosActivos());
  }

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

  async onSubmit() {
    this.errorMsg.set(null);
    this.exito.set(false);

    if (this.comboForm.invalid) {
      this.comboForm.markAllAsTouched();
      return;
    }

    if (this.cantidades().size === 0) {
      this.errorMsg.set('Elegí al menos un producto para el combo.');
      return;
    }

    this.guardando.set(true);
    const productos = Array.from(this.cantidades().entries()).map(([productoId, cantidad]) => ({
      productoId,
      cantidad,
    }));

    const { error } = await this.candyBarService.crearCombo({
      ...this.comboForm.getRawValue(),
      productos,
    });
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.exito.set(true);
    this.comboForm.reset({ nombre: '', precio: 0 });
    this.cantidades.set(new Map());
  }
}
