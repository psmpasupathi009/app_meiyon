import { z } from "zod";
import { OTP_LENGTH, PIN_LENGTH } from "@/lib/auth/constants";

export { OTP_LENGTH, PIN_LENGTH };

export const mobileSchema = z
  .string()
  .trim()
  .min(10, "Enter a valid mobile number")
  .max(15, "Enter a valid mobile number");

export const pinSchema = z
  .string()
  .regex(
    new RegExp(`^\\d{${PIN_LENGTH}}$`),
    `PIN must be exactly ${PIN_LENGTH} digits`
  );

export const otpSchema = z
  .string()
  .regex(
    new RegExp(`^\\d{${OTP_LENGTH}}$`),
    `OTP must be exactly ${OTP_LENGTH} digits`
  );
export const checkMobileSchema = z.object({
  mobile: mobileSchema,
});

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
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  });

export const loginSchema = z.object({
  mobile: mobileSchema,
  pin: pinSchema,
});

export const forgotPinResetSchema = z
  .object({
    pin: pinSchema,
    confirmPin: pinSchema,
    otpProofToken: z.string().min(10),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  });
