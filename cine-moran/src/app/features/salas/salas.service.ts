import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service'; // ajustá el path si difiere
import { Sala, Butaca } from './sala.model';

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
}