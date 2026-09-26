export type RestriccionEdad = 'sin_restriccion' | '+13' | '+18';

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
}

