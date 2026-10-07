import { Component, computed, effect, input, output, signal } from '@angular/core';

// "yyyy-mm-dd" en hora local (el mismo formato que usan los formularios)
function fechaTexto(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// RNF-02: el cliente no quiere el calendario desplegable ("demasiado scroll").
// En su lugar: día y mes en desplegables cortos, el año en un desplegable (si
// son pocos) o escrito, y opcionalmente atajos con los próximos días.
//
// Componente reutilizable con input() / output(): recibe la fecha actual del
// formulario ("yyyy-mm-dd" o "") y avisa cada cambio con (cambio). Si la
// fecha está incompleta o no existe (ej: 31/02), avisa "".
@Component({
  selector: 'app-selector-fecha',
  standalone: true,
  templateUrl: './selector-fecha.component.html',
})
export class SelectorFechaComponent {
  valor = input<string>('');
  anioMinimo = input.required<number>();
  anioMaximo = input.required<number>();
  // cuántos atajos de "próximos días" mostrar (0 = ninguno)
  proximosDias = input(0);

  cambio = output<string>();

  readonly dias = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  dia = signal('');
  mes = signal('');
  anio = signal('');

  // pocos años: desplegable; muchos (ej: fecha de nacimiento): se escribe
  aniosEnLista = computed(() => {
    const cantidad = this.anioMaximo() - this.anioMinimo() + 1;
    if (cantidad > 12) return null;
    return Array.from({ length: cantidad }, (_, i) => this.anioMinimo() + i);
  });

  atajos = computed(() => {
    const hoy = new Date();
    return Array.from({ length: this.proximosDias() }, (_, i) => {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
      const etiqueta =
        i === 0
          ? 'Hoy'
          : i === 1
            ? 'Mañana'
            : `${DIAS_SEMANA[fecha.getDay()]} ${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      return { valor: fechaTexto(fecha), etiqueta };
    });
  });

  // la fecha armada con lo elegido, o null si está incompleta o no existe
  fechaElegida = computed(() => {
    const dia = Number(this.dia());
    const mes = Number(this.mes());
    const anio = Number(this.anio());
    if (!dia || !mes || !/^\d{4}$/.test(this.anio())) return null;

    const fecha = new Date(anio, mes - 1, dia);
    // si el día no existe en ese mes (31/02), Date "se pasa" al mes siguiente
    if (fecha.getMonth() !== mes - 1) return null;
    return fechaTexto(fecha);
  });

  fechaInexistente = computed(
    () => !!this.dia() && !!this.mes() && /^\d{4}$/.test(this.anio()) && !this.fechaElegida(),
  );

  // lo último que se avisó al formulario: si el formulario devuelve ese mismo
  // valor no se pisa lo que el usuario está eligiendo (ej: puso el día y
  // todavía no el mes)
  private ultimoAvisado: string | null = null;

  constructor() {
    // cuando el formulario cambia la fecha desde afuera (al editar, al
    // limpiar, con un atajo de período), se reparte en día / mes / año
    effect(() => {
      const valor = this.valor();
      if (valor === this.ultimoAvisado) return;
      const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor ?? '');
      this.anio.set(partes ? partes[1] : '');
      this.mes.set(partes ? String(Number(partes[2])) : '');
      this.dia.set(partes ? String(Number(partes[3])) : '');
    });
  }

  onDia(valor: string) {
    this.dia.set(valor);
    this.avisar();
  }

  onMes(valor: string) {
    this.mes.set(valor);
    this.avisar();
  }

  onAnio(valor: string) {
    this.anio.set(valor.trim());
    this.avisar();
  }

  onAtajo(valor: string) {
    const [anio, mes, dia] = valor.split('-');
    this.anio.set(anio);
    this.mes.set(String(Number(mes)));
    this.dia.set(String(Number(dia)));
    this.avisar();
  }

  esAtajoElegido(valor: string) {
    return this.fechaElegida() === valor;
  }

  private avisar() {
    const fecha = this.fechaElegida() ?? '';
    this.ultimoAvisado = fecha;
    this.cambio.emit(fecha);
  }
}
