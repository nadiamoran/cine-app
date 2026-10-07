import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import {
  OrdenConButacas,
  CompraHistorial,
  Cupon,
  PeliculaVista,
  MetodoPago,
  MovimientoCredito,
} from './orden.model';

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

  // Supabase Realtime (RF-23): avisa cuando otra compra ocupa (o libera) una
  // butaca de esta función, sin recargar la página. Escucha la tabla
  // butacas_vendidas (migración 019), que mantienen los triggers de la base.
  // Devuelve una función para cortar la suscripción al salir de la pantalla.
  escucharButacas(
    funcionId: string,
    alOcuparse: (butacaId: string) => void,
    alLiberarse: (butacaId: string) => void,
  ): () => void {
    const canal = this.supabase
      .channel(`butacas-funcion-${funcionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'butacas_vendidas',
          // el filtro lo aplica el servidor: solo llegan las de esta función
          filter: `funcion_id=eq.${funcionId}`,
        },
        (payload) => alOcuparse((payload.new as { butaca_id: string }).butaca_id),
      )
      .on(
        'postgres_changes',
        // Realtime no permite filtrar los DELETE, así que llegan los de todas
        // las funciones y me quedo solo con los de esta
        { event: 'DELETE', schema: 'public', table: 'butacas_vendidas' },
        (payload) => {
          const borrada = payload.old as { funcion_id?: string; butaca_id?: string };
          if (borrada.funcion_id === funcionId && borrada.butaca_id) {
            alLiberarse(borrada.butaca_id);
          }
        },
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(canal);
    };
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

  // Historial de compras del usuario logueado. La policy de "ordenes"
  // (migración 004) también deja ver TODAS a empleados y admin, así que se
  // filtra explícito por el usuario: cada uno ve solo lo que compró.
  async getHistorial(usuarioId: string): Promise<CompraHistorial[]> {
    const { data, error } = await this.supabase
      .from('ordenes')
      .select('id, cantidad_butacas, total, credito_usado, estado, created_at, funciones(inicio, peliculas(nombre))')
      .eq('usuario_id', usuarioId)
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
      creditoUsado: row.credito_usado ?? 0,
      estado: row.estado,
      createdAt: row.created_at,
    }));
  }

  // RF-12 "Mis películas". Mismo criterio que usuario_vio_pelicula() (la
  // regla para poder dejar reseña, migración 006): "la vio" = tiene una
  // compra confirmada con entradas de una función que ya empezó.
  async getPeliculasVistas(usuarioId: string): Promise<PeliculaVista[]> {
    const ahora = new Date().toISOString();

    const [ordenes, resenas] = await Promise.all([
      this.supabase
        .from('ordenes')
        // !inner: solo órdenes cuya función cumple el filtro de abajo
        .select('funcion_id, funciones!inner(inicio, peliculas(id, nombre, imagen_url))')
        // la policy de ordenes también deja ver todas a empleados y admin:
        // acá filtro explícito por el usuario para traer solo lo suyo
        .eq('usuario_id', usuarioId)
        .eq('estado', 'confirmada')
        .gt('cantidad_butacas', 0)
        .lte('funciones.inicio', ahora),
      this.supabase.from('resenas').select('pelicula_id, estrellas').eq('usuario_id', usuarioId),
    ]);

    if (ordenes.error || !ordenes.data) {
      console.error('Error trayendo películas vistas:', ordenes.error);
      return [];
    }

    const estrellasPorPelicula = new Map<string, number>(
      (resenas.data ?? []).map((r: any) => [r.pelicula_id, r.estrellas]),
    );

    // una tarjeta por película (aunque la haya visto varias veces)
    const porPelicula = new Map<string, PeliculaVista & { funciones: Set<string> }>();
    for (const row of ordenes.data as any[]) {
      const pelicula = row.funciones?.peliculas;
      if (!pelicula) continue;

      const vista = porPelicula.get(pelicula.id) ?? {
        peliculaId: pelicula.id,
        nombre: pelicula.nombre,
        imagenUrl: pelicula.imagen_url,
        ultimaVez: row.funciones.inicio,
        veces: 0,
        estrellas: estrellasPorPelicula.get(pelicula.id) ?? null,
        funciones: new Set<string>(),
      };
      vista.funciones.add(row.funcion_id);
      vista.veces = vista.funciones.size;
      if (row.funciones.inicio > vista.ultimaVez) vista.ultimaVez = row.funciones.inicio;
      porPelicula.set(pelicula.id, vista);
    }

    return Array.from(porPelicula.values())
      .map(({ funciones, ...vista }) => vista)
      .sort((a, b) => b.ultimaVez.localeCompare(a.ultimaVez)); // la más reciente primero
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
    // RF-28: usar el crédito de la cuenta; el resto se paga con el medio
    // elegido (pago simulado). La base decide cuánto crédito se usa.
    usarCredito = false,
    metodoPago: MetodoPago | null = null,
    // RF-41: recompensas pagadas con puntos (un id repetido = esa cantidad)
    recompensaIds: string[] = [],
  ): Promise<{ resultado: OrdenConButacas | null; error: string | null }> {
    const { data, error } = await this.supabase.rpc('crear_orden', {
      p_funcion_id: funcionId,
      p_butaca_ids: butacaIds,
      p_email: email,
      p_producto_ids: productoIds,
      p_combo_ids: comboIds,
      p_usar_credito: usarCredito,
      p_metodo_pago: metodoPago,
      p_recompensa_ids: recompensaIds,
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
          creditoUsado: data.orden.credito_usado ?? 0,
          metodoPago: data.orden.metodo_pago ?? null,
        },
        butacas: data.butacas,
        productos: data.productos ?? [],
        cuponAplicado: data.cuponAplicado,
        puntosGanados: data.puntosGanados ?? 0,
        puntosUsados: data.puntosUsados ?? 0,
      },
      error: null,
    };
  }

  // RF-44 a RF-47: cancelar_orden (migración 024) valida todo en la base:
  // que sea del usuario, hasta 2 h antes, sin entradas validadas ni candy
  // retirado. Acredita el total como crédito y libera las butacas.
  async cancelar(
    ordenId: string,
  ): Promise<{
    creditoAcreditado: number;
    puntosDescontados: number;
    puntosDevueltos: number;
    error: string | null;
  }> {
    const { data, error } = await this.supabase.rpc('cancelar_orden', { p_orden_id: ordenId });

    if (error || !data) {
      return {
        creditoAcreditado: 0,
        puntosDescontados: 0,
        puntosDevueltos: 0,
        error: error?.message ?? 'No se pudo cancelar',
      };
    }
    return {
      creditoAcreditado: data.creditoAcreditado,
      puntosDescontados: data.puntosDescontados,
      puntosDevueltos: data.puntosDevueltos ?? 0,
      error: null,
    };
  }

  // historial de crédito del perfil (RLS: cada usuario ve solo los suyos)
  async getMovimientosCredito(): Promise<MovimientoCredito[]> {
    const { data, error } = await this.supabase
      .from('creditos_movimientos')
      .select('id, monto, motivo, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      monto: row.monto,
      motivo: row.motivo,
      createdAt: row.created_at,
    }));
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
