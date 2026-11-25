import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

export interface ListaEspera {
  id: string;
  funcionId: string;
  pelicula: string;
  sala: string;
  inicio: string;
  cantidad: number;
  estado: 'esperando' | 'avisado'; // avisado = tiene butacas reservadas por 15 minutos
  venceEn: string | null;
  posicion: number;
}

// Lista de espera de funciones agotadas (migración 031). Las reglas (solo
// clientes, solo si está agotada, la reserva de 15 minutos) las aplica la base.
@Injectable({ providedIn: 'root' })
export class EsperaService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  // las listas en las que está anotado el usuario, con su posición
  async getMisListas(): Promise<ListaEspera[]> {
    const { data, error } = await this.supabase.rpc('mis_listas_espera');
    if (error || !data) return [];
    return data;
  }

  async anotarse(funcionId: string, cantidad: number) {
    const { error } = await this.supabase.rpc('anotarse_lista_espera', {
      p_funcion_id: funcionId,
      p_cantidad: cantidad,
    });
    return { error: error?.message ?? null };
  }

  async salir(id: string) {
    const { error } = await this.supabase.rpc('salir_lista_espera', { p_id: id });
    return { error: error?.message ?? null };
  }

  // para el admin: cuánta gente espera en cada función (funcion -> cantidad)
  async getConteoPorFuncion(): Promise<Map<string, number>> {
    const { data } = await this.supabase
      .from('lista_espera')
      .select('funcion_id')
      .in('estado', ['esperando', 'avisado']);

    const conteo = new Map<string, number>();
    for (const fila of data ?? []) {
      conteo.set(fila.funcion_id, (conteo.get(fila.funcion_id) ?? 0) + 1);
    }
    return conteo;
  }
}
