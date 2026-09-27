import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Orden } from './orden.model';

@Injectable({ providedIn: 'root' })
export class OrdenesService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  // butacas_ocupadas es una vista publica (ver supabase/migraciones/004_ordenes.sql)
  // que solo expone funcion_id + butaca_id, sin datos de la compra ni del comprador
  async getButacasOcupadas(funcionId: string): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('butacas_ocupadas')
      .select('butaca_id')
      .eq('funcion_id', funcionId);

    if (error || !data) return new Set();
    return new Set(data.map((row: any) => row.butaca_id));
  }

  // Para decidir si mostrar el formulario de reseña. La regla real vive en
  // la base (usuario_vio_pelicula(), usada también en la policy de insert de
  // resenas — ver supabase/migraciones/006_...sql); esto solo evita mostrar
  // un formulario que la base va a rechazar igual.
  async yaVioPelicula(peliculaId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('usuario_vio_pelicula', {
      p_pelicula_id: peliculaId,
    });

    if (error) {
      console.error('Error chequeando si vio la pelicula:', error);
      return false;
    }
    return !!data;
  }

  // crear_orden es una funcion de la base (security definer): crea la orden
  // y sus butacas en una sola transaccion. Si alguna butaca ya estaba
  // vendida para esa funcion, la restriccion "unique" de la base rechaza
  // todo y no queda nada a medio crear.
  async crear(
    funcionId: string,
    butacaIds: string[],
    email: string,
  ): Promise<{ orden: Orden | null; error: string | null }> {
    const { data, error } = await this.supabase.rpc('crear_orden', {
      p_funcion_id: funcionId,
      p_butaca_ids: butacaIds,
      p_email: email,
    });

    if (error || !data) {
      return { orden: null, error: error?.message ?? 'No se pudo crear la orden' };
    }

    return {
      orden: {
        id: data.id,
        funcionId: data.funcion_id,
        usuarioId: data.usuario_id,
        email: data.email,
        cantidadButacas: data.cantidad_butacas,
        total: data.total,
        estado: data.estado,
      },
      error: null,
    };
  }
}
