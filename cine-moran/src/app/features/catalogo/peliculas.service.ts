import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service'; // ajustá el path si difiere
import { EstadoPelicula, Pelicula } from './pelicula.model';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  // fecha de hoy como "yyyy-mm-dd" (igual que fecha_estreno en la base)
  private hoy(): string {
    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${ahora.getFullYear()}-${mes}-${dia}`;
  }

  async getCartelera(): Promise<Pelicula[]> {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      // las que el admin puso "En cartelera", más las "Próximamente" cuyo
      // estreno ya llegó: el día del estreno pasan solas a la cartelera
      .or(`estado.eq.en_cartelera,and(estado.eq.proximamente,fecha_estreno.lte.${this.hoy()})`)
      // más vendidas primero (RF-04): ventas lo mantienen los triggers de
      // la migración 020 (cantidad de entradas vendidas)
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
    // las que el admin marcó como "Próximamente" y todavía no se estrenaron
    // (o sin fecha: "a confirmar"); las que tienen fecha van primero,
    // ordenadas por esa fecha. Desde el día del estreno salen de acá y
    // aparecen en la cartelera (getCartelera)
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*')
      .eq('estado', 'proximamente')
      .or(`fecha_estreno.is.null,fecha_estreno.gt.${this.hoy()}`)
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
      preventaDescuento: row.preventa_descuento ?? null,
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
    preventaDescuento: number | null;
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
      preventa_descuento: datos.preventaDescuento,
    });

    return { error: error?.message ?? null };
  }

  // Edita todos los datos de una película. La imagen solo se cambia si se
  // subió una nueva (imagenUrl distinto de null). La base sigue validando la
  // preventa con su trigger (migración 023).
  async actualizar(
    id: string,
    datos: {
      nombre: string;
      sinopsis: string;
      duracionMinutos: number;
      generos: string[];
      restriccionEdad: string;
      fechaEstreno: string | null;
      imagenUrl: string | null;
      estado: EstadoPelicula;
      preventaDescuento: number | null;
    },
  ): Promise<{ error: string | null }> {
    const cambios: Record<string, unknown> = {
      nombre: datos.nombre,
      sinopsis: datos.sinopsis,
      duracion_minutos: datos.duracionMinutos,
      generos: datos.generos,
      restriccion_edad: datos.restriccionEdad,
      fecha_estreno: datos.fechaEstreno || null,
      estado: datos.estado,
      preventa_descuento: datos.preventaDescuento,
    };
    if (datos.imagenUrl) cambios['imagen_url'] = datos.imagenUrl;

    const { error } = await this.supabase.from('peliculas').update(cambios).eq('id', id);
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