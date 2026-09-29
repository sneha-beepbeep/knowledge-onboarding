import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Database tables live here. After changing this file, run `npm run db:generate`.
export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // Key of the uploaded image in the R2 bucket (null if no image).
  imageKey: text("image_key"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Item = typeof items.$inferSelect;
