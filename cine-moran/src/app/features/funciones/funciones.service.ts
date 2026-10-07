import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Funcion, Formato, Idioma, PrecioEntrada } from './funcion.model';

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
      precioVip: data.precio_vip,
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
      precioVip: row.precio_vip,
    }));
  }

  // La sala la elige la base de datos (funcion asignar_funcion): busca la
  // primera sala libre respetando los 30 min de margen entre funciones.
  // El precio también lo pone la base, según el formato (migración 021).
  async crear(datos: {
    peliculaId: string;
    inicio: string;
    formato: Formato;
    idioma: Idioma;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.rpc('asignar_funcion', {
      p_pelicula_id: datos.peliculaId,
      p_inicio: datos.inicio,
      p_formato: datos.formato,
      p_idioma: datos.idioma,
    });

    return { error: error?.message ?? null };
  }

  // listado de admin: funciones que todavia no terminaron, con el nombre de la pelicula
  async getProximas(): Promise<Funcion[]> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*, salas(nombre), peliculas(nombre)')
      .gte('fin', new Date().toISOString())
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
      precioVip: row.precio_vip,
      nombrePelicula: row.peliculas?.nombre ?? '',
    }));
  }

  // igual que crear: la base vuelve a validar el horario y elige la sala
  // (funcion editar_funcion, migracion 014)
  async editar(
    id: string,
    datos: {
      peliculaId: string;
      inicio: string;
      formato: Formato;
      idioma: Idioma;
    },
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase.rpc('editar_funcion', {
      p_funcion_id: id,
      p_pelicula_id: datos.peliculaId,
      p_inicio: datos.inicio,
      p_formato: datos.formato,
      p_idioma: datos.idioma,
    });

    return { error: error?.message ?? null };
  }

  // programacion recurrente (funcion programar_funciones, migracion 018).
  // confirmar = false -> solo vista previa, no crea nada
  async programar(
    datos: {
      peliculaId: string;
      dias: number[]; // 1 = lunes ... 7 = domingo
      horas: string[]; // "18:00"
      desde: string; // yyyy-mm-dd
      hasta: string;
      formato: Formato;
      idioma: Idioma;
    },
    confirmar: boolean,
  ): Promise<{ resultado: { inicio: string; salaNombre: string | null }[]; error: string | null }> {
    const { data, error } = await this.supabase.rpc('programar_funciones', {
      p_pelicula_id: datos.peliculaId,
      p_dias: datos.dias,
      p_horas: datos.horas,
      p_desde: datos.desde,
      p_hasta: datos.hasta,
      p_formato: datos.formato,
      p_idioma: datos.idioma,
      p_confirmar: confirmar,
    });

    if (error) return { resultado: [], error: error.message };
    return { resultado: data ?? [], error: null };
  }

  // RF-15: tabla de precios por formato (estándar y VIP)
  async getPrecios(): Promise<PrecioEntrada[]> {
    const { data, error } = await this.supabase
      .from('precios_entrada')
      .select('*')
      .order('formato', { ascending: true });

    if (error || !data) return [];
    return data.map((row: any) => ({
      formato: row.formato,
      precio: row.precio,
      precioVip: row.precio_vip,
    }));
  }

  // guarda la tabla y la base actualiza las funciones que todavía no empezaron
  async guardarPrecios(precios: PrecioEntrada[]): Promise<{ error: string | null }> {
    const { error } = await this.supabase.rpc('guardar_precios_entrada', { p_precios: precios });
    return { error: error?.message ?? null };
  }

  async eliminar(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('funciones').delete().eq('id', id);

    if (error) {
      // 23503: la funcion tiene ordenes que la referencian
      if (error.code === '23503') {
        return { error: 'No se puede eliminar: la función ya tiene entradas vendidas' };
      }
      return { error: error.message };
    }
    return { error: null };
  }
}
