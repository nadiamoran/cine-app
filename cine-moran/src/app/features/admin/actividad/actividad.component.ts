import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActividadService, RegistroActividad } from './actividad.service';

// RF-55: quién creó qué función, quién modificó un precio y quién validó
// un QR, con fecha y hora.
@Component({
  selector: 'app-actividad',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './actividad.component.html',
})
export class ActividadComponent implements OnInit {
  readonly tipos = [
    { valor: '', etiqueta: 'Todo' },
    { valor: 'funcion', etiqueta: 'Funciones' },
    { valor: 'precio', etiqueta: 'Precios' },
    { valor: 'validacion', etiqueta: 'Validaciones de QR' },
  ];

  cargando = signal(true);
  registros = signal<RegistroActividad[]>([]);
  tipoElegido = signal('');

  registrosFiltrados = computed(() => {
    const tipo = this.tipoElegido();
    return tipo ? this.registros().filter((r) => r.tipo === tipo) : this.registros();
  });

  constructor(private actividadService: ActividadService) {}

  async ngOnInit() {
    await this.recargar();
  }

  async recargar() {
    this.cargando.set(true);
    this.registros.set(await this.actividadService.getRegistros());
    this.cargando.set(false);
  }
}
