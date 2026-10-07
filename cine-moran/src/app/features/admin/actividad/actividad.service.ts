import { Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase.service';

// RF-55: un registro del log. Lo escriben triggers de la base (migración 026);
// la app solo lo lee, y solo el administrador puede hacerlo (RLS).
export interface RegistroActividad {
  id: string;
  usuario: string;
  tipo: 'funcion' | 'precio' | 'validacion';
  accion: string;
  detalle: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ActividadService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  // los últimos 200 registros, del más nuevo al más viejo
  async getRegistros(): Promise<RegistroActividad[]> {
    const { data, error } = await this.supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data) {
      console.error('Error trayendo el log de actividad:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      usuario: row.usuario,
      tipo: row.tipo,
      accion: row.accion,
      detalle: row.detalle,
      createdAt: row.created_at,
    }));
  }
}
