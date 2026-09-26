import { Directive, ElementRef, Input, OnChanges } from '@angular/core';
import { TipoButaca } from '../../features/salas/sala.model';

@Directive({
  selector: '[appButacaTipo]',
  standalone: true,
})
export class ButacaTipoDirective implements OnChanges {
  @Input('appButacaTipo') tipo!: TipoButaca;

  private readonly clases: TipoButaca[] = ['estandar', 'vip', 'accesible'];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges() {
    // saco cualquier clase de tipo anterior y pongo la que corresponde ahora
    for (const clase of this.clases) {
      this.el.nativeElement.classList.remove(`butaca-${clase}`);
    }
    this.el.nativeElement.classList.add(`butaca-${this.tipo}`);
  }
}