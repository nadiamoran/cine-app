import { Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase.service';

// RF-52 / RF-54: los reportes se calculan en la base (migración 027): acá
// solo se piden con el período elegido. Las fechas van como "yyyy-mm-dd".
export interface FilaFacturacion {
  fecha: string;
  entradas: number;
  facturado: number;
}

export interface ItemRanking {
  nombre: string;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async facturacion(desde: string, hasta: string): Promise<FilaFacturacion[]> {
    const { data, error } = await this.supabase.rpc('reporte_facturacion', { p_desde: desde, p_hasta: hasta });
    if (error || !data) {
      console.error('Error en el reporte de facturación:', error?.message);
      return [];
    }
    return data.map((row: any) => ({
      fecha: row.fecha,
      entradas: Number(row.entradas),
      facturado: Number(row.facturado),
    }));
  }

  async peliculasMasVistas(desde: string, hasta: string): Promise<ItemRanking[]> {
    const { data, error } = await this.supabase.rpc('reporte_peliculas_mas_vistas', {
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error || !data) {
      console.error('Error en el reporte de películas:', error?.message);
      return [];
    }
    return data.map((row: any) => ({ nombre: row.pelicula, cantidad: Number(row.entradas) }));
  }

  async productosMasVendidos(desde: string, hasta: string): Promise<ItemRanking[]> {
    const { data, error } = await this.supabase.rpc('reporte_productos_mas_vendidos', {
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error || !data) {
      console.error('Error en el reporte de productos:', error?.message);
      return [];
    }
    return data.map((row: any) => ({ nombre: row.producto, cantidad: Number(row.unidades) }));
  }
}
