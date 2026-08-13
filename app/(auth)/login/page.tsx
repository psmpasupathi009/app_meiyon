"use client";

import { LoginForm } from "@meiyon/auth";

export default function LoginPage() {
  return (
    <LoginForm
      title="Office Portal"
      subtitle="Sign in with your registered mobile number"
      enableOfficePicker
    />
  );
}
