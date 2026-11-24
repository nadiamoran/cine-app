import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificacionesService } from './notificaciones.service';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './notificaciones.component.html',
})
export class NotificacionesComponent {
  constructor(protected notificacionesService: NotificacionesService) {}
}
