import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (!globalForPrisma.prisma) {
  // better-sqlite3's default rollback-journal mode serializes ALL access
  // (readers block writers and vice versa) — under concurrent requests at
  // peak load that shows up as sporadic "database is locked" errors. WAL
  // lets readers and a writer run concurrently, and busy_timeout makes a
  // writer that does collide with another writer retry for up to 5s
  // instead of failing immediately. Both are one-time, per-connection
  // settings, so this only needs to run once when the client is created.
  db.$executeRawUnsafe("PRAGMA journal_mode = WAL").catch(() => {});
  db.$executeRawUnsafe("PRAGMA busy_timeout = 5000").catch(() => {});
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
