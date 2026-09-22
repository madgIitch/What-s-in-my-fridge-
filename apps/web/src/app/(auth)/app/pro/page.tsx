import { ProPaywall } from "@/components/billing/ProPaywall";
export default async function ProPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) { const query = await searchParams; const checkout = query.checkout === "success" || query.checkout === "cancel" ? query.checkout : undefined; return <ProPaywall checkout={checkout}/>; }
