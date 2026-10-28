import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { EstadoPropuesta, Propuesta } from './propuesta.model';

@Injectable({ providedIn: 'root' })
export class PropuestasService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  // RLS filtra sola: el cliente recibe las suyas y el admin todas
  async getTodas(): Promise<Propuesta[]> {
    const { data, error } = await this.supabase
      .from('propuestas_peliculas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(this.mapPropuesta);
  }

  async getById(id: string): Promise<Propuesta | null> {
    const { data, error } = await this.supabase
      .from('propuestas_peliculas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return this.mapPropuesta(data);
  }

  async crear(usuarioId: string, datos: { titulo: string; descripcion: string; motivo: string }) {
    const { error } = await this.supabase.from('propuestas_peliculas').insert({
      usuario_id: usuarioId,
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion.trim(),
      motivo: datos.motivo.trim(),
    });

    // 23505 = unique violation: ya tiene una propuesta pendiente
    if (error?.code === '23505') {
      return { error: 'Ya tenés una propuesta en revisión. Esperá a que el cine la resuelva.' };
    }
    return { error: error?.message ?? null };
  }

  async cambiarEstado(id: string, estado: EstadoPropuesta) {
    const { error } = await this.supabase
      .from('propuestas_peliculas')
      .update({ estado })
      .eq('id', id);
    return { error: error?.message ?? null };
  }

  private mapPropuesta(row: any): Propuesta {
    return {
      id: row.id,
      titulo: row.titulo,
      descripcion: row.descripcion,
      motivo: row.motivo,
      estado: row.estado,
      createdAt: row.created_at,
    };
  }
}
