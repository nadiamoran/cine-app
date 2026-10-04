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

export interface CuponAplicado {
  nombre: string;
  porcentaje: number;
}

export interface ProductoComprado {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface OrdenConButacas {
  orden: Orden;
  butacas: ButacaComprada[];
  productos: ProductoComprado[];
  cuponAplicado: CuponAplicado | null;
}

export interface Cupon {
  id: string;
  nombre: string;
  porcentaje: number;
  requierePrimeraCompra: boolean;
  requiereEdadMinima: number | null;
  activo: boolean;
}

// Para el historial de compras del perfil: una fila resumida por orden
export interface CompraHistorial {
  id: string;
  peliculaNombre: string;
  funcionInicio: string;
  cantidadButacas: number;
  total: number;
  estado: 'confirmada' | 'cancelada';
  createdAt: string;
}
