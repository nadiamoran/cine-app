import { Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase.service'; // ajustá el path si difiere

@Injectable({ providedIn: 'root' })
export class AlertasService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  // devuelve el set de peliculaId que el usuario ya tiene alertados
  async getAlertasUsuario(usuarioId: string): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('alertas_estreno')
      .select('pelicula_id')
      .eq('usuario_id', usuarioId);

    if (error || !data) return new Set();
    return new Set(data.map((row) => row.pelicula_id));
  }

  async activar(peliculaId: string, usuarioId: string) {
    const { error } = await this.supabase
      .from('alertas_estreno')
      .insert({ pelicula_id: peliculaId, usuario_id: usuarioId });
    return { error: error?.message ?? null };
  }

  async desactivar(peliculaId: string, usuarioId: string) {
    const { error } = await this.supabase
      .from('alertas_estreno')
      .delete()
      .eq('pelicula_id', peliculaId)
      .eq('usuario_id', usuarioId);
    return { error: error?.message ?? null };
  }
}