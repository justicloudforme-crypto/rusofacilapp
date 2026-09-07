import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const q = process.argv[2];
const r = await db.execute(q);
console.log(JSON.stringify(r.rows, null, 1));
