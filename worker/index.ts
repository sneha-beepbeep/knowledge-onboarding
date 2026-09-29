import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";
import { items } from "./db/schema";

// `Env` (with DB and IMAGES) is generated from wrangler.jsonc by `npm run cf-typegen`.
const app = new Hono<{ Bindings: Env }>().basePath("/api");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const routes = app
  // List all items, newest first.
  .get("/items", async (c) => {
    const db = drizzle(c.env.DB);
    const rows = await db.select().from(items).orderBy(desc(items.id));
    return c.json(rows);
  })

  // Create an item. Expects multipart form data: `name` (text) and optional `image` (file).
  .post("/items", async (c) => {
    const form = await c.req.formData();
    const name = String(form.get("name") ?? "").trim();
    if (!name) return c.json({ error: "Name is required" }, 400);

    let imageKey: string | null = null;
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith("image/")) {
        return c.json({ error: "File must be an image" }, 400);
      }
      if (image.size > MAX_IMAGE_BYTES) {
        return c.json({ error: "Image must be under 5 MB" }, 400);
      }
      const ext = image.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
      imageKey = `${crypto.randomUUID()}.${ext}`;
      await c.env.IMAGES.put(imageKey, image.stream(), {
        httpMetadata: { contentType: image.type },
      });
    }

    const db = drizzle(c.env.DB);
    const [created] = await db.insert(items).values({ name, imageKey }).returning();
    return c.json(created, 201);
  })

  // Delete an item and its image.
  .delete("/items/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.DB);
    const [deleted] = await db.delete(items).where(eq(items.id, id)).returning();
    if (!deleted) return c.json({ error: "Not found" }, 404);
    if (deleted.imageKey) await c.env.IMAGES.delete(deleted.imageKey);
    return c.json({ ok: true });
  })

  // Serve an image from R2.
  .get("/images/:key", async (c) => {
    const object = await c.env.IMAGES.get(c.req.param("key"));
    if (!object) return c.notFound();
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(object.body, { headers });
  });

// The frontend imports this type to get a fully typed API client (see src/api.ts).
export type AppType = typeof routes;

export default app;
