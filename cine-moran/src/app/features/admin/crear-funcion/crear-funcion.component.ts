import { Component, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeliculasService } from '../../catalogo/peliculas.service';
import { Pelicula } from '../../catalogo/pelicula.model';
import { FuncionesService } from '../../funciones/funciones.service';
import { Formato, Funcion, Idioma, PrecioEntrada } from '../../funciones/funcion.model';
import { fechaEnRangoValidator } from '../../../shared/validators/fecha.validators';

// funciones: este año, el anterior (para editar) y hasta 2 años adelante
const fechaFuncionValida = fechaEnRangoValidator(new Date().getFullYear() - 1, new Date().getFullYear() + 2);

@Component({
  selector: 'app-crear-funcion',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './crear-funcion.component.html',
})
export class CrearFuncionComponent implements OnInit {
  peliculas = signal<Pelicula[]>([]);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal<string | null>(null);

  // RF-15: el precio no se carga acá, sale de la tabla de precios por
  // formato (pantalla Salas). Se trae solo para mostrarlo como dato.
  precios = signal<PrecioEntrada[]>([]);

  // funciones actuales, para poder editarlas o eliminarlas
  cargando = signal(true);
  funciones = signal<Funcion[]>([]);

  // buscador y filtro del listado (mismo mecanismo que en Películas)
  busqueda = signal('');
  filtro = signal('');
  readonly opcionesFiltro = [
    { valor: '2d', etiqueta: '2D' },
    { valor: '3d', etiqueta: '3D' },
    { valor: '4d', etiqueta: '4D' },
    { valor: '5d', etiqueta: '5D' },
  ];

