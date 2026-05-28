import { useEffect, useState } from "react";
import { getAdminTags, createTag, deleteTag } from "../../api/admin_tag";
import type { Tag } from "../../types/tag_type";
import styles from "./AdminTagsPage.module.css";

export function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAdminTags()
      .then(setTags)
      .catch(() => setError("Failed to load tags"))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    try {
      setSaving(true);
      setError(null);
      const tag = await createTag(name);
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    } catch {
      setError("Tag already exists or could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Delete tag "${tag.name}"? Products using it will lose this tag.`)) return;
    try {
      await deleteTag(tag.id);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch {
      setError("Failed to delete tag.");
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Manage Tags</h1>
      <p className={styles.subtitle}>Tags let customers filter products by category.</p>

      <form className={styles.addForm} onSubmit={handleAdd}>
        <input
          className={styles.input}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. tool-antibodies"
          disabled={saving}
        />
        <button type="submit" className={styles.addButton} disabled={saving || !newName.trim()}>
          Add Tag
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.hint}>Loading…</p>
      ) : tags.length === 0 ? (
        <p className={styles.hint}>No tags yet.</p>
      ) : (
        <ul className={styles.tagList}>
          {tags.map((tag) => (
            <li key={tag.id} className={styles.tagRow}>
              <span className={styles.tagName}>{tag.name}</span>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => void handleDelete(tag)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
