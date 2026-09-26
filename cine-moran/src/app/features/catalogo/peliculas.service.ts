import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service'; // ajustá el path si difiere
import { Pelicula } from './pelicula.model';

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
      .eq('visible_home', true)
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
    const hoy = new Date().toISOString().split('T')[0]; // yyyy-mm-dd

    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .gt('fecha_estreno', hoy)
      .order('fecha_estreno', { ascending: true });

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
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('peliculas').insert({
      nombre: datos.nombre,
      sinopsis: datos.sinopsis,
      duracion_minutos: datos.duracionMinutos,
      generos: datos.generos,
      restriccion_edad: datos.restriccionEdad,
      fecha_estreno: datos.fechaEstreno || null,
      imagen_url: datos.imagenUrl,
    });

    return { error: error?.message ?? null };
  }


}