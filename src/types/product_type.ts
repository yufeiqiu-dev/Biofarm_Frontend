export interface Product {
    id: string;
    catolog_id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    variants: ProductVariant[];
  }

  export interface ProductVariant {
    id: string;
    catolog_id: string;
    size_value: number;
    size_unit: string;
    price: number;
    stock: number;
  }