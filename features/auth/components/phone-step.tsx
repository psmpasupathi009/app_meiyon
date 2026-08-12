"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PhoneStepProps = {
  mobile: string;
  loading: boolean;
  error?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function PhoneStep({
  mobile,
  loading,
  error,
  onChange,
  onSubmit,
}: PhoneStepProps) {
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label
          htmlFor="mobile"
          className="text-[0.8125rem] font-medium tracking-wide text-foreground"
        >
          Phone number
        </Label>
        <div className="flex h-12 overflow-hidden rounded-md border border-input bg-card transition-[border-color,box-shadow] focus-within:border-navy focus-within:ring-1 focus-within:ring-navy/25">
          <span className="flex items-center border-r border-input bg-muted px-3.5 text-sm text-muted-foreground select-none">
            +91
          </span>
          <Input
            id="mobile"
            inputMode="numeric"
            autoComplete="tel"
            autoFocus
            placeholder="Enter phone number"
            maxLength={10}
            value={mobile}
            onChange={(event) =>
              onChange(event.target.value.replace(/\D/g, "").slice(0, 10))
            }
            className="h-full border-0 bg-transparent text-[0.9375rem] text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="h-12 w-full text-[0.9375rem] font-medium tracking-wide"
        disabled={loading || mobile.length !== 10 || !/^[6-9]/.test(mobile)}
      >
        {loading ? "Please wait…" : "Continue"}
      </Button>
    </form>
  );
}
