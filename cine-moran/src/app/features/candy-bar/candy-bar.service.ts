import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Categoria, Producto, Combo } from './producto.model';

@Injectable({ providedIn: 'root' })
export class CandyBarService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async getCategorias(): Promise<Categoria[]> {
    const { data, error } = await this.supabase.from('categorias_producto').select('*').order('nombre');
    if (error || !data) return [];
    return data.map((row: any) => ({ id: row.id, nombre: row.nombre }));
  }

  async getProductosActivos(): Promise<Producto[]> {
    const { data, error } = await this.supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    if (error || !data) return [];
    return data.map(this.mapProducto);
  }

  async getCombosActivos(): Promise<Combo[]> {
    const { data, error } = await this.supabase
      .from('combos')
      .select('*, combo_productos(cantidad, productos(nombre))')
      .eq('activo', true)
      .order('nombre');
    if (error || !data) return [];
    return data.map(this.mapCombo);
  }

  // para el admin: todos los productos, activos o no
  async getProductos(): Promise<Producto[]> {
    const { data, error } = await this.supabase.from('productos').select('*').order('nombre');
    if (error || !data) return [];
    return data.map(this.mapProducto);
  }

  // para el admin: todos los combos, activos o no
  async getCombos(): Promise<Combo[]> {
    const { data, error } = await this.supabase
      .from('combos')
      .select('*, combo_productos(cantidad, productos(nombre))')
      .order('nombre');
    if (error || !data) return [];
    return data.map(this.mapCombo);
  }

  private mapCombo(row: any): Combo {
    return {
      id: row.id,
      nombre: row.nombre,
      precio: row.precio,
      activo: row.activo,
      entradasIncluidas: row.entradas_incluidas ?? 0,
      imagenUrl: row.imagen_url ?? null,
      productos: (row.combo_productos ?? []).map((cp: any) => ({
        nombre: cp.productos?.nombre ?? '',
        cantidad: cp.cantidad,
      })),
    };
  }

  private mapProducto(row: any): Producto {
    return {
      id: row.id,
      categoriaId: row.categoria_id,
      nombre: row.nombre,
      precio: row.precio,
      activo: row.activo,
      imagenUrl: row.imagen_url ?? null,
    };
  }

  // --- administración ---

  async crearCategoria(nombre: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('categorias_producto').insert({ nombre });
    if (error?.code === '23505') return { error: 'Ya existe una categoría con ese nombre' };
    return { error: error?.message ?? null };
  }

  async crearProducto(datos: {
    categoriaId: string | null;
    nombre: string;
    precio: number;
    imagenUrl: string | null;
  }) {
    const { error } = await this.supabase.from('productos').insert({
      categoria_id: datos.categoriaId,
      nombre: datos.nombre,
      precio: datos.precio,
      imagen_url: datos.imagenUrl,
    });
    return { error: error?.message ?? null };
  }

  // fotos de combos y productos: bucket "candy" (migracion 016), mismo criterio que
  // los afiches de peliculas
  async subirImagenCombo(archivo: File): Promise<string | null> {
    return this.subirImagen(archivo, 'combos');
  }

  async subirImagenProducto(archivo: File): Promise<string | null> {
    return this.subirImagen(archivo, 'productos');
  }

  private async subirImagen(archivo: File, carpeta: string): Promise<string | null> {
    const extension = archivo.name.split('.').pop();
    const nombreArchivo = `${carpeta}/${crypto.randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage.from('candy').upload(nombreArchivo, archivo);
    if (error) {
      console.error('Error subiendo imagen:', error);
      return null;
    }

    const { data } = this.supabase.storage.from('candy').getPublicUrl(nombreArchivo);
    return data.publicUrl;
  }

  async actualizarComboActivo(id: string, activo: boolean): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('combos').update({ activo }).eq('id', id);
    return { error: error?.message ?? null };
  }

  async actualizarProducto(
    id: string,
    datos: { categoriaId: string | null; nombre: string; precio: number; imagenUrl?: string | null },
  ): Promise<{ error: string | null }> {
    const cambios: Record<string, unknown> = {
      categoria_id: datos.categoriaId,
      nombre: datos.nombre,
      precio: datos.precio,
    };
    // solo piso la foto si se eligió una nueva
    if (datos.imagenUrl !== undefined) cambios['imagen_url'] = datos.imagenUrl;

    const { error } = await this.supabase.from('productos').update(cambios).eq('id', id);
    return { error: error?.message ?? null };
  }

  // dar de baja / volver a habilitar: un producto inactivo no se vende ni se
  // puede agregar a combos nuevos, pero sigue en las ordenes viejas
  async actualizarProductoActivo(id: string, activo: boolean): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('productos').update({ activo }).eq('id', id);
    return { error: error?.message ?? null };
  }

  async crearCombo(datos: {
    nombre: string;
    precio: number;
    entradasIncluidas: number;
    imagenUrl: string | null;
    productos: { productoId: string; cantidad: number }[];
  }) {
    const { data: combo, error } = await this.supabase
      .from('combos')
      .insert({
        nombre: datos.nombre,
        precio: datos.precio,
        entradas_incluidas: datos.entradasIncluidas,
        imagen_url: datos.imagenUrl,
      })
      .select()
      .single();

    if (error || !combo) return { error: error?.message ?? 'No se pudo crear el combo' };

    const filas = datos.productos.map((p) => ({
      combo_id: combo.id,
      producto_id: p.productoId,
      cantidad: p.cantidad,
    }));

    const { error: errorItems } = await this.supabase.from('combo_productos').insert(filas);
    return { error: errorItems?.message ?? null };
  }
}
