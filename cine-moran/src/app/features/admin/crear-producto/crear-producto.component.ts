import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandyBarService } from '../../candy-bar/candy-bar.service';
import { Categoria } from '../../candy-bar/producto.model';

@Component({
  selector: 'app-crear-producto',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './crear-producto.component.html',
})
export class CrearProductoComponent implements OnInit {
  categorias = signal<Categoria[]>([]);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal(false);

  productoForm = new FormGroup({
    categoriaId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    precio: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  });

  nuevaCategoriaForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor(private candyBarService: CandyBarService) {}

  async ngOnInit() {
    await this.recargarCategorias();
  }

  private async recargarCategorias() {
    this.categorias.set(await this.candyBarService.getCategorias());
  }

  async onCrearCategoria() {
    if (this.nuevaCategoriaForm.invalid) return;
    await this.candyBarService.crearCategoria(this.nuevaCategoriaForm.getRawValue().nombre);
    this.nuevaCategoriaForm.reset({ nombre: '' });
    await this.recargarCategorias();
  }

  async onSubmit() {
    this.errorMsg.set(null);
    this.exito.set(false);

    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const { error } = await this.candyBarService.crearProducto(this.productoForm.getRawValue());
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.exito.set(true);
    this.productoForm.patchValue({ nombre: '', precio: 0 });
  }
}
