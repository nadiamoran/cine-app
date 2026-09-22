export interface RegisterData {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string; // formato yyyy-mm-dd, lo castea el input type="date"
  tipoSangre: string;
  colorOjos: string;
  diasVacaciones: number;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface Profile {
  id: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  tipoSangre: string;
  colorOjos: string;
  diasVacaciones: number;
}