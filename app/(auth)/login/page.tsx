"use client";

import { LoginForm } from "@meiyon/auth";

export default function LoginPage() {
  return (
    <LoginForm
      title="Office Portal"
      subtitle="Sign in with your registered mobile number"
      enableOfficePicker
      demoHint="Demo: seeded admin mobile 8675762821 · PIN 123456"
    />
  );
}
