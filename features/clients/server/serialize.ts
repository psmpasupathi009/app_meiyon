import type { Client } from "@prisma/client";
import { displayMobile } from "@/lib/auth/mobile";

export type ClientSummary = {
  unitId: string;
  name: string;
  fatherOrSpouse: string | null;
  occupation: string | null;
  gender: string | null;
  mobile: string;
  altMobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  aadhaarLast4: string | null;
  referredBy: string | null;
  matterBrief: string | null;
  notes: string | null;
  smsConsent: boolean;
  createdAt: string;
};

export function toClientSummary(
  client: Pick<
    Client,
    | "unitId"
    | "name"
    | "fatherOrSpouse"
    | "occupation"
    | "gender"
    | "mobile"
    | "altMobile"
    | "email"
    | "address"
    | "city"
    | "district"
    | "state"
    | "aadhaarLast4"
    | "referredBy"
    | "matterBrief"
    | "notes"
    | "smsConsent"
    | "createdAt"
  >
): ClientSummary {
  return {
    unitId: client.unitId,
    name: client.name,
    fatherOrSpouse: client.fatherOrSpouse,
    occupation: client.occupation,
    gender: client.gender,
    mobile: displayMobile(client.mobile),
    altMobile: client.altMobile ? displayMobile(client.altMobile) : null,
    email: client.email,
    address: client.address,
    city: client.city,
    district: client.district,
    state: client.state,
    aadhaarLast4: client.aadhaarLast4,
    referredBy: client.referredBy,
    matterBrief: client.matterBrief,
    notes: client.notes,
    smsConsent: client.smsConsent,
    createdAt: client.createdAt.toISOString(),
  };
}
