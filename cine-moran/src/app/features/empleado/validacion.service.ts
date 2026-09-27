import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { EntradaValidada } from './validacion.model';

@Injectable({ providedIn: 'root' })
export class ValidacionService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  // validar_entrada es security definer (ver supabase/migraciones/008_...sql):
  // chequea el rol, si el codigo existe, si no fue cancelada y si no estaba
  // ya usada -todo en la base, no solo en el front-, y la marca como usada.
  async validar(codigo: string): Promise<{ entrada: EntradaValidada | null; error: string | null }> {
    const { data, error } = await this.supabase.rpc('validar_entrada', {
      p_orden_butaca_id: codigo,
    });

    if (error || !data) {
      // "invalid input syntax for type uuid" es lo que tira si tipearon
      // cualquier cosa que no sea un id valido
      const esCodigoMalformado = error?.message?.includes('invalid input syntax');
      return {
        entrada: null,
        error: esCodigoMalformado ? 'Código inválido' : (error?.message ?? 'No se pudo validar'),
      };
    }

    return { entrada: data, error: null };
  }
}
