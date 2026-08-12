import { prisma } from "@meiyon/db";
import { normalizeMobile } from "@/lib/auth/mobile";

export type ImportClientRef = {
  id: string;
  unitId: string;
  mobile: string;
};

export type ImportCaseRef = {
  id: string;
  unitId: string;
  clientId: string;
  clientUnitId: string;
  status: string;
  caseNumber: string | null;
  filingNumber: string | null;
  cnr: string | null;
  nextHearingAt: Date | null;
  primaryAdvocateMobile: string | null;
  advocateMobiles: string[];
  state: string | null;
  district: string | null;
  city: string | null;
  courtName: string | null;
};

export type ImportUserRef = {
  id: string;
  unitId: string;
  roles: string[];
};

export async function findClientByUnitId(
  unitId: string,
  officeId: string
): Promise<ImportClientRef | null> {
  const id = unitId.trim();
  if (!id) return null;
  return prisma.client.findFirst({
    where: { unitId: id, officeId },
    select: { id: true, unitId: true, mobile: true },
  });
}

export async function findClientByMobile(
  mobileInput: string,
  officeId: string
): Promise<ImportClientRef | null> {
  const mobile = normalizeMobile(mobileInput);
  if (!mobile) return null;
  return prisma.client.findFirst({
    where: { mobile, officeId },
    select: { id: true, unitId: true, mobile: true },
  });
}

export async function findCaseByUnitId(
  unitId: string,
  officeId: string
): Promise<ImportCaseRef | null> {
  const id = unitId.trim();
  if (!id) return null;
  return prisma.case.findFirst({
    where: { unitId: id, officeId },
    select: {
      id: true,
      unitId: true,
      clientId: true,
      clientUnitId: true,
      status: true,
      caseNumber: true,
      filingNumber: true,
      cnr: true,
      nextHearingAt: true,
      primaryAdvocateMobile: true,
      advocateMobiles: true,
      state: true,
      district: true,
      city: true,
      courtName: true,
    },
  });
}

export async function findUserByUnitId(
  unitId: string,
  officeId: string
): Promise<ImportUserRef | null> {
  const id = unitId.trim();
  if (!id) return null;
  return prisma.user.findFirst({
    where: { unitId: id, officeId },
    select: { id: true, unitId: true, roles: true },
  });
}

/** True when case belongs to client. */
export function caseBelongsToClient(
  caseItem: { clientUnitId: string },
  clientUnitId: string
): boolean {
  return caseItem.clientUnitId === clientUnitId;
}
