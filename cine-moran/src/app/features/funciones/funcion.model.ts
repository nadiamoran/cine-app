export type Formato = '2d' | '3d' | '4d' | '5d';
export type Idioma = 'castellano' | 'subtitulada';

// Tabla de precios del cine (migración 021): un precio por formato para la
// butaca estándar y otro para la VIP. Las funciones copian estos valores.
export interface PrecioEntrada {
  formato: Formato;
  precio: number;
  precioVip: number;
}

export interface Funcion {
  id: string;
  peliculaId: string;
  salaId: string;
  nombreSala: string;
  inicio: string; // ISO, viene de timestamptz
  fin: string;
  formato: Formato;
  idioma: Idioma;
  precio: number; // butacas estándar y accesibles
  precioVip: number; // butacas VIP (filas R, S y T)
  nombrePelicula?: string; // solo cuando se trae con el join a peliculas (listado de admin)
}
