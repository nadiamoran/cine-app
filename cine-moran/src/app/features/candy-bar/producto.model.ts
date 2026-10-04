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
}

export interface Combo {
  id: string;
  nombre: string;
  precio: number;
  activo: boolean;
}
