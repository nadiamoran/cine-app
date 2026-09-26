export interface Resena {
  id: string;
  peliculaId: string;
  usuarioId: string;
  estrellas: number;
  comentario: string | null;
  createdAt: string;
  nombreUsuario: string; // viene del join con profiles
}