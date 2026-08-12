import { z } from "zod";
import { office } from "@/config/company/office";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createClientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  fatherOrSpouse: optionalText(120),
  occupation: optionalText(80),
  gender: z.enum(["male", "female", "other", "prefer_not"]).optional().or(z.literal("")),
  mobile: z.string().trim().min(10, "Enter a valid mobile number").max(15),
  altMobile: optionalText(15),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  address: optionalText(500),
  city: optionalText(80),
  district: optionalText(80),
  state: optionalText(80),
  aadhaarLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Aadhaar last 4 must be 4 digits")
    .optional()
    .or(z.literal("")),
  referredBy: optionalText(120),
  matterBrief: optionalText(2000),
  notes: optionalText(1000),
  smsConsent: z.boolean().optional().default(true),
});

export const updateClientSchema = createClientSchema.partial();

export const importClientsRowSchema = z.object({
  unitId: optionalText(40),
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(10, "Enter a valid mobile number").max(15),
});

export const importClientsSchema = z.object({
  dryRun: z.boolean().default(true),
  rows: z.array(importClientsRowSchema).max(500, "Max 500 rows per import"),
});

export const CLIENT_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not", label: "Prefer not to say" },
] as const;

export const CLIENT_INTAKE_DEFAULTS: { state: string; district: string } = {
  state: office.defaultState,
  district: office.defaultDistrict,
};
