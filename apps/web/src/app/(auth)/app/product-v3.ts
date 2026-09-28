/** Server-only rollout switch. An unset flag keeps the existing product flow. */
export function productV3Enabled(): boolean {
  return process.env.PRODUCT_V3 === "true";
}
import "server-only";
