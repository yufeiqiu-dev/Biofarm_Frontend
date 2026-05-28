import { apiRequest } from "./client";
import type { Tag } from "../types/tag_type";

export async function getTags(): Promise<Tag[]> {
  return apiRequest<Tag[]>("/tags");
}
