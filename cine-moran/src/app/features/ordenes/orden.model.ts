export interface Orden {
  id: string;
  funcionId: string;
  usuarioId: string | null;
  email: string;
  cantidadButacas: number;
  total: number;
  estado: 'confirmada' | 'cancelada';
}

// Una butaca ya comprada, con el id propio de ese renglón (ordenButacaId):
// es lo que se codifica en el QR de esa entrada en particular.
export interface ButacaComprada {
  ordenButacaId: string;
  fila: string;
  numero: number;
  tipo: 'estandar' | 'vip' | 'accesible';
}

export interface OrdenConButacas {
  orden: Orden;
  butacas: ButacaComprada[];
}
