import { apiRequest } from "./client";
import type { Product, ProductVariant } from "../types/product_type";

export async function getAdminProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/admin/products", { auth: true });
}

export interface ProductVariantInput {
  id?: string;
  catalog_id: string;
  size_value: number;
  size_unit: string;
  price: number;
  /**
   * Write-once: an opening count for a variant being inserted, and absent for
   * one that already exists.
   *
   * The server rejects it on an existing variant rather than ignoring it,
   * because this payload is a whole-product form read before the admin started
   * typing - sending the count back would overwrite every sale made while the
   * page was open. Use adjustVariantStock, which applies a change under a row
   * lock.
   */
  stock?: number;
}

/**
 * A variant on the create path, where the opening count is required.
 *
 * Split from ProductVariantInput because making `stock` optional for updates
 * quietly made it optional here too - a create payload that omitted it would
 * typecheck and then 422 at runtime, losing a guarantee the compiler used to
 * give.
 */
export type ProductVariantCreateInput = Omit<ProductVariantInput, "id" | "stock"> & {
  stock: number;
};

export interface CreateProductPayload {
  cat_id: string;
  name: string;
  description: string;
  tag_ids: string[];
  variants: ProductVariantCreateInput[];
}

export interface UpdateProductPayload {
  cat_id?: string;
  name?: string;
  description?: string;
  tag_ids?: string[];
  image_urls?: string[];
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
  imageUrl: string
): Promise<void> {
  return apiRequest<void>(`/admin/products/${productId}/images`, {
    method: "DELETE",
    auth: true,
    body: JSON.stringify({ image_url: imageUrl }),
  });
}

/**
 * Add to or remove from a variant's stock.
 *
 * A signed change, not a new value, and deliberately not part of the product
 * PUT. That form is a read-modify-write over the whole product: it reads every
 * field, the admin edits one, and it writes them all back - including a stock
 * count read before they started typing, overwriting whatever sold while the
 * page was open. The server applies this delta under a row lock instead, so a
 * sale landing mid-adjustment is kept.
 */
export async function adjustVariantStock(
  productId: string,
  variantId: string,
  delta: number,
  reason?: string,
): Promise<ProductVariant> {
  return apiRequest(`/admin/products/${productId}/variants/${variantId}/stock`, {
    method: "POST",
    auth: true,
    // The reason is logged with the delta and the resulting count. Optional,
    // because forcing one gets "x" typed into it - but the server accepted the
    // field while nothing ever sent it, so every adjustment logged "reason=-"
    // and the record the endpoint was justified by did not exist.
    body: JSON.stringify(reason?.trim() ? { delta, reason: reason.trim() } : { delta }),
  });
}

