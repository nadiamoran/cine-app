export type EstadoPropuesta = 'pendiente' | 'aceptada' | 'rechazada';

export interface Propuesta {
  id: string;
  titulo: string;
  descripcion: string;
  motivo: string;
  estado: EstadoPropuesta;
  createdAt: string;
}
