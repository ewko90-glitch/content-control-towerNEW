import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const databaseUrl = process.env.DATABASE_URL;
    const usePgAdapter = typeof databaseUrl === "string" && /^postgres(ql)?:\/\//i.test(databaseUrl);

    if (usePgAdapter) {
      const effectiveUrl = (() => {
        if (process.env.NODE_ENV !== "development") {
          return databaseUrl;
        }
        try {
          const parsed = new URL(databaseUrl);
          parsed.searchParams.set("sslmode", "no-verify");
          return parsed.toString();
        } catch {
          return databaseUrl;
        }
      })();

      const pool = new Pool({
        connectionString: effectiveUrl,
        ssl: process.env.NODE_ENV === "development" ? { rejectUnauthorized: false } : undefined,
      });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      });
    }

    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
