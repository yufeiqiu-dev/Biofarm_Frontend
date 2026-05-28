import type { Tag } from "./tag_type";

export interface Product {
  id: string;
  cat_id: string;
  name: string;
  description: string;
  tags: Tag[];
  image_urls: string[];
  variants: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  catalog_id: string;
  size_value: number;
  size_unit: string;
  price: number;
  stock: number;
}