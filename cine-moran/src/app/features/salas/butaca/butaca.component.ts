import { Component, input, output } from '@angular/core';
import { Butaca } from '../sala.model';
import { ButacaTipoDirective } from '../../../shared/directives/butaca-tipo.directive';

// Componente "tonto": no sabe nada de la compra ni de quién más está mirando
// la sala. Solo muestra una butaca y avisa (output) cuando la tocan; el padre
// (MapaSalaComponent) decide qué hacer con ese clic.
@Component({
  selector: 'app-butaca',
  standalone: true,
  imports: [ButacaTipoDirective],
  templateUrl: './butaca.component.html',
})
export class ButacaComponent {
  butaca = input.required<Butaca>();
  seleccionada = input(false);
  ocupada = input(false);

  seleccionar = output<Butaca>();

  onClick() {
    if (this.ocupada()) return;
    this.seleccionar.emit(this.butaca());
  }
}
