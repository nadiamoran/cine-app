export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  leida: boolean;
  createdAt: string;
}
