import { Prisma, type User, type UserRole } from "@prisma/client";
import { prisma } from "@meiyon/db";
import { normalizeMobile } from "@/lib/auth/mobile";
import { nextUnitId } from "@/lib/ids";
import type { OfficeScope } from "@/lib/office/scope";
import { officeData } from "@/lib/office/scope";

export class MobileConflictError extends Error {
  constructor(message = "This mobile number is already registered") {
    super(message);
    this.name = "MobileConflictError";
  }
}

export function requireNormalizedMobile(input: string): string {
  const mobile = normalizeMobile(input);
  if (!mobile) {
    throw new Error("Enter a valid 10-digit Indian mobile number");
  }
  return mobile;
}

export async function findUserByMobile(
  mobile91: string,
  officeId: string
): Promise<User | null> {
  return prisma.user.findFirst({
    where: { mobile: mobile91, officeId },
  });
}

export async function createUserWithUniqueMobile(
  input: {
    mobile: string;
    roles: UserRole[];
    name?: string;
    designation?: string;
    createdById?: string;
    isActive?: boolean;
  } & OfficeScope
): Promise<User> {
  const mobile = requireNormalizedMobile(input.mobile);
  const unitId = await nextUnitId("employee", input);

  try {
    return await prisma.user.create({
      data: {
        ...officeData(input),
        unitId,
        mobile,
        roles: input.roles,
        name: input.name,
        designation: input.designation,
        createdById: input.createdById,
        isActive: input.isActive ?? true,
        failedPinAttempts: 0,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new MobileConflictError();
    }
    throw error;
  }
}
