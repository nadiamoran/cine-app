import { Component, OnInit, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SalasService } from '../../salas/salas.service';
import { SalaConButacas } from '../../salas/sala.model';
import { FuncionesService } from '../../funciones/funciones.service';
import { Formato, PrecioEntrada } from '../../funciones/funcion.model';

@Component({
  selector: 'app-gestionar-salas',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gestionar-salas.component.html',
})
export class GestionarSalasComponent implements OnInit {
  cargando = signal(true);
  salas = signal<SalaConButacas[]>([]);
  guardandoId = signal<string | null>(null);

  // el formulario de alta queda oculto hasta que se toca "Nueva sala"
  mostrarFormulario = signal(false);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  exito = signal<string | null>(null);

  salaForm = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
  });

  // ---- RF-15: precios de entradas por formato (estándar y VIP) ----
  // una fila del FormArray por formato; la cantidad de filas la define la
  // tabla precios_entrada de la base
  preciosForm = new FormArray<
    FormGroup<{ formato: FormControl<Formato>; precio: FormControl<number>; precioVip: FormControl<number> }>
  >([]);
  // el FormArray no es un signal: este avisa a la vista cuando ya se armó
  preciosCargados = signal(false);
  guardandoPrecios = signal(false);
  errorPrecios = signal<string | null>(null);
  exitoPrecios = signal<string | null>(null);

  constructor(
    private salasService: SalasService,
    private funcionesService: FuncionesService,
  ) {}

  async ngOnInit() {
    await Promise.all([this.recargar(), this.cargarPrecios()]);
  }

  private async cargarPrecios() {
    const precios = await this.funcionesService.getPrecios();
    this.preciosForm.clear();
    for (const p of precios) {
      this.preciosForm.push(
        new FormGroup({
          formato: new FormControl<Formato>(p.formato, { nonNullable: true }),
          precio: new FormControl(p.precio, {
            nonNullable: true,
            validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
          }),
          precioVip: new FormControl(p.precioVip, {
            nonNullable: true,
            validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
          }),
        }),
      );
    }
    this.preciosCargados.set(true);
  }

  // la VIP tiene que costar más que la estándar (la base lo vuelve a validar)
  vipNoEsMayor(index: number): boolean {
    const { precio, precioVip } = this.preciosForm.at(index).getRawValue();
    return precioVip <= precio;
  }

  async onGuardarPrecios() {
    this.errorPrecios.set(null);
    this.exitoPrecios.set(null);

    if (this.preciosForm.invalid) {
      this.preciosForm.markAllAsTouched();
      this.errorPrecios.set('Completá todos los precios con números enteros mayores a $0.');
      return;
    }
    if (this.preciosForm.controls.some((_, i) => this.vipNoEsMayor(i))) {
      this.errorPrecios.set('La butaca VIP tiene que costar más que la estándar en todos los formatos.');
      return;
    }

    this.guardandoPrecios.set(true);
    const precios: PrecioEntrada[] = this.preciosForm.getRawValue();
    const { error } = await this.funcionesService.guardarPrecios(precios);
    this.guardandoPrecios.set(false);

    if (error) {
      this.errorPrecios.set(error);
      return;
    }
    this.exitoPrecios.set('Precios guardados. Se actualizaron las funciones que todavía no empezaron.');
    await this.cargarPrecios();
  }

  private async recargar() {
    this.cargando.set(true);
    this.salas.set(await this.salasService.getTodas());
    this.cargando.set(false);
  }

  onNuevaSala() {
    this.salaForm.reset();
    this.errorMsg.set(null);
    this.exito.set(null);
    // sugiero el siguiente nombre, el admin lo puede cambiar
    this.salaForm.setValue({ nombre: `Sala ${this.salas().length + 1}` });
    this.mostrarFormulario.set(true);
  }

  async onCambiarEstado(sala: SalaConButacas, valor: string) {
    this.errorMsg.set(null);
    this.exito.set(null);
    this.guardandoId.set(sala.id);
    const { error } = await this.salasService.actualizarHabilitada(sala.id, valor === 'habilitada');
    this.guardandoId.set(null);

    if (error) {
      this.errorMsg.set(error);
    }
    await this.recargar();
  }

  onCancelar() {
    this.salaForm.reset();
    this.errorMsg.set(null);
    this.mostrarFormulario.set(false);
  }

  async onSubmit() {
    this.errorMsg.set(null);
    this.exito.set(null);

    if (this.salaForm.invalid) {
      this.salaForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const nombre = this.salaForm.getRawValue().nombre.trim();
    const { error } = await this.salasService.crear(nombre);
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.exito.set(`${nombre} creada.`);
    this.salaForm.reset();
    this.mostrarFormulario.set(false);
    await this.recargar();
  }
}
