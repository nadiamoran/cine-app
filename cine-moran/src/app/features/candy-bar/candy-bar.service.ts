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
      .select('*')
      .eq('activo', true)
      .order('nombre');
    if (error || !data) return [];
    return data.map((row: any) => ({ id: row.id, nombre: row.nombre, precio: row.precio, activo: row.activo }));
  }

  private mapProducto(row: any): Producto {
    return {
      id: row.id,
      categoriaId: row.categoria_id,
      nombre: row.nombre,
      precio: row.precio,
      activo: row.activo,
    };
  }

  // --- administración ---

  async crearCategoria(nombre: string) {
    const { error } = await this.supabase.from('categorias_producto').insert({ nombre });
    return { error: error?.message ?? null };
  }

  async crearProducto(datos: { categoriaId: string | null; nombre: string; precio: number }) {
    const { error } = await this.supabase.from('productos').insert({
      categoria_id: datos.categoriaId,
      nombre: datos.nombre,
      precio: datos.precio,
    });
    return { error: error?.message ?? null };
  }

  async crearCombo(datos: { nombre: string; precio: number; productos: { productoId: string; cantidad: number }[] }) {
    const { data: combo, error } = await this.supabase
      .from('combos')
      .insert({ nombre: datos.nombre, precio: datos.precio })
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
