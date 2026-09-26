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