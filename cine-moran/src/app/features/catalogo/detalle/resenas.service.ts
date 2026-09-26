import { Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase.service'; // ajustá el path si difiere
import { Resena } from './resena.model';

@Injectable({ providedIn: 'root' })
export class ResenasService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async getByPelicula(peliculaId: string): Promise<Resena[]> {
    // resenas_con_autor es una vista (ver supabase/migraciones/001_...sql) que expone
    // solo el nombre del autor. profiles no se puede leer directo: cada usuario solo
    // ve su propia fila, así que un join contra profiles no traería el nombre de los demás.
    const { data, error } = await this.supabase
      .from('resenas_con_autor')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error trayendo reseñas:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      peliculaId: row.pelicula_id,
      usuarioId: row.usuario_id,
      estrellas: row.estrellas,
      comentario: row.comentario,
      createdAt: row.created_at,
      nombreUsuario: row.nombre_usuario ?? 'Usuario',
    }));
  }

  async crear(peliculaId: string, usuarioId: string, estrellas: number, comentario: string) {
    const { error } = await this.supabase.from('resenas').insert({
      pelicula_id: peliculaId,
      usuario_id: usuarioId,
      estrellas,
      comentario: comentario || null,
    });

    return { error: error?.message ?? null };
  }
}