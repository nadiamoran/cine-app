import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PropuestasService } from '../../propuestas/propuestas.service';
import { Propuesta } from '../../propuestas/propuesta.model';

@Component({
  selector: 'app-gestionar-propuestas',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './gestionar-propuestas.component.html',
})
export class GestionarPropuestasComponent implements OnInit {
  cargando = signal(true);
  propuestas = signal<Propuesta[]>([]);
  resolviendoId = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  pendientes = computed(() => this.propuestas().filter((p) => p.estado === 'pendiente'));
  resueltas = computed(() => this.propuestas().filter((p) => p.estado !== 'pendiente'));

  constructor(
    private propuestasService: PropuestasService,
    private router: Router,
  ) {}

  async ngOnInit() {
    await this.recargar();
  }

  private async recargar() {
    this.cargando.set(true);
    this.propuestas.set(await this.propuestasService.getTodas());
    this.cargando.set(false);
  }

  // aceptar la marca como aceptada y abre el alta de película con sus datos
  async onAceptar(propuesta: Propuesta) {
    if (!(await this.resolver(propuesta, 'aceptada'))) return;
    this.router.navigate(['/admin/crear-pelicula'], { queryParams: { propuesta: propuesta.id } });
  }

  async onRechazar(propuesta: Propuesta) {
    if (!(await this.resolver(propuesta, 'rechazada'))) return;
    await this.recargar();
  }

  private async resolver(propuesta: Propuesta, estado: 'aceptada' | 'rechazada') {
    this.errorMsg.set(null);
    this.resolviendoId.set(propuesta.id);
    const { error } = await this.propuestasService.cambiarEstado(propuesta.id, estado);
    this.resolviendoId.set(null);

    if (error) {
      this.errorMsg.set(error);
      return false;
    }
    return true;
  }
}
