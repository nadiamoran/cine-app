import { Injectable, signal } from '@angular/core';
import { SupabaseService } from '../supabase.service'; // ajustá el path real
import { LoginData, RegisterData, Profile } from './user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signal con el usuario actual. null = sin sesión.
  // Se usa en el guard y en cualquier componente que necesite saber "quién está logueado".
  currentUser = signal<Profile | null>(null);

  constructor(private supabaseService: SupabaseService) {
    // Al arrancar la app, restauramos la sesión si Supabase la tiene guardada (localStorage)
    this.restoreSession();
  }

  private get supabase() {
    return this.supabaseService.client;
  }

  private async restoreSession() {
    const { data } = await this.supabase.auth.getSession();
    if (data.session) {
      await this.loadProfile(data.session.user.id);
    }
  }

  async register(data: RegisterData): Promise<{ error: string | null }> {
    // 1. Creamos el usuario en auth.users (Supabase hashea la contraseña)
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (authError || !authData.user) {
      return { error: authError?.message ?? 'No se pudo crear el usuario' };
    }

    // 2. Insertamos el resto de los datos en profiles, vinculado por el mismo id
    const { error: profileError } = await this.supabase.from('profiles').insert({
      id: authData.user.id,
      nombre: data.nombre,
      apellido: data.apellido,
      fecha_nacimiento: data.fechaNacimiento,
      tipo_sangre: data.tipoSangre,
      color_ojos: data.colorOjos,
      dias_vacaciones: data.diasVacaciones,
    });

    if (profileError) {
      return { error: profileError.message };
    }

    await this.loadProfile(authData.user.id);
    return { error: null };
  }

  async login(data: LoginData): Promise<{ error: string | null }> {
    const { data: authData, error } = await this.supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error || !authData.user) {
      return { error: error?.message ?? 'Credenciales inválidas' };
    }

    await this.loadProfile(authData.user.id);
    return { error: null };
  }

  async logout() {
    await this.supabase.auth.signOut();
    this.currentUser.set(null);
  }

  private async loadProfile(userId: string) {
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      this.currentUser.set({
        id: data.id,
        nombre: data.nombre,
        apellido: data.apellido,
        fechaNacimiento: data.fecha_nacimiento,
        tipoSangre: data.tipo_sangre,
        colorOjos: data.color_ojos,
        diasVacaciones: data.dias_vacaciones,
      });
    }
  }
}