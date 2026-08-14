export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { assertEnv } = await import("./lib/env");
  assertEnv();
}
