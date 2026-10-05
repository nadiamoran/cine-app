import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service'; // ajustá el path si difiere
import { Sala, Butaca, SalaConButacas } from './sala.model';

@Injectable({ providedIn: 'root' })
export class SalasService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async getById(id: string): Promise<Sala | null> {
    const { data, error } = await this.supabase.from('salas').select('*').eq('id', id).single();
    if (error || !data) return null;
    return { id: data.id, nombre: data.nombre };
  }

  async getButacas(salaId: string): Promise<Butaca[]> {
    const { data, error } = await this.supabase
      .from('butacas')
      .select('*')
      .eq('sala_id', salaId)
      .order('fila', { ascending: true })
      .order('columna', { ascending: true })
      .order('numero', { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      fila: row.fila,
      columna: row.columna,
      numero: row.numero,
      tipo: row.tipo,
    }));
  }

  async getTodas(): Promise<SalaConButacas[]> {
    const { data, error } = await this.supabase
      .from('salas')
      .select('id, nombre, habilitada, butacas(tipo)')
      .order('nombre', { ascending: true });

    if (error || !data) {
      console.error('Error trayendo salas:', error);
      return [];
    }

    return data.map((row: any) => {
      const tipos: string[] = (row.butacas ?? []).map((b: any) => b.tipo);
      return {
        id: row.id,
        nombre: row.nombre,
        habilitada: row.habilitada ?? true,
        totalButacas: tipos.length,
        estandar: tipos.filter((t) => t === 'estandar').length,
        vip: tipos.filter((t) => t === 'vip').length,
        accesibles: tipos.filter((t) => t === 'accesible').length,
      };
    });
  }

  // crear_sala (migracion 001) arma la sala con todas sus butacas:
  // 20 filas de 4/20/4, fila accesible 2/10/2 en lugar de J y K, VIP en R, S y T
  async crear(nombre: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.rpc('crear_sala', { p_nombre: nombre });

    if (error) {
      // 23505: ya hay una sala con ese nombre (salas.nombre es unique)
      if (error.code === '23505') {
        return { error: 'Ya existe una sala con ese nombre' };
      }
      return { error: error.message };
    }
    return { error: null };
  }

  // una sala deshabilitada no recibe funciones nuevas (migracion 015)
  async actualizarHabilitada(id: string, habilitada: boolean): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('salas').update({ habilitada }).eq('id', id);
    return { error: error?.message ?? null };
  }
}
