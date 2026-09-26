import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeliculasService } from '../../catalogo/peliculas.service';
import { Pelicula } from '../../catalogo/pelicula.model';
import { FuncionesService } from '../../funciones/funciones.service';
import { Formato, Idioma } from '../../funciones/funcion.model';

@Component({
  selector: 'app-crear-funcion',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './crear-funcion.component.html',
})
export class CrearFuncionComponent implements OnInit {
  peliculas = signal<Pelicula[]>([]);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal(false);

  funcionForm = new FormGroup({
    peliculaId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fecha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    hora: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    formato: new FormControl<Formato>('2d', { nonNullable: true }),
    idioma: new FormControl<Idioma>('castellano', { nonNullable: true }),
    precio: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  });

  constructor(
    private peliculasService: PeliculasService,
    private funcionesService: FuncionesService,
  ) {}

  async ngOnInit() {
    this.peliculas.set(await this.peliculasService.getTodas());
  }

  async onSubmit() {
    this.errorMsg.set(null);
    this.exito.set(false);

    if (this.funcionForm.invalid) {
      this.funcionForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const valores = this.funcionForm.getRawValue();

    // el <input type="date"> + <input type="time"> se combinan en un ISO local
    const inicio = new Date(`${valores.fecha}T${valores.hora}`).toISOString();

    const { error } = await this.funcionesService.crear({
      peliculaId: valores.peliculaId,
      inicio,
      formato: valores.formato,
      idioma: valores.idioma,
      precio: valores.precio,
    });

    this.guardando.set(false);

    if (error) {
      // "No hay ninguna sala libre..." es el mensaje que tira la funcion SQL asignar_funcion
      this.errorMsg.set(error);
      return;
    }

    this.exito.set(true);
    this.funcionForm.patchValue({ fecha: '', hora: '' });
  }
}
