export interface Orden {
  id: string;
  funcionId: string;
  usuarioId: string | null;
  email: string;
  cantidadButacas: number;
  total: number;
  estado: 'confirmada' | 'cancelada';
}
