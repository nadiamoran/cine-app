import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Formato } from '../funciones/funcion.model';
import { MovimientoPuntos, Recompensa, TipoRecompensa } from './recompensa.model';

// Recompensas y canje de puntos (migración 025). El canje en sí lo hace
// crear_orden en la base: acá solo se leen y se configuran las recompensas.
@Injectable({ providedIn: 'root' })
export class RecompensasService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  // para la compra: solo las que se pueden canjear hoy
  async getActivas(): Promise<Recompensa[]> {
    const { data, error } = await this.supabase
      .from('recompensas')
      .select('*')
      .eq('activa', true)
      .order('puntos', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => this.mapRow(row));
  }

  // para el admin: todas, activas o no
  async getTodas(): Promise<Recompensa[]> {
    const { data, error } = await this.supabase
      .from('recompensas')
      .select('*')
      .order('tipo', { ascending: true })
      .order('puntos', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => this.mapRow(row));
  }

  async crear(datos: {
    nombre: string;
    tipo: TipoRecompensa;
    productoId: string | null;
    formato: Formato | null;
    puntos: number;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('recompensas').insert({
      nombre: datos.nombre,
      tipo: datos.tipo,
      producto_id: datos.tipo === 'producto' ? datos.productoId : null,
      formato: datos.tipo === 'entrada' ? datos.formato : null,
      puntos: datos.puntos,
    });
    return { error: error?.message ?? null };
  }

  async actualizarPuntos(id: string, puntos: number): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('recompensas').update({ puntos }).eq('id', id);
    return { error: error?.message ?? null };
  }

  // no se borran: los canjes ya hechos las referencian
  async actualizarActiva(id: string, activa: boolean): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('recompensas').update({ activa }).eq('id', id);
    return { error: error?.message ?? null };
  }

  // historial de puntos del usuario logueado (RLS: cada uno ve los suyos)
  async getMovimientos(): Promise<MovimientoPuntos[]> {
    const { data, error } = await this.supabase
      .from('puntos_movimientos')
      .select('id, puntos, motivo, descripcion, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      puntos: row.puntos,
      motivo: row.motivo,
      descripcion: row.descripcion,
      createdAt: row.created_at,
    }));
  }

  private mapRow(row: any): Recompensa {
    return {
      id: row.id,
      nombre: row.nombre,
      tipo: row.tipo,
      productoId: row.producto_id,
      formato: row.formato,
      puntos: row.puntos,
      activa: row.activa,
    };
  }
}
