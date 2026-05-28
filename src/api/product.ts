import { apiRequest } from "./client";
import type { Product } from "../types/product_type";

export async function getProducts(params?: { search?: string; tags?: string[] }): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  params?.tags?.forEach((t) => query.append("tags", t));
  const qs = query.toString();
  return apiRequest<Product[]>(qs ? `/products?${qs}` : "/products");
}

export async function getProductById(productId: string): Promise<Product> {
  return apiRequest<Product>(`/products/${productId}`);
}