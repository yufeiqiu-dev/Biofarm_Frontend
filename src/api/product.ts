import { apiRequest } from "./client";
import type { Product } from "../types/product_type";

export async function getProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/admin/products");
}

export async function getProductById(productId: string): Promise<Product> {
  return apiRequest<Product>(`/admin/products/${productId}`);
}