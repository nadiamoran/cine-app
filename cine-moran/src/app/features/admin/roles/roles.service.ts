import { Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase.service';
import { Permiso } from '../secciones-admin';

export interface Rol {
  id: string;
  nombre: string;
  permisos: Permiso[];
}

export interface UsuarioListado {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  rolId: string | null;
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async getRoles(): Promise<Rol[]> {
    const { data, error } = await this.supabase.from('roles').select('*').order('nombre');
    if (error || !data) return [];
    return data.map((row: any) => ({ id: row.id, nombre: row.nombre, permisos: row.permisos }));
  }

  async crear(datos: { nombre: string; permisos: Permiso[] }) {
    const { error } = await this.supabase
      .from('roles')
      .insert({ nombre: datos.nombre.trim(), permisos: datos.permisos });
    return { error: this.traducir(error) };
  }

  async actualizar(id: string, datos: { nombre: string; permisos: Permiso[] }) {
    const { error } = await this.supabase
      .from('roles')
      .update({ nombre: datos.nombre.trim(), permisos: datos.permisos })
      .eq('id', id);
    return { error: this.traducir(error) };
  }

  // los usuarios que lo tenían quedan sin rol personalizado (on delete set null)
  async eliminar(id: string) {
    const { error } = await this.supabase.from('roles').delete().eq('id', id);
    return { error: error?.message ?? null };
  }

  // profiles solo deja ver la fila propia: el listado lo arma una función de
  // la base que solo puede usar el administrador (migración 032)
  async getUsuarios(): Promise<UsuarioListado[]> {
    const { data, error } = await this.supabase.rpc('listar_usuarios');
    if (error || !data) return [];
    return data;
  }

  async asignarRol(usuarioId: string, rolId: string | null) {
    const { error } = await this.supabase.rpc('asignar_rol', {
      p_usuario_id: usuarioId,
      p_rol_id: rolId,
    });
    return { error: error?.message ?? null };
  }

  private traducir(error: { code?: string; message: string } | null): string | null {
    if (!error) return null;
    // 23505 = unique violation: ya hay un rol con ese nombre
    if (error.code === '23505') return 'Ya existe un rol con ese nombre';
    return error.message;
  }
}
