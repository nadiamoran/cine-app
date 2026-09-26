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
    // Join con profiles para mostrar el nombre de quien comentó
    const { data, error } = await this.supabase
      .from('resenas')
      .select('*, profiles(nombre)')
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
      nombreUsuario: row.profiles?.nombre ?? 'Usuario',
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