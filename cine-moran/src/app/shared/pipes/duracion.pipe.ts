import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duracion',
  standalone: true,
})
export class DuracionPipe implements PipeTransform {
  transform(minutos: number): string {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas === 0) return `${mins}m`;
    return `${horas}h ${mins}m`;
  }
}