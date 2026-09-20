import { describe,expect,it } from "vitest";
import { detectReceiptImage,MAX_RECEIPT_IMAGE_BYTES,validateReceiptImage } from "./image";
function png(){const b=new Uint8Array(24);b.set([0x89,0x50,0x4e,0x47],0);b.set([0x49,0x48,0x44,0x52],12);b[19]=1;b[23]=1;return b}
describe("receipt image boundary",()=>{
 it("is fixed at 10 MiB",()=>expect(MAX_RECEIPT_IMAGE_BYTES).toBe(10*1024*1024));
 it("detects a PNG signature and dimensions",()=>expect(validateReceiptImage(png(),"image/png")).toBe("image/png"));
 it("rejects renamed and corrupt content",()=>{expect(()=>validateReceiptImage(png(),"image/jpeg")).toThrow("INVALID_IMAGE");expect(detectReceiptImage(new Uint8Array([1,2,3]))).toBeNull()});
 it("rejects oversized bytes",()=>expect(()=>validateReceiptImage(new Uint8Array(MAX_RECEIPT_IMAGE_BYTES+1),"image/png")).toThrow("IMAGE_TOO_LARGE"));
});
