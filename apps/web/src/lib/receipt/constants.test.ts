import { expect,it } from "vitest";
import { receiptObjectPath,SIGNED_RECEIPT_URL_TTL_SECONDS } from "./constants";
it("derives a private object path and fixed signed URL TTL",()=>{expect(receiptObjectPath("user","draft","image/webp")).toBe("user/draft/original.webp");expect(SIGNED_RECEIPT_URL_TTL_SECONDS).toBe(60)});
