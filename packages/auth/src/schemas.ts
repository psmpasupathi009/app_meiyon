import { z } from "zod";
import { OTP_LENGTH, PIN_LENGTH } from "./constants";

export const mobileSchema = z.string().trim().min(10).max(15);
export const pinSchema = z.string().regex(new RegExp(`^\\d{${PIN_LENGTH}}$`), `PIN must be ${PIN_LENGTH} digits`);
export const otpSchema = z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `OTP must be ${OTP_LENGTH} digits`);

export const checkMobileSchema = z.object({ mobile: mobileSchema });
export const sendOtpSchema = z.object({
  mobile: mobileSchema,
  purpose: z.enum(["setup", "forgot_pin"]),
});
export const verifyOtpSchema = z.object({
  mobile: mobileSchema,
  otp: otpSchema,
  purpose: z.enum(["setup", "forgot_pin"]),
});
export const setupPinSchema = z
  .object({
    pin: pinSchema,
    confirmPin: pinSchema,
    otpProofToken: z.string().min(10),
    officeUnitId: z.string().optional(),
  })
  .refine((d) => d.pin === d.confirmPin, { message: "PINs do not match", path: ["confirmPin"] });
export const loginSchema = z.object({ mobile: mobileSchema, pin: pinSchema, officeUnitId: z.string().optional() });
export const forgotPinResetSchema = setupPinSchema;
