import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { meterAdapter } from "./db-read-meter";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  // TURSO_DATABASE_URL is a remote libsql:// URL when running against
  // Turso; falls back to a local file so `npm run dev` keeps working
  // against dev.db without any Turso account.
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  // meterAdapter отдаёт ТОТ ЖЕ объект, пока не задана MEASURE_DB_READS
  // (заход 7.222, прибор подсчёта походов в базу). На выкате переменной
  // нет и быть не может: её отсутствие держит `check:read-meter-off`.
  return new PrismaClient({ adapter: meterAdapter(adapter) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
