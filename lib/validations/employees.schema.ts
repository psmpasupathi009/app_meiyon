import { z } from "zod";
import { DESIGNATIONS, normalizeDesignation } from "@meiyon/config";

export const employeeRoleEnum = z.enum([
  "admin",
  "sub_admin",
  "staff",
  "advocate",
  "accountant",
]);

const defaultCourtSchema = z.object({
  state: z.string().trim().min(1).max(80),
  district: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  courtName: z.string().trim().min(1).max(160),
});

/** Accepts current designations and legacy aliases (e.g. Administration → Office Manager). */
const designationField = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    return typeof value === "string" ? value.trim() : value;
  },
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      const normalized = normalizeDesignation(value);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid designation. Use one of: ${DESIGNATIONS.join(", ")}`,
        });
        return z.NEVER;
      }
      return normalized;
    })
);

export const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    mobile: z.string().trim().min(10, "Enter a valid mobile number").max(15),
    designation: designationField.refine(
      (value): value is NonNullable<typeof value> => Boolean(value),
      { message: "Select a designation" }
    ),
    roles: z.array(employeeRoleEnum).min(1, "Select at least one role"),
    email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    defaultCourts: z.array(defaultCourtSchema).max(40).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.roles.includes("advocate") &&
      (!data.defaultCourts || data.defaultCourts.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultCourts"],
        message: "Add at least one default court for advocates",
      });
    }
  });

export const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    designation: designationField,
    roles: z.array(employeeRoleEnum).min(1, "Select at least one role").optional(),
    email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    isActive: z.boolean().optional(),
    defaultCourts: z.array(defaultCourtSchema).max(40).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.roles?.includes("advocate") &&
      data.defaultCourts !== undefined &&
      data.defaultCourts.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultCourts"],
        message: "Advocates need at least one default court",
      });
    }
  });

export const importEmployeesRowSchema = z.object({
  unitId: z.string().trim().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required"),
  designation: designationField.refine(
    (value): value is NonNullable<typeof value> => Boolean(value),
    { message: "Select a designation" }
  ),
  mobile: z.string().trim().min(10, "Enter a valid mobile number").max(15),
  defaultCourtNames: z.string().trim().optional().or(z.literal("")),
  defaultState: z.string().trim().optional().or(z.literal("")),
  defaultDistrict: z.string().trim().optional().or(z.literal("")),
  defaultCity: z.string().trim().optional().or(z.literal("")),
});

export const importEmployeesSchema = z.object({
  dryRun: z.boolean().default(true),
  rows: z.array(importEmployeesRowSchema).max(500, "Max 500 rows per import"),
});

export const permissionsMatrixPutSchema = z.object({
  rows: z.array(
    z.object({
      role: employeeRoleEnum,
      module: z.string().min(1),
      action: z.string().min(1),
      allowed: z.boolean(),
    })
  ),
});

export const permissionsPreviewSchema = z.object({
  roles: z.array(employeeRoleEnum).min(1),
});
