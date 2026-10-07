import { Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandyBarService } from '../../candy-bar/candy-bar.service';
import { Categoria, Producto } from '../../candy-bar/producto.model';

@Component({
  selector: 'app-crear-producto',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './crear-producto.component.html',
})
export class CrearProductoComponent implements OnInit {
  @ViewChild('inputImagen') inputImagen?: ElementRef<HTMLInputElement>;

  categorias = signal<Categoria[]>([]);

  // productos ya cargados, para poder editarlos o darlos de baja
  cargando = signal(true);
  productos = signal<Producto[]>([]);

  // buscador y filtro del listado (mismo mecanismo que en Películas)
  busqueda = signal('');
  filtro = signal('');

  // se recalcula solo cuando cambian la lista, la búsqueda o el filtro
  productosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    return this.productos().filter(
      (f) => (!texto || (f.nombre).toLowerCase().includes(texto)) && (!filtro || f.categoriaId === filtro),
    );
  });
  guardandoId = signal<string | null>(null);

  // el formulario queda oculto hasta que se toca "Nuevo producto" o "Editar"
  mostrarFormulario = signal(false);
  // null = creando un producto nuevo; con id = editando ese producto
  editandoId = signal<string | null>(null);
  // foto que ya tenía el producto que se está editando
  imagenActual = signal<string | null>(null);

  archivoImagen = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal<string | null>(null);

  productoForm = new FormGroup({
    categoriaId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    // precio en pesos enteros y mayor a $0
    precio: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)] }),
  });

  // por si la categoría todavía no existe
  nuevaCategoria = new FormControl('', { nonNullable: true });

  constructor(private candyBarService: CandyBarService) {}

  async ngOnInit() {
    await Promise.all([this.recargarCategorias(), this.recargar()]);
  }

  private async recargar() {
    this.cargando.set(true);
    this.productos.set(await this.candyBarService.getProductos());
    this.cargando.set(false);
  }

  private async recargarCategorias() {
    this.categorias.set(await this.candyBarService.getCategorias());
  }

  nombreCategoria(categoriaId: string | null): string {
    return this.categorias().find((c) => c.id === categoriaId)?.nombre ?? 'Sin categoría';
  }

  async onCrearCategoria() {
    const nombre = this.nuevaCategoria.value.trim();
    if (!nombre) return;

    this.errorMsg.set(null);
    const { error } = await this.candyBarService.crearCategoria(nombre);
    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.nuevaCategoria.setValue('');
    await this.recargarCategorias();
    // dejo elegida la categoría recién creada
    const creada = this.categorias().find((c) => c.nombre === nombre);
    if (creada) this.productoForm.controls.categoriaId.setValue(creada.id);
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.archivoImagen.set(archivo);

    // vista previa local, todavía no sube nada
    this.previewUrl.set(archivo ? URL.createObjectURL(archivo) : null);
  }

  onNuevoProducto() {
    this.limpiarFormulario();
    this.exito.set(null);
    this.editandoId.set(null);
    this.mostrarFormulario.set(true);
  }

  onEditar(producto: Producto) {
    this.limpiarFormulario();
    this.exito.set(null);
    this.productoForm.setValue({
      categoriaId: producto.categoriaId ?? '',
      nombre: producto.nombre,
      precio: producto.precio,
    });
    this.imagenActual.set(producto.imagenUrl);
    this.editandoId.set(producto.id);
    this.mostrarFormulario.set(true);
    // el formulario está arriba del listado: lo llevo a la vista
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCancelar() {
    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(false);
  }

  async onCambiarEstado(producto: Producto, valor: string) {
    this.errorMsg.set(null);
    this.exito.set(null);
    this.guardandoId.set(producto.id);
    const { error } = await this.candyBarService.actualizarProductoActivo(
      producto.id,
      valor === 'activo',
    );
    this.guardandoId.set(null);

    if (error) {
      this.errorMsg.set(error);
    }
    await this.recargar();
  }

  async onSubmit() {
    this.errorMsg.set(null);
    this.exito.set(null);

    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);

    let imagenUrl: string | null = null;
    if (this.archivoImagen()) {
      imagenUrl = await this.candyBarService.subirImagenProducto(this.archivoImagen()!);
    }

    const valores = this.productoForm.getRawValue();
    const id = this.editandoId();
    const { error } = id
      ? await this.candyBarService.actualizarProducto(id, {
          ...valores,
          // si no eligió foto nueva, se queda la que tenía
          imagenUrl: this.archivoImagen() ? imagenUrl : undefined,
        })
      : await this.candyBarService.crearProducto({ ...valores, imagenUrl });

    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.exito.set(id ? 'Producto actualizado.' : 'Producto creado.');
    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(false);
    await this.recargar();
  }

  private limpiarFormulario() {
    this.productoForm.reset();
    this.nuevaCategoria.setValue('');
    this.archivoImagen.set(null);
    this.previewUrl.set(null);
    this.imagenActual.set(null);
    this.errorMsg.set(null);
    if (this.inputImagen) this.inputImagen.nativeElement.value = '';
  }
}
