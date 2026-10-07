export type RestriccionEdad = 'sin_restriccion' | '+13' | '+18';

export type EstadoPelicula = 'en_cartelera' | 'proximamente' | 'baja';

export const ESTADOS_PELICULA: { valor: EstadoPelicula; etiqueta: string }[] = [
  { valor: 'en_cartelera', etiqueta: 'En cartelera' },
  { valor: 'proximamente', etiqueta: 'Próximamente' },
  { valor: 'baja', etiqueta: 'Baja' },
];

export interface Pelicula {
  id: string;
  nombre: string;
  imagen_url: string | null;
  sinopsis: string | null;
  duracionMinutos: number;
  generos: string[];
  restriccionEdad: RestriccionEdad;
  ventas: number;
  fechaEstreno: string | null;
  estado: EstadoPelicula;
  // RF-29: descuento en pesos durante la preventa; null = sin preventa
  preventaDescuento: number | null;
}

