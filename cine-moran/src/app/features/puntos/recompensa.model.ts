import { Formato } from '../funciones/funcion.model';

// RF-41 / RF-42: algo que se paga con puntos. La configura el admin.
//   - entrada:  una entrada general gratis (no VIP); formato null = cualquiera
//   - producto: un producto del candy bar, que se retira con el mismo QR
export type TipoRecompensa = 'entrada' | 'producto';

export interface Recompensa {
  id: string;
  nombre: string;
  tipo: TipoRecompensa;
  productoId: string | null;
  formato: Formato | null;
  puntos: number;
  activa: boolean;
}

// RF-36: historial de puntos del perfil (los canjes son motivo "canje")
export interface MovimientoPuntos {
  id: string;
  puntos: number; // positivo = suma, negativo = resta
  motivo: 'compra' | 'canje' | 'cancelacion';
  descripcion: string;
  createdAt: string;
}
