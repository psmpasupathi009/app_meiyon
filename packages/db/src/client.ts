import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("serverSelectionTimeoutMS")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}serverSelectionTimeoutMS=5000`;
}

const datasourceUrl = databaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

