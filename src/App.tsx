import { useEffect, useState, type FormEvent } from "react";
import type { InferResponseType } from "hono/client";
import { api, imageUrl } from "./api";

type Item = InferResponseType<typeof api.items.$get>[number];

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function loadItems() {
    const res = await api.items.$get();
    setItems(await res.json());
  }

  useEffect(() => {
    loadItems().catch(() => setError("Couldn't load items"));
  }, []);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.items.$post({
        form: image ? { name, image } : { name },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Something went wrong");
        return;
      }
      setName("");
      setImage(null);
      setFileInputKey((k) => k + 1); // clears the file picker
      await loadItems();
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: number) {
    await api.items[":id"].$delete({ param: { id: String(id) } });
    await loadItems();
  }

  return (
    <main>
      <h1>My App</h1>
      <p className="subtitle">
        A working starter: React frontend, Hono API, D1 database, R2 image storage.
      </p>

      <form onSubmit={addItem} className="card">
        <input
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          key={fileInputKey}
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add item"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      {items.length === 0 ? (
        <p className="empty">No items yet. Add one above.</p>
      ) : (
        <ul className="grid">
          {items.map((item) => (
            <li key={item.id} className="card item">
              {item.imageKey ? (
                <img src={imageUrl(item.imageKey)} alt={item.name} />
              ) : (
                <div className="placeholder">No image</div>
              )}
              <div className="item-row">
                <span>{item.name}</span>
                <button className="link" onClick={() => deleteItem(item.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
