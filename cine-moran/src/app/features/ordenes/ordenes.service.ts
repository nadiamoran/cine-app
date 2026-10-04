import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { OrdenConButacas, CompraHistorial, Cupon } from './orden.model';

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

  // Historial de compras del usuario logueado (RLS de "ordenes" ya limita
  // esto a sus propias ordenes: ver supabase/migraciones/004_ordenes.sql)
  async getHistorial(): Promise<CompraHistorial[]> {
    const { data, error } = await this.supabase
      .from('ordenes')
      .select('id, cantidad_butacas, total, estado, created_at, funciones(inicio, peliculas(nombre))')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error trayendo historial de compras:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      peliculaNombre: row.funciones?.peliculas?.nombre ?? '(película eliminada)',
      funcionInicio: row.funciones?.inicio ?? '',
      cantidadButacas: row.cantidad_butacas,
      total: row.total,
      estado: row.estado,
      createdAt: row.created_at,
    }));
  }

  // crear_orden es una funcion de la base (security definer): crea la orden
  // y sus butacas en una sola transaccion, y devuelve el detalle de cada
  // butaca comprada (para armar el PDF con el QR de cada entrada). Si alguna
  // butaca ya estaba vendida para esa funcion, la restriccion "unique" de la
  // base rechaza todo y no queda nada a medio crear.
  async crear(
    funcionId: string | null,
    butacaIds: string[],
    email: string,
    productoIds: string[] = [],
    comboIds: string[] = [],
  ): Promise<{ resultado: OrdenConButacas | null; error: string | null }> {
    const { data, error } = await this.supabase.rpc('crear_orden', {
      p_funcion_id: funcionId,
      p_butaca_ids: butacaIds,
      p_email: email,
      p_producto_ids: productoIds,
      p_combo_ids: comboIds,
    });

    if (error || !data) {
      return { resultado: null, error: error?.message ?? 'No se pudo crear la orden' };
    }

    return {
      resultado: {
        orden: {
          id: data.orden.id,
          funcionId: data.orden.funcion_id,
          usuarioId: data.orden.usuario_id,
          email: data.orden.email,
          cantidadButacas: data.orden.cantidad_butacas,
          total: data.orden.total,
          estado: data.orden.estado,
        },
        butacas: data.butacas,
        productos: data.productos ?? [],
        cuponAplicado: data.cuponAplicado,
      },
      error: null,
    };
  }

  // --- cupones (administracion) ---

  async getCupones(): Promise<Cupon[]> {
    const { data, error } = await this.supabase
      .from('cupones')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      nombre: row.nombre,
      porcentaje: row.porcentaje,
      requierePrimeraCompra: row.requiere_primera_compra,
      requiereEdadMinima: row.requiere_edad_minima,
      activo: row.activo,
    }));
  }

  async actualizarCupon(id: string, cambios: { porcentaje?: number; activo?: boolean }) {
    const { error } = await this.supabase
      .from('cupones')
      .update({ porcentaje: cambios.porcentaje, activo: cambios.activo })
      .eq('id', id);
    return { error: error?.message ?? null };
  }

  async crearCupon(datos: { nombre: string; porcentaje: number; requiereEdadMinima: number }) {
    const { error } = await this.supabase.from('cupones').insert({
      nombre: datos.nombre,
      porcentaje: datos.porcentaje,
      requiere_edad_minima: datos.requiereEdadMinima,
    });
    return { error: error?.message ?? null };
  }
}
