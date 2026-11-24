import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { PropuestasService } from '../propuestas.service';
import { EstadoPropuesta, Propuesta } from '../propuesta.model';

@Component({
  selector: 'app-proponer-pelicula',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './proponer-pelicula.component.html',
})
export class ProponerPeliculaComponent implements OnInit {
  readonly etiquetas: Record<EstadoPropuesta, string> = {
    pendiente: 'En revisión',
    aceptada: 'Aceptada',
    rechazada: 'Rechazada',
  };

  cargando = signal(true);
  enviando = signal(false);
  errorMsg = signal<string | null>(null);
  propuestas = signal<Propuesta[]>([]);

  // mientras tenga una pendiente no puede mandar otra
  tienePendiente = computed(() => this.propuestas().some((p) => p.estado === 'pendiente'));

  propuestaForm = new FormGroup({
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }),
    motivo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }),
  });

  constructor(
    private propuestasService: PropuestasService,
    private authService: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    // solo el cliente propone: el admin va a su panel y el empleado a validar
    const rol = this.authService.currentUser()?.rol;
    if (rol === 'administrador' || rol === 'empleado') {
      this.router.navigate([rol === 'administrador' ? '/admin' : '/empleado/validar'], {
        replaceUrl: true,
      });
      return;
    }

    await this.recargar();
  }

  private async recargar() {
    this.cargando.set(true);
    this.propuestas.set(await this.propuestasService.getTodas());
    this.cargando.set(false);
  }

  async onEnviar() {
    this.errorMsg.set(null);

    if (this.propuestaForm.invalid) {
      this.propuestaForm.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    const { error } = await this.propuestasService.crear(
      this.authService.currentUser()!.id,
      this.propuestaForm.getRawValue(),
    );
    this.enviando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.propuestaForm.reset();
    await this.recargar();
  }
}
