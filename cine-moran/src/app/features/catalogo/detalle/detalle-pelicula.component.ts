import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeliculasService } from '../peliculas.service';
import { ResenasService } from './resenas.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Pelicula } from '../pelicula.model';
import { Resena } from './resena.model';
import { DuracionPipe } from '../../../shared/pipes/duracion.pipe';
import { FuncionesService } from '../../funciones/funciones.service';
import { Funcion } from '../../funciones/funcion.model';
import { OrdenesService } from '../../ordenes/ordenes.service';
import { infoPreventa, precioVigente } from '../preventa.utils';

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [RouterLink, DuracionPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './detalle-pelicula.component.html',
})
export class DetallePeliculaComponent implements OnInit {
  pelicula = signal<Pelicula | null>(null);
  funciones = signal<Funcion[]>([]);
  resenas = signal<Resena[]>([]);
  cargando = signal(true);
  enviandoResena = signal(false);
  errorResena = signal<string | null>(null);
  yaVioPelicula = signal(false);

  // RF-29: estado de la preventa (sin preventa / por abrir / abierta / terminada)
  readonly precioVigente = precioVigente;
  preventa = computed(() => {
    const pelicula = this.pelicula();
    return pelicula ? infoPreventa(pelicula) : null;
  });

  // se recalcula solo cuando cambia la lista de reseñas
  promedio = computed(() => {
    const lista = this.resenas();
    if (lista.length === 0) return 0;
    const suma = lista.reduce((acc, r) => acc + r.estrellas, 0);
    return Math.round((suma / lista.length) * 10) / 10; // un decimal
  });

  // ya dejó reseña? no le muestro el formulario de nuevo (coincide con el unique de la base)
  yaDejoResena = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    return this.resenas().some((r) => r.usuarioId === user.id);
  });

  resenaForm = new FormGroup({
    estrellas: new FormControl(5, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(5)],
    }),
    comentario: new FormControl('', { nonNullable: true }),
  });

  private peliculaId!: string;

  constructor(
    private route: ActivatedRoute,
    private peliculasService: PeliculasService,
    private resenasService: ResenasService,
    private funcionesService: FuncionesService,
    private ordenesService: OrdenesService,
    protected authService: AuthService,
  ) {}

  async ngOnInit() {
    this.peliculaId = this.route.snapshot.paramMap.get('id')!;
    this.cargando.set(true);

    // con la sesión ya restaurada: si no, al entrar directo (o recargar) no
    // sabría que el usuario está logueado y no lo dejaría calificar
    await this.authService.sesionLista;
    const usuario = this.authService.currentUser();

    const [pelicula, resenas, funciones, yaVioPelicula] = await Promise.all([
      this.peliculasService.getById(this.peliculaId),
      this.resenasService.getByPelicula(this.peliculaId),
      this.funcionesService.getByPelicula(this.peliculaId),
      usuario ? this.ordenesService.yaVioPelicula(this.peliculaId) : Promise.resolve(false),
    ]);

    this.pelicula.set(pelicula);
    this.resenas.set(resenas);
    this.funciones.set(funciones);
    this.yaVioPelicula.set(yaVioPelicula);
    this.cargando.set(false);
  }

  async onSubmitResena() {
    this.errorResena.set(null);
    const user = this.authService.currentUser();
    if (!user) return;

    if (this.resenaForm.invalid) {
      this.resenaForm.markAllAsTouched();
      return;
    }

    this.enviandoResena.set(true);
    const { estrellas, comentario } = this.resenaForm.getRawValue();
    const { error } = await this.resenasService.crear(this.peliculaId, user.id, estrellas, comentario);
    this.enviandoResena.set(false);

    if (error) {
      this.errorResena.set(error);
      return;
    }

    // recargamos reseñas para que se vea la nueva y el promedio actualizado
    this.resenas.set(await this.resenasService.getByPelicula(this.peliculaId));
    this.resenaForm.reset(); // vuelve a los valores iniciales (5 estrellas, sin comentario)
  }
}