  // se recalcula solo cuando cambian la lista, la búsqueda o el filtro
  funcionesFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    return this.funciones().filter(
      (f) => (!texto || (f.nombrePelicula ?? '').toLowerCase().includes(texto)) && (!filtro || f.formato === filtro),
    );
  });
  eliminandoId = signal<string | null>(null);

  // el formulario queda oculto hasta que se toca "Nueva función" o "Editar"
  mostrarFormulario = signal(false);
  // null = creando una función nueva; con id = editando esa función
  editandoId = signal<string | null>(null);

  funcionForm = new FormGroup({
    peliculaId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fecha: new FormControl('', { nonNullable: true, validators: [Validators.required, fechaFuncionValida] }),
    hora: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    formato: new FormControl<Formato>('2d', { nonNullable: true }),
    idioma: new FormControl<Idioma>('castellano', { nonNullable: true }),
  });

  // ---- programación recurrente: patrón de días + horarios + período ----
  mostrarProgramacion = signal(false);

  readonly diasSemana = [
    { valor: 1, etiqueta: 'Lun' },
    { valor: 2, etiqueta: 'Mar' },
    { valor: 3, etiqueta: 'Mié' },
    { valor: 4, etiqueta: 'Jue' },
    { valor: 5, etiqueta: 'Vie' },
    { valor: 6, etiqueta: 'Sáb' },
    { valor: 7, etiqueta: 'Dom' },
  ];
  diasElegidos = signal<number[]>([]);
  horasElegidas = signal<string[]>([]);
  nuevaHora = new FormControl('', { nonNullable: true });

  programacionForm = new FormGroup({
    peliculaId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    desde: new FormControl('', { nonNullable: true, validators: [Validators.required, fechaFuncionValida] }),
    hasta: new FormControl('', { nonNullable: true, validators: [Validators.required, fechaFuncionValida] }),
    formato: new FormControl<Formato>('2d', { nonNullable: true }),
    idioma: new FormControl<Idioma>('castellano', { nonNullable: true }),
  });

  // lo que devuelve la vista previa: cada función con su sala (o null si no hay lugar)
  vistaPrevia = signal<{ inicio: string; salaNombre: string | null }[] | null>(null);
  cantidadConSala = computed(() => (this.vistaPrevia() ?? []).filter((f) => f.salaNombre).length);
  cantidadSinSala = computed(() => (this.vistaPrevia() ?? []).filter((f) => !f.salaNombre).length);

  constructor(
    private peliculasService: PeliculasService,
    private funcionesService: FuncionesService,
  ) {
    // si cambia algo del patrón, la vista previa anterior ya no vale
    this.programacionForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.vistaPrevia.set(null));
  }

  async ngOnInit() {
    const [peliculas, precios] = await Promise.all([
      this.peliculasService.getTodas(),
      this.funcionesService.getPrecios(),
    ]);
    this.peliculas.set(peliculas);
    this.precios.set(precios);
    await this.recargar();
  }

  private async recargar() {
    this.cargando.set(true);
    this.funciones.set(await this.funcionesService.getProximas());
    this.cargando.set(false);
  }

  precioDe(formato: Formato): PrecioEntrada | undefined {
    return this.precios().find((p) => p.formato === formato);
  }

  onNuevaFuncion() {
    this.limpiarFormulario();
    this.exito.set(null);
    this.editandoId.set(null);
    this.mostrarProgramacion.set(false);
    this.mostrarFormulario.set(true);
  }

  onProgramarFunciones() {
    this.limpiarProgramacion();
    this.exito.set(null);
    this.mostrarFormulario.set(false);
    this.editandoId.set(null);
    this.mostrarProgramacion.set(true);
  }

  onCancelarProgramacion() {
    this.limpiarProgramacion();
    this.mostrarProgramacion.set(false);
  }

  diaElegido(dia: number) {
    return this.diasElegidos().includes(dia);
  }

  onToggleDia(dia: number) {
    const actuales = this.diasElegidos();
    this.diasElegidos.set(
      actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia].sort(),
    );
    this.vistaPrevia.set(null);
  }

  onAgregarHora() {
    const hora = this.nuevaHora.value;
    if (!hora) return;
    if (!this.horasElegidas().includes(hora)) {
      this.horasElegidas.set([...this.horasElegidas(), hora].sort());
      this.vistaPrevia.set(null);
    }
    this.nuevaHora.setValue('');
  }

  onQuitarHora(hora: string) {
    this.horasElegidas.set(this.horasElegidas().filter((h) => h !== hora));
    this.vistaPrevia.set(null);
  }

  // atajos para el período, así no hay que buscar la fecha en el calendario
  onAtajoPeriodo(atajo: '2-semanas' | '1-mes' | 'fin-de-mes') {
    const desdeTexto = this.programacionForm.controls.desde.value;
    const desde = desdeTexto ? new Date(`${desdeTexto}T00:00`) : new Date();
    const hasta = new Date(desde);

    if (atajo === '2-semanas') hasta.setDate(hasta.getDate() + 13);
    if (atajo === '1-mes') hasta.setMonth(hasta.getMonth() + 1);
    if (atajo === 'fin-de-mes') hasta.setMonth(hasta.getMonth() + 1, 0);

    this.programacionForm.patchValue({
      desde: this.fechaLocal(desde),
      hasta: this.fechaLocal(hasta),
    });
  }

  private datosProgramacion() {
    const valores = this.programacionForm.getRawValue();
    return {
      peliculaId: valores.peliculaId,
      dias: this.diasElegidos(),
      horas: this.horasElegidas(),
      desde: valores.desde,
      hasta: valores.hasta,
      formato: valores.formato,
      idioma: valores.idioma,
    };
  }

  private programacionValida(): boolean {
    if (this.programacionForm.invalid) {
      this.programacionForm.markAllAsTouched();
      return false;
    }
    if (this.diasElegidos().length === 0) {
      this.errorMsg.set('Elegí al menos un día de la semana.');
      return false;
    }
    if (this.horasElegidas().length === 0) {
      this.errorMsg.set('Agregá al menos un horario.');
      return false;
    }
    return true;
  }

  async onVistaPrevia() {
    this.errorMsg.set(null);
    this.exito.set(null);
    if (!this.programacionValida()) return;

    this.guardando.set(true);
    const { resultado, error } = await this.funcionesService.programar(this.datosProgramacion(), false);
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }
    if (resultado.length === 0) {
      this.errorMsg.set('Con esos días y ese período no queda ninguna función por crear.');
      return;
    }
    this.vistaPrevia.set(resultado);
  }

  async onConfirmarProgramacion() {
    this.errorMsg.set(null);
    this.exito.set(null);
    if (!this.programacionValida()) return;

    this.guardando.set(true);
    const { resultado, error } = await this.funcionesService.programar(this.datosProgramacion(), true);
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    const creadas = resultado.filter((f) => f.salaNombre).length;
    const sinLugar = resultado.length - creadas;
    this.exito.set(
      `Se crearon ${creadas} función(es).` +
        (sinLugar > 0 ? ` ${sinLugar} no se crearon por falta de sala libre.` : ''),
    );
    this.limpiarProgramacion();
    this.mostrarProgramacion.set(false);
    await this.recargar();
  }

  private limpiarProgramacion() {
    this.programacionForm.reset();
    this.programacionForm.patchValue({ desde: this.fechaLocal(new Date()) });
    this.diasElegidos.set([]);
    this.horasElegidas.set([]);
    this.nuevaHora.setValue('');
    this.vistaPrevia.set(null);
    this.errorMsg.set(null);
  }

  onEditar(funcion: Funcion) {
    this.limpiarFormulario();
    this.exito.set(null);
    this.mostrarProgramacion.set(false);
    const inicio = new Date(funcion.inicio);
    this.funcionForm.setValue({
      peliculaId: funcion.peliculaId,
      fecha: this.fechaLocal(inicio),
      hora: this.horaLocal(inicio),
      formato: funcion.formato,
      idioma: funcion.idioma,
    });
    this.editandoId.set(funcion.id);
    this.mostrarFormulario.set(true);
  }

  onCancelar() {
    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(false);
  }

  async onEliminar(funcion: Funcion) {
    const confirmado = confirm(
      `¿Eliminar la función de "${funcion.nombrePelicula}" en ${funcion.nombreSala}?`,
    );
    if (!confirmado) return;

    this.errorMsg.set(null);
    this.exito.set(null);
    this.eliminandoId.set(funcion.id);
    const { error } = await this.funcionesService.eliminar(funcion.id);
    this.eliminandoId.set(null);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    if (this.editandoId() === funcion.id) this.onCancelar();
    this.exito.set('Función eliminada.');
    await this.recargar();
  }

  async onSubmit() {
    this.errorMsg.set(null);
    this.exito.set(null);

    if (this.funcionForm.invalid) {
      this.funcionForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const valores = this.funcionForm.getRawValue();

    // el <input type="date"> + <input type="time"> se combinan en un ISO local
    const inicio = new Date(`${valores.fecha}T${valores.hora}`).toISOString();
    const datos = {
      peliculaId: valores.peliculaId,
      inicio,
      formato: valores.formato,
      idioma: valores.idioma,
    };

    const id = this.editandoId();
    const { error } = id
      ? await this.funcionesService.editar(id, datos)
      : await this.funcionesService.crear(datos);

    this.guardando.set(false);

    if (error) {
      // "No hay ninguna sala libre..." es el mensaje que tiran las funciones SQL
      this.errorMsg.set(error);
      return;
    }

    this.exito.set(id ? 'Función actualizada.' : 'Función creada.');
    this.limpiarFormulario();
    this.editandoId.set(null);
    this.mostrarFormulario.set(false);
    await this.recargar();
  }

  private limpiarFormulario() {
    this.funcionForm.reset();
    this.errorMsg.set(null);
  }

  // yyyy-mm-dd y hh:mm en hora local, que es lo que esperan los inputs date/time
  private fechaLocal(fecha: Date) {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private horaLocal(fecha: Date) {
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${horas}:${minutos}`;
  }
}
