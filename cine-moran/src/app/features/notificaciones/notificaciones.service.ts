import { Injectable, computed, effect, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacion } from './notificacion.model';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  notificaciones = signal<Notificacion[]>([]);
  noLeidas = computed(() => this.notificaciones().filter((n) => !n.leida).length);

  private canal: RealtimeChannel | null = null;
  private usuarioEscuchado: string | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
  ) {
    // las notificaciones son del cliente: al iniciar sesión se cargan y se
    // empieza a escuchar; al cerrarla se corta todo
    effect(() => {
      const usuario = this.authService.currentUser();
      const usuarioId = usuario?.rol === 'cliente' ? usuario.id : null;
      untracked(() => this.escuchar(usuarioId));
    });
  }

  private get supabase() {
    return this.supabaseService.client;
  }

  private async escuchar(usuarioId: string | null) {
    if (usuarioId === this.usuarioEscuchado) return;

    if (this.canal) {
      this.supabase.removeChannel(this.canal);
      this.canal = null;
    }
    this.usuarioEscuchado = usuarioId;
    this.notificaciones.set([]);
    if (!usuarioId) return;

    const { data } = await this.supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    // si mientras tanto cambió la sesión, esta carga ya no corresponde
    if (this.usuarioEscuchado !== usuarioId) return;
    this.notificaciones.set((data ?? []).map(this.mapNotificacion));

    // Supabase Realtime: llega cada notificación nueva sin recargar la página
    this.canal = this.supabase
      .channel(`notificaciones-${usuarioId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${usuarioId}`,
        },
        (payload) => {
          this.notificaciones.update((lista) => [this.mapNotificacion(payload.new), ...lista]);
        },
      )
      .subscribe();
  }

  async marcarLeida(id: string) {
    const { error } = await this.supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    if (error) return;
    this.notificaciones.update((lista) => lista.map((n) => (n.id === id ? { ...n, leida: true } : n)));
  }

  async marcarTodasLeidas() {
    const { error } = await this.supabase.from('notificaciones').update({ leida: true }).eq('leida', false);
    if (error) return;
    this.notificaciones.update((lista) => lista.map((n) => ({ ...n, leida: true })));
  }

  private mapNotificacion(row: any): Notificacion {
    return {
      id: row.id,
      titulo: row.titulo,
      mensaje: row.mensaje,
      enlace: row.enlace,
      leida: row.leida,
      createdAt: row.created_at,
    };
  }
}
