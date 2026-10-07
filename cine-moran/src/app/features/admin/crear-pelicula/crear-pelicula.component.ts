import { Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeliculasService } from '../../catalogo/peliculas.service';
import { ESTADOS_PELICULA, EstadoPelicula, Pelicula } from '../../catalogo/pelicula.model';
import { FuncionesService } from '../../funciones/funciones.service';
import { PrecioEntrada } from '../../funciones/funcion.model';
import { infoPreventa } from '../../catalogo/preventa.utils';
import { TablaPreventaComponent } from './tabla-preventa.component';
import { fechaEnRangoValidator } from '../../../shared/validators/fecha.validators';

// estreno: desde 1900 hasta 5 años adelante
const anioMaximoEstreno = new Date().getFullYear() + 5;

@Component({
  selector: 'app-crear-pelicula',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, TablaPreventaComponent],
  templateUrl: './crear-pelicula.component.html',
})
export class CrearPeliculaComponent implements OnInit {
  readonly estados = ESTADOS_PELICULA;

  @ViewChild('inputImagen') inputImagen?: ElementRef<HTMLInputElement>;

  // el formulario queda oculto hasta que se toca "Nueva película" o "Editar"
  mostrarFormulario = signal(false);
  // null = creando una película nueva; con id = editando esa película
  editandoId = signal<string | null>(null);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);

  archivoImagen = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  // peliculas ya cargadas, para poder cambiarles el estado
  cargando = signal(true);
  peliculas = signal<Pelicula[]>([]);

  // buscador por nombre y filtro por estado del listado
  busqueda = signal('');
  filtroEstado = signal<EstadoPelicula | ''>('');

  // se recalcula solo cuando cambian las películas, la búsqueda o el filtro
  peliculasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.filtroEstado();
    return this.peliculas().filter(
      (p) => (!texto || p.nombre.toLowerCase().includes(texto)) && (!estado || p.estado === estado),
    );
  });
  guardandoId = signal<string | null>(null);

  // generos que ya existen en otras peliculas; el admin elige de esta lista
  generosDisponibles = signal<string[]>([]);

  peliculaForm = new FormGroup({
    // pattern(/\S/): al menos un carácter que no sea espacio ("   " no vale)
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    sinopsis: new FormControl('', { nonNullable: true }),
    // entera y con máximo: una duración absurda bloquearía la sala por días
    duracionMinutos: new FormControl(90, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(600), Validators.pattern(/^\d+$/)],
    }),
    generos: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [(c) => (c.value.length ? null : { required: true })],
    }),
    restriccionEdad: new FormControl('sin_restriccion', { nonNullable: true }),
    estado: new FormControl<EstadoPelicula>('en_cartelera', { nonNullable: true }),
    fechaEstreno: new FormControl('', {
      nonNullable: true,
      validators: [fechaEnRangoValidator(1900, anioMaximoEstreno)],
    }),
    // RF-29: preventa (necesita fecha de estreno)
    tienePreventa: new FormControl({ value: false, disabled: true }, { nonNullable: true }),
    preventaDescuento: new FormControl<number | null>(null),
  });

  // por si el genero todavia no existe en ninguna pelicula
  nuevoGenero = new FormControl('', { nonNullable: true });

  // ---- RF-29: preventa ----
  // tabla general de precios, para la vista previa con el descuento
  precios = signal<PrecioEntrada[]>([]);

  constructor(
    private peliculasService: PeliculasService,
    private funcionesService: FuncionesService,
  ) {
    // sin fecha de estreno no hay preventa: la casilla queda deshabilitada
    this.peliculaForm.controls.fechaEstreno.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((fecha) => this.habilitarPreventa(this.peliculaForm.controls.tienePreventa, !!fecha));
  }

  async ngOnInit() {
    const [precios] = await Promise.all([this.funcionesService.getPrecios(), this.recargar()]);
    this.precios.set(precios);
  }

  private habilitarPreventa(control: FormControl<boolean>, hayFecha: boolean) {
    if (hayFecha) {
      control.enable({ emitEvent: false });
    } else {
      control.setValue(false, { emitEvent: false });
      control.disable({ emitEvent: false });
    }
  }

  // misma regla que el trigger de la base (migración 023); devuelve el error o null
  private validarPreventa(fechaEstreno: string, tienePreventa: boolean, descuento: number | null) {
    if (!tienePreventa) return null;
    if (!fechaEstreno) return 'Cargá la fecha de estreno para activar la preventa.';
    if (!descuento || descuento <= 0) return 'Ingresá el descuento de preventa (mayor a $0).';
    const minimo = Math.min(...this.precios().map((p) => p.precio));
    if (this.precios().length > 0 && descuento >= minimo) {
      return `El descuento tiene que ser menor que $${minimo} (la entrada estándar más barata).`;
    }
    return null;
  }

  // columna "Preventa" del listado
  estadoPreventa(pelicula: Pelicula) {
    return infoPreventa(pelicula).estado;
  }

  etiquetaPreventa(pelicula: Pelicula): string {
    const etiquetas = {
      sin_preventa: 'Sin preventa',
      por_abrir: 'Programada',
      abierta: 'Preventa activa',
      terminada: 'Terminada',
    };
    return etiquetas[infoPreventa(pelicula).estado];
  }

  // texto corto para la fila del listado
  resumenPreventa(pelicula: Pelicula): string | null {
    const info = infoPreventa(pelicula);
    if (info.estado === 'sin_preventa') return null;
    if (info.estado === 'terminada') return `Preventa terminada (-$${info.descuento})`;
    if (info.estado === 'abierta') return `Preventa abierta: -$${info.descuento}`;
    const apertura = info.apertura!.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    return `Preventa: -$${info.descuento} · abre el ${apertura}`;
  }

  private async recargar() {
    this.cargando.set(true);
    const [peliculas, generos] = await Promise.all([
      this.peliculasService.getTodas(),
      this.peliculasService.getGeneros(),
    ]);
    this.peliculas.set(peliculas);
    // conservo los generos nuevos que se agregaron a mano y todavia no se guardaron
    this.generosDisponibles.set(this.ordenar([...new Set([...generos, ...this.generosDisponibles()])]));
    this.cargando.set(false);
  }

  private ordenar(generos: string[]) {
    return generos.sort((a, b) => a.localeCompare(b));
  }

  etiquetaEstado(estado: EstadoPelicula) {
    return this.estados.find((e) => e.valor === estado)?.etiqueta ?? estado;
  }

  generoSeleccionado(genero: string) {
    return this.peliculaForm.controls.generos.value.includes(genero);
  }

  onToggleGenero(genero: string) {
    const control = this.peliculaForm.controls.generos;
    const actuales = control.value;
    control.setValue(
      actuales.includes(genero) ? actuales.filter((g) => g !== genero) : [...actuales, genero],
    );
    control.markAsTouched();
  }

  onAgregarGenero() {
    const genero = this.nuevoGenero.value.trim();
    if (!genero) return;

    // si ya existe (sin importar mayusculas), uso el que ya estaba cargado
    const existente = this.generosDisponibles().find(
      (g) => g.toLowerCase() === genero.toLowerCase(),
    );
    if (!existente) {
      this.generosDisponibles.set(this.ordenar([...this.generosDisponibles(), genero]));
    }
    if (!this.generoSeleccionado(existente ?? genero)) {
      this.onToggleGenero(existente ?? genero);
    }
    this.nuevoGenero.setValue('');
  }

  async onCambiarEstado(pelicula: Pelicula, estado: string) {
    this.guardandoId.set(pelicula.id);
    const { error } = await this.peliculasService.actualizarEstado(
      pelicula.id,
      estado as EstadoPelicula,
    );
    this.guardandoId.set(null);

    if (error) {
      this.errorMsg.set(error);
    }
    await this.recargar();
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.archivoImagen.set(archivo);

    // genero una vista previa local (no sube nada todavía, es solo para que
    // veas qué elegiste antes de guardar)
    if (archivo) {
      this.previewUrl.set(URL.createObjectURL(archivo));
    } else {
      this.previewUrl.set(null);
    }
  }

  async onSubmit() {
    this.errorMsg.set(null);

    if (this.peliculaForm.invalid) {
      this.peliculaForm.markAllAsTouched();
      return;
    }

    const valores = this.peliculaForm.getRawValue();
    const errorPreventa = this.validarPreventa(
      valores.fechaEstreno,
      valores.tienePreventa,
      valores.preventaDescuento,
    );
    if (errorPreventa) {
      this.errorMsg.set(errorPreventa);
      return;
    }

    this.guardando.set(true);

    // al editar, si no se elige otra imagen queda la que ya tenía
    let imagenUrl: string | null = null;
    if (this.archivoImagen()) {
      imagenUrl = await this.peliculasService.subirImagen(this.archivoImagen()!);
    }

    const datos = {
      nombre: valores.nombre,
      sinopsis: valores.sinopsis,
      duracionMinutos: valores.duracionMinutos,
      generos: valores.generos,
      restriccionEdad: valores.restriccionEdad,
      fechaEstreno: valores.fechaEstreno || null,
      imagenUrl,
      estado: valores.estado,
      preventaDescuento: valores.tienePreventa ? valores.preventaDescuento : null,
    };

    const id = this.editandoId();
    const { error } = id
      ? await this.peliculasService.actualizar(id, datos)
      : await this.peliculasService.crear(datos);

    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(false);
    await this.recargar();
  }

  onNuevaPelicula() {
    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(true);
  }

  // abre el mismo formulario del alta con los datos de la película
  onEditar(pelicula: Pelicula) {
    this.limpiarFormulario();
    this.peliculaForm.setValue({
      nombre: pelicula.nombre,
      sinopsis: pelicula.sinopsis ?? '',
      duracionMinutos: pelicula.duracionMinutos,
      generos: [...pelicula.generos],
      restriccionEdad: pelicula.restriccionEdad,
      estado: pelicula.estado,
      fechaEstreno: pelicula.fechaEstreno ?? '',
      tienePreventa: pelicula.preventaDescuento !== null,
      preventaDescuento: pelicula.preventaDescuento,
    });
    this.habilitarPreventa(this.peliculaForm.controls.tienePreventa, !!pelicula.fechaEstreno);
    // muestra la imagen actual; si se elige otra, la reemplaza al guardar
    this.previewUrl.set(pelicula.imagen_url);
    this.editandoId.set(pelicula.id);
    this.mostrarFormulario.set(true);
    // el formulario está arriba del listado: lo llevo a la vista
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCancelar() {
    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(false);
  }

  private limpiarFormulario() {
    this.peliculaForm.reset();
    this.habilitarPreventa(this.peliculaForm.controls.tienePreventa, false);
    this.nuevoGenero.setValue('');
    this.archivoImagen.set(null);
    this.previewUrl.set(null);
    this.errorMsg.set(null);
    if (this.inputImagen) this.inputImagen.nativeElement.value = '';
  }
}
