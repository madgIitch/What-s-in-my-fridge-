const required = (name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: string | undefined) => {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const getPublicSupabaseConfig = () => ({
  // Next.js only substitutes NEXT_PUBLIC_* references when their property names are static.
  url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  publishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
});
