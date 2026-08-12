"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { OTP_LENGTH } from "@/lib/auth/constants";

type OtpStepProps = {
  otp: string;
  loading: boolean;
  resendActive: boolean;
  remaining: number;
  error?: string;
  mode?: "setup" | "forgot";
  onChange: (value: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
};

export function OtpStep({
  otp,
  loading,
  resendActive,
  remaining,
  error,
  mode = "setup",
  onChange,
  onSubmit,
  onResend,
  onBack,
}: OtpStepProps) {
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {mode === "forgot" ? (
        <p className="border-l-2 border-gold pl-3 text-sm leading-relaxed text-muted-foreground">
          Enter the {OTP_LENGTH}-digit OTP sent by SMS to reset your PIN.
        </p>
      ) : null}

      <div className="space-y-2.5">
        <Label className="text-[0.8125rem] font-medium tracking-wide text-foreground">
          {OTP_LENGTH}-digit OTP
        </Label>
        <InputOTP
          maxLength={OTP_LENGTH}
          value={otp}
          onChange={onChange}
          autoFocus
          disabled={loading}
          containerClassName="justify-start gap-2.5"
        >
          <InputOTPGroup className="gap-2.5">
            {Array.from({ length: OTP_LENGTH }).map((_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-12 w-11 rounded-md border border-input bg-card text-lg text-foreground shadow-none first:rounded-md first:border-l last:rounded-md data-[active=true]:border-navy data-[active=true]:ring-1 data-[active=true]:ring-navy/25 sm:h-13 sm:w-12"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="h-12 w-full text-[0.9375rem] font-medium tracking-wide"
        disabled={loading || otp.length !== OTP_LENGTH}
      >
        {loading
          ? "Verifying…"
          : mode === "forgot"
            ? "Verify & reset PIN"
            : "Verify OTP"}
      </Button>

      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <button
          type="button"
          className="text-left text-muted-foreground transition-colors hover:text-navy disabled:opacity-50"
          onClick={onBack}
          disabled={loading}
        >
          {mode === "forgot" ? "Back to PIN" : "Change number"}
        </button>
        <button
          type="button"
          className="text-left font-medium text-navy underline-offset-4 transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline sm:text-right"
          onClick={onResend}
          disabled={resendActive || loading}
        >
          {resendActive ? `Resend in ${remaining}s` : "Resend OTP"}
        </button>
      </div>
    </form>
  );
}
