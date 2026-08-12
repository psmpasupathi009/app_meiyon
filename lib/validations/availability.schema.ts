import { z } from "zod";

const hhmm = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Use HH:mm");

const dateStringOrDate = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date/time");

export const weeklyHoursPutSchema = z.object({
  userUnitId: z.string().trim().optional().or(z.literal("")),
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        ranges: z.array(
          z.object({
            startTime: hhmm,
            endTime: hhmm,
          })
        ),
      })
    )
    .max(7),
});

export const createTimeBlockSchema = z
  .object({
    userUnitId: z.string().trim().optional().or(z.literal("")),
    startsAt: dateStringOrDate,
    endsAt: dateStringOrDate,
    kind: z.enum(["break", "court", "personal", "other"]).default("break"),
    reason: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .refine((d) => d.endsAt.getTime() > d.startsAt.getTime(), {
    message: "End must be after start",
    path: ["endsAt"],
  });

/** Partial update for PATCH — startsAt / endsAt / kind / reason. */
export const updateTimeBlockSchema = z
  .object({
    startsAt: dateStringOrDate.optional(),
    endsAt: dateStringOrDate.optional(),
    kind: z.enum(["break", "court", "personal", "other"]).optional(),
    reason: z.string().trim().max(200).optional().or(z.literal("")).nullable(),
  })
  .refine(
    (d) => {
      if (d.startsAt && d.endsAt) {
        return d.endsAt.getTime() > d.startsAt.getTime();
      }
      return true;
    },
    { message: "End must be after start", path: ["endsAt"] }
  );

export const BLOCK_KIND_OPTIONS = [
  { value: "break", label: "Break / lunch" },
  { value: "court", label: "Court" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Travel / site" },
] as const;
