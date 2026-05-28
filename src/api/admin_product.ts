import { apiRequest } from "./client";
import type { Product } from "../types/product_type";

export async function getAdminProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/admin/products", { auth: true });
}

export interface ProductVariantInput {
  id?: string;
  catalog_id: string;
  size_value: number;
  size_unit: string;
  price: number;
  stock: number;
}

export interface CreateProductPayload {
  cat_id: string;
  name: string;
  description: string;
  image_url?: string | null;
  variants: ProductVariantInput[];
}

export interface UpdateProductPayload {
  cat_id?: string;
  name?: string;
  description?: string;
  image_url?: string | null;
  variants?: ProductVariantInput[];
}

export async function createProduct(
  payload: CreateProductPayload
): Promise<Product> {
  return apiRequest<Product>("/admin/products", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(
  productId: string,
  payload: UpdateProductPayload
): Promise<Product> {
  return apiRequest<Product>(`/admin/products/${productId}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  return apiRequest<void>(`/admin/products/${productId}`, {
    method: "DELETE",
    auth: true,
  });
}