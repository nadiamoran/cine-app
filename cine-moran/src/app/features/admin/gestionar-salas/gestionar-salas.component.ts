import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SalasService } from '../../salas/salas.service';
import { SalaConButacas } from '../../salas/sala.model';

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

  constructor(private salasService: SalasService) {}

  async ngOnInit() {
    await this.recargar();
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
