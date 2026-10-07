import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PrecioEntrada } from '../../funciones/funcion.model';
import { infoPreventa } from '../../catalogo/preventa.utils';

// Vista previa de la preventa (RF-29): cuándo abre la venta y cómo quedan
// los precios de la tabla general con el descuento. Componente "tonto": se
// usa en el alta de película y en el panel "Preventa" de cada película.
@Component({
  selector: 'app-tabla-preventa',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (info(); as preventa) {
      @if (preventa.apertura) {
        <p class="detalle-seleccion">
          La venta abre el {{ preventa.apertura | date: 'dd/MM' }} con precio de preventa hasta el
          {{ preventa.ultimoDia | date: 'dd/MM' }}. Desde el estreno vuelve al precio normal.
        </p>
      }
    }

    @if (precios().length > 0 && descuento()) {
      <table class="tabla-precios">
        <thead>
          <tr>
            <th>Formato</th>
            <th>Estándar</th>
            <th>VIP</th>
          </tr>
        </thead>
        <tbody>
          @for (p of precios(); track p.formato) {
            <tr>
              <td>{{ p.formato.toUpperCase() }}</td>
              <td>\${{ p.precio }} → <strong>\${{ p.precio - descuento()! }}</strong></td>
              <td>\${{ p.precioVip }} → <strong>\${{ p.precioVip - descuento()! }}</strong></td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class TablaPreventaComponent {
  precios = input.required<PrecioEntrada[]>();
  descuento = input<number | null>(null);
  fechaEstreno = input<string | null>(null);

  info = computed(() =>
    infoPreventa({ fechaEstreno: this.fechaEstreno(), preventaDescuento: this.descuento() }),
  );
}
