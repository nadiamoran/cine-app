import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Funcion, Formato, Idioma } from './funcion.model';

@Injectable({ providedIn: 'root' })
export class FuncionesService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async getById(id: string): Promise<Funcion | null> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*, salas(nombre)')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      peliculaId: data.pelicula_id,
      salaId: data.sala_id,
      nombreSala: data.salas?.nombre ?? '',
      inicio: data.inicio,
      fin: data.fin,
      formato: data.formato,
      idioma: data.idioma,
      precio: data.precio,
    };
  }

  async getByPelicula(peliculaId: string): Promise<Funcion[]> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*, salas(nombre)')
      .eq('pelicula_id', peliculaId)
      .gte('inicio', new Date().toISOString()) // solo funciones que todavía no arrancaron
      .order('inicio', { ascending: true });

    if (error || !data) {
      console.error('Error trayendo funciones:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      peliculaId: row.pelicula_id,
      salaId: row.sala_id,
      nombreSala: row.salas?.nombre ?? '',
      inicio: row.inicio,
      fin: row.fin,
      formato: row.formato,
      idioma: row.idioma,
      precio: row.precio,
    }));
  }

  // La sala la elige la base de datos (funcion asignar_funcion): busca la
  // primera sala libre respetando los 30 min de margen entre funciones.
  async crear(datos: {
    peliculaId: string;
    inicio: string;
    formato: Formato;
    idioma: Idioma;
    precio: number;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.rpc('asignar_funcion', {
      p_pelicula_id: datos.peliculaId,
      p_inicio: datos.inicio,
      p_formato: datos.formato,
      p_idioma: datos.idioma,
      p_precio: datos.precio,
    });

    return { error: error?.message ?? null };
  }
}
