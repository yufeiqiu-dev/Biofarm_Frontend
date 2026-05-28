import { apiRequest } from "./client";
import type { Tag } from "../types/tag_type";

export async function getAdminTags(): Promise<Tag[]> {
  return apiRequest<Tag[]>("/admin/tags", { auth: true });
}

export async function createTag(name: string): Promise<Tag> {
  return apiRequest<Tag>("/admin/tags", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ name }),
  });
}

export async function deleteTag(tagId: string): Promise<void> {
  return apiRequest<void>(`/admin/tags/${tagId}`, {
    method: "DELETE",
    auth: true,
  });
}
