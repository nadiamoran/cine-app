export interface Categoria {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  categoriaId: string | null;
  nombre: string;
  precio: number;
  activo: boolean;
  imagenUrl: string | null;
}

export interface Combo {
  id: string;
  nombre: string;
  precio: number;
  activo: boolean;
  entradasIncluidas: number; // entradas generales (no VIP) que trae el combo
  imagenUrl: string | null;
  productos: { productoId: string; nombre: string; cantidad: number }[];
}
