"use client";

import { useEffect, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OtpStep } from "@/features/auth/components/otp-step";
import { PhoneStep } from "@/features/auth/components/phone-step";
import { PinStep } from "@/features/auth/components/pin-step";
import { useResendCountdown } from "@/features/auth/hooks/use-resend-countdown";
import {
  authFetch,
  getErrorCode,
  getErrorMessage,
  getRetryAfterSec,
} from "@/lib/api/client";
import { isWeakPin } from "@/lib/auth/pin-rules";

type Step =
  | "phone"
  | "pin"
  | "otp_setup"
  | "setup_pin"
  | "otp_forgot"
  | "reset_pin";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const countdown = useResendCountdown(60);

  const [step, setStep] = useState<Step>("phone");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [otpProofToken, setOtpProofToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [lockRemainingSec, setLockRemainingSec] = useState(0);

  const busy = loading || pending;

  useEffect(() => {
    if (!pinLocked) return;
    const id = window.setInterval(() => {
      setLockRemainingSec((s) => {
        if (s <= 1) {
          setPinLocked(false);
          setError("");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pinLocked]);

  function resetCodes() {
    setOtp("");
    setPin("");
    setConfirmPin("");
    setOtpProofToken("");
    setError("");
    setPinLocked(false);
    setLockRemainingSec(0);
  }

  function goHome() {
    startTransition(() => {
      router.replace("/");
      router.refresh();
    });
  }

  function applyPinLock(data: unknown, fallbackSec = 15 * 60) {
    const sec = getRetryAfterSec(data) ?? fallbackSec;
    setPinLocked(true);
    setLockRemainingSec(sec);
    setPin("");
    setError(
      getErrorMessage(
        data,
        `PIN locked. Use Forgot PIN, or try again in ${sec}s.`
      )
    );
  }

  async function handleCheckMobile() {
    if (busy) return;
    setError("");
    if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
      setError("Enter a valid 10-digit Indian mobile number (starts with 6–9)");
      return;
    }

    setLoading(true);
    const { ok, data } = await authFetch<{
      status?: string;
      message?: string;
      error?: string;
    }>("/api/auth/check-mobile", { mobile });
    setLoading(false);

    if (!ok) {
      const code = getErrorCode(data);
      if (code === "VALIDATION") {
        setError(
          getErrorMessage(
            data,
            "Enter a valid 10-digit Indian mobile number"
          )
        );
        return;
      }
      if (code === "RATE_LIMITED") {
        setError(
          getErrorMessage(data, "Too many attempts. Please try again later.")
        );
        return;
      }
      setError(
        getErrorMessage(data, "Could not verify this number. Please try again.")
      );
      return;
    }

    if (data.status === "pin") {
      resetCodes();
      setStep("pin");
      return;
    }

    if (data.status === "otp_required") {
      await sendOtp("setup");
      return;
    }

    if (data.status === "not_found") {
      setError(
        data.message ||
          "This number is not registered. Contact your admin for access."
      );
      return;
    }

    setError("Could not verify this number. Please try again.");
  }

  async function sendOtp(purpose: "setup" | "forgot_pin") {
    if (busy) return;
    setLoading(true);
    setError("");
    const { ok, data } = await authFetch<{ error?: string; message?: string }>(
      "/api/auth/send-otp",
      { mobile, purpose }
    );
    setLoading(false);

    if (!ok) {
      setError(getErrorMessage(data, "Failed to send OTP"));
      return;
    }

    toast.success("OTP sent by SMS");
    countdown.start();
    setOtp("");
    setStep(purpose === "setup" ? "otp_setup" : "otp_forgot");
  }

  async function handleVerifyOtp(purpose: "setup" | "forgot_pin") {
    if (busy) return;
    setLoading(true);
    setError("");
    const { ok, data } = await authFetch<{
      otpProofToken?: string;
      error?: string;
    }>("/api/auth/verify-otp", { mobile, otp, purpose });
    setLoading(false);

    if (!ok || !data.otpProofToken) {
      setError(getErrorMessage(data, "Incorrect OTP"));
      return;
    }

    setOtpProofToken(data.otpProofToken);
    setPin("");
    setConfirmPin("");
    setStep(purpose === "setup" ? "setup_pin" : "reset_pin");
  }

  async function handleLogin() {
    if (busy || pinLocked) return;
    setLoading(true);
    setError("");
    const { ok, status, data } = await authFetch<{
      error?: string;
      code?: string;
    }>("/api/auth/login", { mobile, pin });
    setLoading(false);

    if (!ok) {
      const locked =
        status === 423 || getErrorCode(data) === "PIN_LOCKED";
      if (locked) {
        applyPinLock(data);
        return;
      }

      setError(getErrorMessage(data, "Invalid mobile or PIN"));
      setPin("");
      return;
    }

    setPinLocked(false);
    setLockRemainingSec(0);
    toast.success("Welcome back");
    goHome();
  }

  async function handleSetupPin() {
    if (busy) return;
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    if (isWeakPin(pin)) {
      setError(
        "Choose a stronger 6-digit PIN. Avoid sequences like 123456 or repeated digits."
      );
      return;
    }

    setLoading(true);
    setError("");
    const { ok, data } = await authFetch<{ error?: string }>(
      "/api/auth/setup-pin",
      { pin, confirmPin, otpProofToken }
    );
    setLoading(false);

    if (!ok) {
      setError(getErrorMessage(data, "Failed to set PIN"));
      return;
    }

    toast.success("PIN created successfully");
    goHome();
  }

  async function handleResetPin() {
    if (busy) return;
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    if (isWeakPin(pin)) {
      setError(
        "Choose a stronger 6-digit PIN. Avoid sequences like 123456 or repeated digits."
      );
      return;
    }

    setLoading(true);
    setError("");
    const { ok, data } = await authFetch<{ error?: string }>(
      "/api/auth/forgot-pin/reset",
      { pin, confirmPin, otpProofToken }
    );
    setLoading(false);

    if (!ok) {
      setError(getErrorMessage(data, "Failed to reset PIN"));
      return;
    }

    toast.success("PIN reset successfully");
    goHome();
  }

  async function handleForgotPin() {
    if (busy) return;
    resetCodes();
    await sendOtp("forgot_pin");
  }

  const lockHint =
    pinLocked && lockRemainingSec > 0
      ? `Try again in ${lockRemainingSec}s, or use Forgot PIN.`
      : undefined;

  const heading =
    step === "phone"
      ? { title: "Sign in", subtitle: null as string | null }
      : step === "pin"
        ? {
            title: pinLocked ? "PIN locked" : "Enter PIN",
            subtitle: `+91 ${mobile}`,
          }
        : step === "otp_setup"
          ? { title: "Verify OTP", subtitle: `Sent to +91 ${mobile}` }
          : step === "otp_forgot"
            ? { title: "Reset PIN", subtitle: `OTP sent to +91 ${mobile}` }
            : step === "setup_pin"
              ? { title: "Create PIN", subtitle: "Choose a 6-digit PIN" }
              : { title: "New PIN", subtitle: "Choose a new 6-digit PIN" };

  return (
    <div className="w-full text-foreground">
      <header className="mb-6 sm:mb-9">
        <Lock
          aria-hidden
          className="mb-3 size-5 text-navy sm:size-6"
          strokeWidth={1.75}
        />
        <h2 className="text-xl font-semibold tracking-tight text-navy sm:text-[1.5rem]">
          {heading.title}
        </h2>
        {heading.subtitle ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {heading.subtitle}
          </p>
        ) : null}
      </header>

      {step === "phone" ? (
        <PhoneStep
          mobile={mobile}
          loading={busy}
          error={error}
          onChange={setMobile}
          onSubmit={handleCheckMobile}
        />
      ) : null}

      {step === "pin" ? (
        <PinStep
          pin={pin}
          loading={busy}
          error={pinLocked ? lockHint : error}
          showForgot
          locked={pinLocked}
          onPinChange={(value) => {
            setPin(value);
            if (error && !pinLocked) setError("");
          }}
          onSubmit={handleLogin}
          onForgot={handleForgotPin}
          onBack={() => {
            resetCodes();
            setStep("phone");
          }}
        />
      ) : null}

      {step === "otp_setup" || step === "otp_forgot" ? (
        <OtpStep
          otp={otp}
          loading={busy}
          resendActive={countdown.active}
          remaining={countdown.remaining}
          error={error}
          mode={step === "otp_forgot" ? "forgot" : "setup"}
          onChange={setOtp}
          onSubmit={() =>
            handleVerifyOtp(step === "otp_setup" ? "setup" : "forgot_pin")
          }
          onResend={() =>
            sendOtp(step === "otp_setup" ? "setup" : "forgot_pin")
          }
          onBack={() => {
            resetCodes();
            setStep(step === "otp_forgot" ? "pin" : "phone");
          }}
        />
      ) : null}

      {step === "setup_pin" ? (
        <PinStep
          pin={pin}
          confirmPin={confirmPin}
          showConfirm
          loading={busy}
          error={error}
          onPinChange={setPin}
          onConfirmChange={setConfirmPin}
          onSubmit={handleSetupPin}
          onBack={() => {
            // Keep otpProofToken — verified OTP cannot be reused; only clear PIN fields.
            setPin("");
            setConfirmPin("");
            setError("");
            setStep("otp_setup");
          }}
        />
      ) : null}

      {step === "reset_pin" ? (
        <PinStep
          pin={pin}
          confirmPin={confirmPin}
          showConfirm
          loading={busy}
          error={error}
          submitLabel="Save new PIN"
          onPinChange={setPin}
          onConfirmChange={setConfirmPin}
          onSubmit={handleResetPin}
          onBack={() => {
            // Keep otpProofToken — verified OTP cannot be reused; only clear PIN fields.
            setPin("");
            setConfirmPin("");
            setError("");
            setStep("otp_forgot");
          }}
        />
      ) : null}
    </div>
  );
}
