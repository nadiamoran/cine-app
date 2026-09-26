import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PeliculasService } from '../../catalogo/peliculas.service';

@Component({
  selector: 'app-crear-pelicula',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './crear-pelicula.component.html',
})
export class CrearPeliculaComponent {
  guardando = signal(false);
  errorMsg = signal<string | null>(null);

  archivoImagen = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  peliculaForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sinopsis: new FormControl('', { nonNullable: true }),
    duracionMinutos: new FormControl(90, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    generosTexto: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    restriccionEdad: new FormControl('sin_restriccion', { nonNullable: true }),
    fechaEstreno: new FormControl('', { nonNullable: true }),
  });

  constructor(
    private peliculasService: PeliculasService,
    private router: Router,
  ) {}

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
      generos: valores.generosTexto.split(',').map((g) => g.trim()).filter(Boolean),
      restriccionEdad: valores.restriccionEdad,
      fechaEstreno: valores.fechaEstreno || null,
      imagenUrl,
    });

    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.router.navigate(['/']);
  }
}
