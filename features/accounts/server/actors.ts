import { prisma } from "@meiyon/db";
import type { PaymentActor } from "@/features/accounts/server/serialize";

export async function resolveActorsByIds(
  ids: Array<string | null | undefined>
): Promise<Map<string, PaymentActor>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, unitId: true, name: true },
  });

  return new Map(
    users.map((u) => [u.id, { unitId: u.unitId, name: u.name }] as const)
  );
}
