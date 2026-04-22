export function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getOptionalEnv(name: string): string | null {
  return Deno.env.get(name) || null;
}
