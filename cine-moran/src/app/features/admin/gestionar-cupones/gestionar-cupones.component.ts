import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OrdenesService } from '../../ordenes/ordenes.service';
import { Cupon } from '../../ordenes/orden.model';

@Component({
  selector: 'app-gestionar-cupones',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gestionar-cupones.component.html',
})
export class GestionarCuponesComponent implements OnInit {
  cargando = signal(true);
  cupones = signal<Cupon[]>([]);
  guardandoId = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  creando = signal(false);

  nuevoCuponForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    porcentaje: new FormControl(10, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(100)] }),
    edadMinima: new FormControl(50, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
  });

  constructor(private ordenesService: OrdenesService) {}

  async ngOnInit() {
    await this.recargar();
  }

  private async recargar() {
    this.cargando.set(true);
    this.cupones.set(await this.ordenesService.getCupones());
    this.cargando.set(false);
  }

  async onGuardarPorcentaje(cupon: Cupon, porcentajeTexto: string) {
    const porcentaje = Number(porcentajeTexto);
    if (!porcentaje || porcentaje <= 0 || porcentaje > 100) return;

    this.guardandoId.set(cupon.id);
    await this.ordenesService.actualizarCupon(cupon.id, { porcentaje });
    this.guardandoId.set(null);
    await this.recargar();
  }

  async onToggleActivo(cupon: Cupon) {
    this.guardandoId.set(cupon.id);
    await this.ordenesService.actualizarCupon(cupon.id, { activo: !cupon.activo });
    this.guardandoId.set(null);
    await this.recargar();
  }

  async onCrearCupon() {
    this.errorMsg.set(null);
    if (this.nuevoCuponForm.invalid) {
      this.nuevoCuponForm.markAllAsTouched();
      return;
    }

    this.creando.set(true);
    const valores = this.nuevoCuponForm.getRawValue();
    const { error } = await this.ordenesService.crearCupon({
      nombre: valores.nombre,
      porcentaje: valores.porcentaje,
      requiereEdadMinima: valores.edadMinima,
    });
    this.creando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.nuevoCuponForm.reset({ nombre: '', porcentaje: 10, edadMinima: 50 });
    await this.recargar();
  }
}
