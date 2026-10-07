import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

// Pantalla de inicio del administrador (en vez del perfil de cliente, que
// muestra puntos e historial de compras que al admin no le sirven).
// Acá van a ir también los reportes, gráficos y el log de actividad.
@Component({
  selector: 'app-panel-admin',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './panel-admin.component.html',
})
export class PanelAdminComponent {
  readonly secciones = [
    { ruta: '/admin/crear-pelicula', titulo: 'Películas', detalle: 'Altas, géneros y estado' },
    { ruta: '/admin/crear-funcion', titulo: 'Funciones', detalle: 'Programar, editar y eliminar' },
    { ruta: '/admin/salas', titulo: 'Salas', detalle: 'Nuevas salas y habilitación' },
    { ruta: '/admin/crear-producto', titulo: 'Productos', detalle: 'Candy bar, categorías y fotos' },
    { ruta: '/admin/crear-combo', titulo: 'Combos', detalle: 'Entrada + candy a precio fijo' },
    { ruta: '/admin/cupones', titulo: 'Cupones', detalle: 'Descuentos y porcentajes' },
    { ruta: '/admin/recompensas', titulo: 'Recompensas', detalle: 'Canje de puntos' },
    { ruta: '/admin/reportes', titulo: 'Reportes', detalle: 'Facturación y rankings' },
    { ruta: '/admin/actividad', titulo: 'Actividad', detalle: 'Funciones, precios y validaciones' },
    { ruta: '/admin/validar', titulo: 'Validar entrada', detalle: 'QR o código manual' },
  ];

  constructor(protected authService: AuthService) {}
}
