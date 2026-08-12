import type { User } from "@prisma/client";
import { displayMobile } from "@/lib/auth/mobile";
import { normalizeDesignation } from "@meiyon/config";
import { personDisplayName } from "@/shared/lib/person";
import { userPhotoUrl } from "@/lib/auth/user-photo";
import {
  parseDefaultCourts,
  type DefaultCourt,
} from "@/lib/hearings/court-key";

export type EmployeeSummary = {
  unitId: string;
  name: string | null;
  /** Always a resolved display label (never empty when mobile/unitId exist). */
  displayName: string;
  mobile: string;
  roles: string[];
  designation: string | null;
  email: string | null;
  address: string | null;
  photoUrl?: string;
  isActive: boolean;
  hasPin: boolean;
  defaultCourts: DefaultCourt[];
  lastLoginAt: string | null;
  createdAt: string;
};

/** Never leak Mongo _id or pinHash — public shape only. */
export function toEmployeeSummary(user: User): EmployeeSummary {
  const mobile = displayMobile(user.mobile);
  return {
    unitId: user.unitId,
    name: user.name,
    displayName: personDisplayName({
      name: user.name,
      mobile,
      unitId: user.unitId,
    }),
    mobile,
    roles: user.roles,
    designation: normalizeDesignation(user.designation) ?? user.designation,
    email: user.email,
    address: user.address,
    photoUrl: userPhotoUrl(user.unitId, Boolean(user.photoKey)),
    isActive: user.isActive,
    hasPin: Boolean(user.pinHash),
    defaultCourts: parseDefaultCourts(user.defaultCourts),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
