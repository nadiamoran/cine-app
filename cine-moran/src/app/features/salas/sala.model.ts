export type TipoButaca = 'estandar' | 'vip' | 'accesible';

export interface Butaca {
  id: string;
  fila: string;
  columna: number;
  numero: number;
  tipo: TipoButaca;
}

export interface Sala {
  id: string;
  nombre: string;
}

// para el listado de admin: cuántas butacas de cada tipo tiene la sala
export interface SalaConButacas extends Sala {
  habilitada: boolean;
  totalButacas: number;
  estandar: number;
  vip: number;
  accesibles: number;
}
