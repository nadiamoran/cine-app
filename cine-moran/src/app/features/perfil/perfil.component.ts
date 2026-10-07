import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OrdenesService } from '../ordenes/ordenes.service';
import { CompraHistorial, MovimientoCredito } from '../ordenes/orden.model';
import { RecompensasService } from '../puntos/recompensas.service';
import { MovimientoPuntos } from '../puntos/recompensa.model';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './perfil.component.html',
})
export class PerfilComponent implements OnInit {
  cargando = signal(true);
  historial = signal<CompraHistorial[]>([]);
  movimientosCredito = signal<MovimientoCredito[]>([]);
  // RF-36: historial de canjes (y de todo lo que sumó o restó puntos)
  movimientosPuntos = signal<MovimientoPuntos[]>([]);

  // RF-44: cancelación de compras
  cancelandoId = signal<string | null>(null);
  errorCancelacion = signal<string | null>(null);
  exitoCancelacion = signal<string | null>(null);

  constructor(
    protected authService: AuthService,
    private ordenesService: OrdenesService,
    private recompensasService: RecompensasService,
    private router: Router,
  ) {}

  async ngOnInit() {
    // admin y empleado no tienen puntos ni compras de cliente: el admin va a
    // su panel y el empleado a validar entradas
    const rol = this.authService.currentUser()?.rol;
    if (rol === 'administrador' || rol === 'empleado') {
      this.router.navigate([rol === 'administrador' ? '/admin' : '/empleado/validar'], {
        replaceUrl: true,
      });
      return;
    }

    await this.recargar();
  }

  private async recargar() {
    const usuario = this.authService.currentUser();
    if (!usuario) return;

    this.cargando.set(true);
    const [historial, movimientos, movimientosPuntos] = await Promise.all([
      this.ordenesService.getHistorial(usuario.id),
      this.ordenesService.getMovimientosCredito(),
      this.recompensasService.getMovimientos(),
    ]);
    this.historial.set(historial);
    this.movimientosCredito.set(movimientos);
    this.movimientosPuntos.set(movimientosPuntos);
    this.cargando.set(false);
  }

  // solo para mostrar el botón: la regla real (2 h antes, nada usado, que
  // sea suya) la valida cancelar_orden en la base
  puedeCancelar(compra: CompraHistorial): boolean {
    if (compra.estado !== 'confirmada' || !compra.funcionInicio) return false;
    const limite = new Date(compra.funcionInicio).getTime() - 2 * 60 * 60 * 1000;
    return Date.now() < limite;
  }

  async onCancelar(compra: CompraHistorial) {
    const confirmado = confirm(
      `¿Cancelar tu compra de "${compra.peliculaNombre}"? No se devuelve dinero: ` +
        `se te acreditan $${compra.total} de crédito para futuras compras.`,
    );
    if (!confirmado) return;

    this.errorCancelacion.set(null);
    this.exitoCancelacion.set(null);
    this.cancelandoId.set(compra.id);
    const { creditoAcreditado, puntosDescontados, puntosDevueltos, error } =
      await this.ordenesService.cancelar(compra.id);
    this.cancelandoId.set(null);

    if (error) {
      this.errorCancelacion.set(error);
      return;
    }

    const detallePuntos = [
      puntosDescontados > 0 ? `se descontaron ${puntosDescontados} puntos ganados` : '',
      puntosDevueltos > 0 ? `se devolvieron ${puntosDevueltos} puntos canjeados` : '',
    ].filter(Boolean);
    this.exitoCancelacion.set(
      `Compra cancelada. Se acreditaron $${creditoAcreditado} de crédito` +
        (detallePuntos.length > 0 ? `; ${detallePuntos.join(' y ')}.` : '.'),
    );
    await Promise.all([this.authService.recargarPerfil(), this.recargar()]);
  }
}
