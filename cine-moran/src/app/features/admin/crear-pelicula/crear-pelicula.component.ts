import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeliculasService } from '../../catalogo/peliculas.service';
import { ESTADOS_PELICULA, EstadoPelicula, Pelicula } from '../../catalogo/pelicula.model';

@Component({
  selector: 'app-crear-pelicula',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './crear-pelicula.component.html',
})
export class CrearPeliculaComponent implements OnInit {
  readonly estados = ESTADOS_PELICULA;

  @ViewChild('inputImagen') inputImagen?: ElementRef<HTMLInputElement>;

  // el formulario de alta queda oculto hasta que se toca "Nueva película"
  mostrarFormulario = signal(false);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);

  archivoImagen = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  // peliculas ya cargadas, para poder cambiarles el estado
  cargando = signal(true);
  peliculas = signal<Pelicula[]>([]);
  guardandoId = signal<string | null>(null);

  // generos que ya existen en otras peliculas; el admin elige de esta lista
  generosDisponibles = signal<string[]>([]);

  peliculaForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sinopsis: new FormControl('', { nonNullable: true }),
    duracionMinutos: new FormControl(90, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    generos: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [(c) => (c.value.length ? null : { required: true })],
    }),
    restriccionEdad: new FormControl('sin_restriccion', { nonNullable: true }),
    estado: new FormControl<EstadoPelicula>('en_cartelera', { nonNullable: true }),
    fechaEstreno: new FormControl('', { nonNullable: true }),
  });

  // por si el genero todavia no existe en ninguna pelicula
  nuevoGenero = new FormControl('', { nonNullable: true });

  constructor(private peliculasService: PeliculasService) {}

  async ngOnInit() {
    await this.recargar();
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

    this.guardando.set(true);
    const valores = this.peliculaForm.getRawValue();

    let imagenUrl: string | null = null;
    if (this.archivoImagen()) {
      imagenUrl = await this.peliculasService.subirImagen(this.archivoImagen()!);
    }

    const { error } = await this.peliculasService.crear({
      nombre: valores.nombre,
      sinopsis: valores.sinopsis,
      duracionMinutos: valores.duracionMinutos,
      generos: valores.generos,
      restriccionEdad: valores.restriccionEdad,
      fechaEstreno: valores.fechaEstreno || null,
      imagenUrl,
      estado: valores.estado,
    });

    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.limpiarFormulario();
    this.mostrarFormulario.set(false);
    await this.recargar();
  }

  onNuevaPelicula() {
    this.limpiarFormulario();
    this.mostrarFormulario.set(true);
  }

  onCancelar() {
    this.limpiarFormulario();
    this.mostrarFormulario.set(false);
  }

  private limpiarFormulario() {
    this.peliculaForm.reset();
    this.nuevoGenero.setValue('');
    this.archivoImagen.set(null);
    this.previewUrl.set(null);
    this.errorMsg.set(null);
    if (this.inputImagen) this.inputImagen.nativeElement.value = '';
  }
}
