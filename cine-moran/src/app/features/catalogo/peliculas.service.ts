import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service'; // ajustá el path si difiere
import { EstadoPelicula, Pelicula } from './pelicula.model';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async getCartelera(): Promise<Pelicula[]> {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      // el admin decide qué se ve en la cartelera con el estado de la película
      .eq('estado', 'en_cartelera')
      // más vendidas primero (RF-07); hoy todas están en 0, se va a notar
      // cuando exista el módulo de compra
      .order('ventas', { ascending: false })
      .order('nombre', { ascending: true });

    if (error || !data) {
      console.error('Error trayendo cartelera:', error);
      return [];
    }

    return data.map((row) => this.mapRow(row));
  }

  async getTodas(): Promise<Pelicula[]> {
    // para selects de administrador: todas las peliculas, esten o no en cartelera
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .order('nombre', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => this.mapRow(row));
  }

   async getById(id: string): Promise<Pelicula | null> {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapRow(data);
  }

    async getProximamente(): Promise<Pelicula[]> {
    // las que el admin marcó como "Próximamente"; las que tienen fecha de
    // estreno van primero, ordenadas por esa fecha
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .eq('estado', 'proximamente')
      .order('fecha_estreno', { ascending: true, nullsFirst: false });

    if (error || !data) return [];
    return data.map((row) => this.mapRow(row));
  }

  private mapRow(row: any): Pelicula {
    return {
      id: row.id,
      nombre: row.nombre,
      imagen_url: row.imagen_url,
      sinopsis: row.sinopsis,
      duracionMinutos: row.duracion_minutos,
      generos: row.generos ?? [],
      restriccionEdad: row.restriccion_edad,
      ventas: row.ventas,
      fechaEstreno: row.fecha_estreno,
      estado: row.estado ?? 'en_cartelera',
    };
  }

  async subirImagen(archivo: File): Promise<string | null> {
    const extension = archivo.name.split('.').pop();
    const nombreArchivo = `${crypto.randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage
      .from('peliculas')
      .upload(nombreArchivo, archivo);

    if (error) {
      console.error('Error subiendo imagen:', error);
      return null;
    }

    const { data } = this.supabase.storage.from('peliculas').getPublicUrl(nombreArchivo);
    return data.publicUrl;
  }

  async crear(datos: {
    nombre: string;
    sinopsis: string;
    duracionMinutos: number;
    generos: string[];
    restriccionEdad: string;
    fechaEstreno: string | null;
    imagenUrl: string | null;
    estado: EstadoPelicula;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('peliculas').insert({
      nombre: datos.nombre,
      sinopsis: datos.sinopsis,
      duracion_minutos: datos.duracionMinutos,
      generos: datos.generos,
      restriccion_edad: datos.restriccionEdad,
      fecha_estreno: datos.fechaEstreno || null,
      imagen_url: datos.imagenUrl,
      estado: datos.estado,
    });

    return { error: error?.message ?? null };
  }

  async actualizarEstado(id: string, estado: EstadoPelicula): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('peliculas').update({ estado }).eq('id', id);
    return { error: error?.message ?? null };
  }

  async getGeneros(): Promise<string[]> {
    // no hay tabla de generos: los saco de las peliculas ya cargadas
    const { data, error } = await this.supabase.from('peliculas').select('generos');
    if (error || !data) return [];

    const set = new Set<string>();
    for (const row of data) {
      for (const g of row.generos ?? []) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }


}