export interface Orden {
  id: string;
  funcionId: string;
  usuarioId: string | null;
  email: string;
  cantidadButacas: number;
  total: number;
  estado: 'confirmada' | 'cancelada';
  creditoUsado: number; // parte del total pagada con crédito
  metodoPago: MetodoPago | 'credito' | null; // 'credito' = el crédito cubrió todo
}

// RF-28 / S-2: medios de pago simulados (no hay pasarela real)
export type MetodoPago = 'tarjeta_credito' | 'tarjeta_debito' | 'mercado_pago';

export const METODOS_PAGO: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'tarjeta_credito', etiqueta: 'Tarjeta de crédito' },
  { valor: 'tarjeta_debito', etiqueta: 'Tarjeta de débito' },
  { valor: 'mercado_pago', etiqueta: 'Mercado Pago' },
];

// RF-46: un movimiento del crédito de la cuenta (+ cancelación, - compra)
export interface MovimientoCredito {
  id: string;
  monto: number;
  motivo: 'cancelacion' | 'compra';
  createdAt: string;
}

// Una butaca ya comprada, con el id propio de ese renglón (ordenButacaId):
// es lo que se codifica en el QR de esa entrada en particular.
export interface ButacaComprada {
  ordenButacaId: string;
  fila: string;
  numero: number;
  tipo: 'estandar' | 'vip' | 'accesible';
  precio: number; // lo que vale esa butaca según su tipo (VIP o estándar); 0 si se canjeó
  canjeada: boolean; // RF-41: se pagó con puntos
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
  puntosGanados: number;
  puntosUsados: number; // RF-41: puntos canjeados en esta compra
}

export interface Cupon {
  id: string;
  nombre: string;
  porcentaje: number;
  requierePrimeraCompra: boolean;
  requiereEdadMinima: number | null;
  activo: boolean;
}

// RF-12 "Mis películas": una película que el usuario ya vio, con la última
// vez que fue y su calificación (null si todavía no dejó reseña)
export interface PeliculaVista {
  peliculaId: string;
  nombre: string;
  imagenUrl: string | null;
  ultimaVez: string; // inicio de la última función que vio
  veces: number; // en cuántas funciones distintas la vio
  estrellas: number | null;
}

// Para el historial de compras del perfil: una fila resumida por orden
export interface CompraHistorial {
  id: string;
  peliculaNombre: string;
  funcionInicio: string;
  cantidadButacas: number;
  total: number;
  creditoUsado: number;
  estado: 'confirmada' | 'cancelada';
  createdAt: string;
}
