"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { displayMobile } from "./mobile";
import { isWeakPin } from "./pin";

type OfficeOption = { officeUnitId: string; officeName: string; requiresPin: boolean };
type Step = "mobile" | "office" | "pin" | "otp" | "setup_pin" | "otp_forgot" | "reset_pin";

export type LoginFormProps = {
  title: string;
  subtitle: string;
  brand?: string;
  brandInitial?: string;
  enableOfficePicker?: boolean;
  demoHint?: string;
  features?: string[];
};

function PinDots({ value, length }: { value: string; length: number }) {
  return (
    <div className="flex items-center justify-center gap-3 py-4">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full transition-all duration-200 ${
            i < value.length
              ? "bg-brand scale-110"
              : "bg-zinc-200"
          }`}
        />
      ))}
    </div>
  );
}

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`flex h-14 w-12 items-center justify-center rounded-xl border-2 text-2xl font-bold transition-all duration-200 ${
            i === value.length
              ? "border-brand ring-2 ring-brand/20"
              : value[i]
              ? "border-zinc-200 bg-zinc-50"
              : "border-zinc-200"
          }`}
        >
          {value[i] ? "●" : ""}
        </div>
      ))}
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="absolute opacity-0 w-px h-px"
        autoFocus
      />
    </div>
  );
}

const DEFAULT_FEATURES = [
  "Clients, cases, and diary in one place",
  "Court roster, dak register, and HRMS",
  "SMS reminders for upcoming hearings",
  "Secure multi-tenant data isolation",
];

export function LoginForm({
  title,
  subtitle,
  brand = "MEIYON",
  brandInitial,
  enableOfficePicker,
  demoHint,
  features = DEFAULT_FEATURES,
}: LoginFormProps) {
  const initial = (brandInitial ?? brand.charAt(0) ?? "?").toUpperCase();
  const router = useRouter();
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [otp, setOtp] = useState("");
  const [otpProofToken, setOtpProofToken] = useState("");
  const [officeUnitId, setOfficeUnitId] = useState("");
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<"setup" | "forgot_pin">("setup");

  async function api<T>(path: string, body: unknown): Promise<{ ok: boolean; data?: T; error?: { message: string } }> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    try {
      return await res.json();
    } catch {
      return {
        ok: false,
        error: { message: `Server error (${res.status}). Try again.` },
      };
    }
  }

  async function checkMobile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const json = await api<{
        status: string;
        message?: string;
        officeUnitId?: string;
        offices?: OfficeOption[];
        otpPending?: boolean;
      }>("/api/auth/check-mobile", { mobile });
      if (!json.ok) throw new Error(json.error?.message ?? "Failed");
      const data = json.data!;
      if (data.status === "not_found" || data.status === "suspended") {
        setError(data.message ?? "Not registered");
        return;
      }
      if (enableOfficePicker && data.status === "office_picker" && data.offices) {
        setOffices(data.offices);
        setStep("office");
        return;
      }
      if (data.officeUnitId) setOfficeUnitId(data.officeUnitId);
      if (data.status === "otp_required" || data.status === "setup_pin") {
        setOtpPurpose("setup");
        if (data.otpPending) {
          setStep("otp");
          setOtp("");
          return;
        }
        await sendOtpFlow("setup");
        return;
      }
      setStep("pin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function completeOtpVerify(code: string, purpose: "setup" | "forgot_pin") {
    const json = await api<{ otpProofToken: string }>("/api/auth/verify-otp", {
      mobile,
      otp: code,
      purpose,
      officeUnitId: officeUnitId || undefined,
    });
    if (!json.ok) {
      throw new Error(json.error?.message ?? "Invalid OTP");
    }
    setOtpProofToken(json.data!.otpProofToken);
    setOtpPurpose(purpose);
    setStep(purpose === "forgot_pin" ? "reset_pin" : "setup_pin");
    setPin("");
    setConfirmPin("");
  }

  async function sendOtpFlow(purpose: "setup" | "forgot_pin") {
    setLoading(true);
    setError("");
    try {
      const json = await api<{ bypassed?: boolean; otp?: string }>("/api/auth/send-otp", {
        mobile,
        purpose,
        officeUnitId: officeUnitId || undefined,
      });
      if (!json.ok) throw new Error(json.error?.message ?? "Failed to send OTP");
      const data = json.data ?? {};
      if (data.bypassed) {
        await completeOtpVerify(data.otp || "0000", purpose);
        return;
      }
      setOtpPurpose(purpose);
      setStep(purpose === "forgot_pin" ? "otp_forgot" : "otp");
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await completeOtpVerify(otp, otpPurpose);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function setupPin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    if (isWeakPin(pin)) {
      setError("Choose a stronger PIN (avoid 123456 and repeats)");
      return;
    }
    if (!otpProofToken) {
      setError("OTP verification expired. Start again.");
      setStep("mobile");
      return;
    }
    setLoading(true);
    const path =
      otpPurpose === "forgot_pin" ? "/api/auth/forgot-pin/reset" : "/api/auth/setup-pin";
    const json = await api(path, {
      pin,
      confirmPin,
      otpProofToken,
      officeUnitId: officeUnitId || undefined,
    });
    setLoading(false);
    if (!json.ok) {
      setError(json.error?.message ?? "Failed to set PIN");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const json = await api("/api/auth/login", {
      mobile,
      pin,
      officeUnitId: officeUnitId || undefined,
    });
    setLoading(false);
    if (!json.ok) {
      setError(json.error?.message ?? "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const stepLabel: Record<Step, string> = {
    mobile: "Enter your mobile number",
    office: "Select your office",
    pin: "Enter your PIN",
    otp: "Verify your number",
    setup_pin: "Create a PIN",
    otp_forgot: "Reset your PIN",
    reset_pin: "Choose a new PIN",
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-brand via-black to-[#050505] p-12 text-white">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-lg font-extrabold text-white">
              {initial}
            </span>
            <span className="text-xl font-bold tracking-tight">{brand}</span>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-bold tracking-tight leading-tight">
            {title}
          </h2>
          <p className="mt-3 text-lg text-white/70">{subtitle}</p>

          <div className="mt-12 space-y-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-sm text-white/80">
                <ShieldCheck className="h-4 w-4 shrink-0 text-gold" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        {demoHint && (
          <p className="text-xs text-gold border border-brand/40 rounded-lg px-3 py-2 bg-gold/20">
            {demoHint}
          </p>
        )}
      </div>

      {/* Right panel – form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
              {initial}
            </span>
            <span className="font-bold tracking-tight text-zinc-900">{brand}</span>
          </div>

          {demoHint && (
            <p className="mb-5 text-xs text-gold border border-gold/40 rounded-lg px-3 py-2 bg-gold/20 lg:hidden">
              {demoHint}
            </p>
          )}

          {/* Step badge */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-navy ring-1 ring-brand/20">
              {title}
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
              {stepLabel[step]}
            </h1>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* ── Mobile step ── */}
          {step === "mobile" && (
            <form onSubmit={checkMobile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Mobile number
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                    placeholder="10-digit number"
                    className="w-full rounded-xl border border-zinc-200 pl-10 pr-3 py-3 text-sm text-zinc-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || mobile.length !== 10}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50 transition-all"
              >
                {loading ? "Checking…" : <>Continue <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}

          {/* ── Office picker ── */}
          {step === "office" && enableOfficePicker && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (officeUnitId) {
                  const o = offices.find((x) => x.officeUnitId === officeUnitId);
                  o?.requiresPin ? setStep("pin") : sendOtpFlow("setup");
                }
              }}
              className="space-y-4"
            >
              <p className="text-sm text-zinc-500">
                Select office for {displayMobile(`91${mobile}`)}
              </p>
              <div className="space-y-2">
                {offices.map((o) => (
                  <label
                    key={o.officeUnitId}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                      officeUnitId === o.officeUnitId
                        ? "border-brand bg-brand/10 ring-1 ring-brand/25"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="office"
                      value={o.officeUnitId}
                      checked={officeUnitId === o.officeUnitId}
                      onChange={() => setOfficeUnitId(o.officeUnitId)}
                      className="text-brand"
                    />
                    <span className="text-sm font-medium text-zinc-900">{o.officeName}</span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={!officeUnitId}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* ── PIN entry ── */}
          {step === "pin" && (
            <form onSubmit={login} className="space-y-4">
              <p className="text-sm text-zinc-500">
                For {displayMobile(`91${mobile}`)}
              </p>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  6-digit PIN
                </label>
                <PinDots value={pin} length={6} />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-center text-xl tracking-widest sm:text-2xl sm:tracking-[0.5em] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || pin.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => sendOtpFlow("forgot_pin")}
                className="w-full text-center text-sm text-brand hover:text-navy"
              >
                Forgot PIN?
              </button>
            </form>
          )}

          {/* ── OTP entry ── */}
          {(step === "otp" || step === "otp_forgot") && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <p className="text-sm text-zinc-500">
                Enter the 4-digit OTP for {displayMobile(`91${mobile}`)}
              </p>
              <div className="relative" onClick={() => (document.querySelector("input[type=text]") as HTMLInputElement | null)?.focus()}>
                <OtpBoxes value={otp} onChange={setOtp} />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 4}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify OTP"}
              </button>
              <button
                type="button"
                onClick={() => sendOtpFlow(otpPurpose)}
                disabled={loading}
                className="w-full text-center text-sm text-brand hover:text-navy disabled:opacity-50"
              >
                Resend OTP
              </button>
            </form>
          )}

          {/* ── Set/Reset PIN ── */}
          {(step === "setup_pin" || step === "reset_pin") && (
            <form onSubmit={setupPin} className="space-y-4">
              <p className="text-sm text-zinc-500">
                Choose a 6-digit PIN. Avoid 123456, repeats, or simple sequences.
              </p>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  New PIN
                </label>
                <PinDots value={pin} length={6} />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit PIN"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-center text-xl tracking-widest sm:text-2xl sm:tracking-[0.5em] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Repeat PIN"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-center text-xl tracking-widest sm:text-2xl sm:tracking-[0.5em] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={
                  loading ||
                  pin.length !== 6 ||
                  confirmPin.length !== 6 ||
                  pin !== confirmPin
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save PIN & sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
