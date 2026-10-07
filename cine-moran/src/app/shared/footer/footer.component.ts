import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Pie de página de toda la app: datos del cine, horarios y redes
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  readonly anio = new Date().getFullYear();
}
