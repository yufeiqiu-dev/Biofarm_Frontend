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
  tags: string[];
  variants: ProductVariantInput[];
}

export interface UpdateProductPayload {
  cat_id?: string;
  name?: string;
  description?: string;
  tags?: string[];
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

// --- Image management ---

export interface PresignedUrlResponse {
  upload_url: string;
  image_url: string;
  index: number;
}

export async function getImagePresignedUrl(
  productId: string,
  extension: string
): Promise<PresignedUrlResponse> {
  return apiRequest<PresignedUrlResponse>(
    `/admin/products/${productId}/images/presigned-url`,
    {
      method: "POST",
      auth: true,
      body: JSON.stringify({ extension }),
    }
  );
}

export async function confirmImageUpload(
  productId: string,
  imageUrl: string
): Promise<{ image_urls: string[] }> {
  return apiRequest<{ image_urls: string[] }>(
    `/admin/products/${productId}/images/confirm`,
    {
      method: "POST",
      auth: true,
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
}

export async function deleteImage(
  productId: string,
  index: number
): Promise<void> {
  return apiRequest<void>(`/admin/products/${productId}/images/${index}`, {
    method: "DELETE",
    auth: true,
  });
}
