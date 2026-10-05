export type Formato = '2d' | '3d' | '4d' | '5d';
export type Idioma = 'castellano' | 'subtitulada';

export interface Funcion {
  id: string;
  peliculaId: string;
  salaId: string;
  nombreSala: string;
  inicio: string; // ISO, viene de timestamptz
  fin: string;
  formato: Formato;
  idioma: Idioma;
  precio: number;
  nombrePelicula?: string; // solo cuando se trae con el join a peliculas (listado de admin)
}
