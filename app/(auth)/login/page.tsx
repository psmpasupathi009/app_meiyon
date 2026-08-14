"use client";

import { LoginForm } from "@meiyon/auth";

export default function LoginPage() {
  return (
    <LoginForm
      title="Office Portal"
      subtitle="Sign in with your registered mobile number"
      enableOfficePicker
      disclaimer="MEIYON is practice-management software. PSM Softwares is not a law firm and does not solicit legal work (BCI Rule 36)."
    />
  );
}
