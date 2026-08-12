export * from "./env";
export * from "./razorpay-client";
export * from "./create-invoice";
export * from "./create-subscription";
export * from "./verify-webhook";
export * from "./handle-webhook";

export async function getOfficeUsage(officeId: string) {
  const { prisma } = await import("@meiyon/db");
  const month = new Date().toISOString().slice(0, 7);
  const [counter, activeSeats] = await Promise.all([
    prisma.usageCounter.findUnique({
      where: { officeId_month: { officeId, month } },
    }),
    prisma.user.count({
      where: {
        officeId,
        isActive: true,
        NOT: { roles: { equals: ["client"] } },
      },
    }),
  ]);
  return {
    month,
    smsSent: counter?.smsSent ?? 0,
    storageBytes: counter?.storageBytes ?? BigInt(0),
    activeSeats,
  };
}
