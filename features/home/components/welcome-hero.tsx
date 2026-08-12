import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatTodayLabel,
  greetingLabel,
} from "@/features/home/components/welcome-helpers";

export type WelcomeHeroProps = {
  firstName: string;
  isAdmin: boolean;
  canBookAppointment: boolean;
  canCreateClient: boolean;
  canRegisterCase: boolean;
  canAddPayment: boolean;
};

export function WelcomeHero({
  firstName,
  isAdmin,
  canBookAppointment,
  canCreateClient,
  canRegisterCase,
  canAddPayment,
}: WelcomeHeroProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-brand/30 text-brand-foreground shadow-sm"
      style={{ backgroundColor: "var(--brand)" }}
    >
      <div className="relative px-4 py-5 sm:px-6 sm:py-6 md:px-7 md:py-7">
        <div className="relative flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-white/70">{formatTodayLabel()}</p>
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90">
                {isAdmin ? "Admin office board" : "My day"}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-3xl">
              {greetingLabel()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
              {isAdmin
                ? "Act on blockers, then scan today’s schedule and who’s in."
                : "Your schedule for today — appointments, hearings, and attendance."}
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
            {canBookAppointment ? (
              <Button
                asChild
                size="sm"
                variant="on-brand-solid"
                className="w-full shrink-0 sm:w-auto"
              >
                <Link href="/appointments?new=1">
                  <Plus className="size-4" />
                  Book appointment
                </Link>
              </Button>
            ) : null}
            {canCreateClient ? (
              <Button
                asChild
                size="sm"
                variant="on-brand-solid"
                className="w-full shrink-0 sm:w-auto"
              >
                <Link href="/clients?new=1">
                  <Plus className="size-4" />
                  New client
                </Link>
              </Button>
            ) : null}
            {canRegisterCase ? (
              <Button
                asChild
                size="sm"
                variant="on-brand-solid"
                className="w-full shrink-0 sm:w-auto"
              >
                <Link href="/cases?new=1">
                  <Plus className="size-4" />
                  Register case
                </Link>
              </Button>
            ) : null}
            {canAddPayment ? (
              <Button
                asChild
                size="sm"
                variant="on-brand-solid"
                className="w-full shrink-0 sm:w-auto"
              >
                <Link href="/accounts?new=1">
                  <Plus className="size-4" />
                  Add payment
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
