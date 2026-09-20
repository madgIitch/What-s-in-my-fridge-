import { describe,expect,it } from "vitest";
import { parseReceipt,validateConfirmLines,RECEIPT_PARSER_VERSION } from "./parser";
describe(RECEIPT_PARSER_VERSION,()=>{
 it("normalizes comma amounts and useful lines deterministically",()=>{const a=parseReceipt("MERCADO\n2 x TOMATE 3,50 €\nTOTAL 3,50 €");expect(a).toEqual(parseReceipt("MERCADO\n2 x TOMATE 3,50 €\nTOTAL 3,50 €"));expect(a.items[0]).toMatchObject({name:"TOMATE",quantity:"2",totalPrice:"3.50",accepted:true});expect(a.currency).toBe("EUR")});
 it("does not invent lines for empty OCR",()=>expect(parseReceipt(" \n")).toEqual({merchant:null,purchaseDate:null,currency:null,total:null,items:[],unrecognizedLines:[]}));
 it("preserves non-empty OCR with no useful line",()=>{const value=parseReceipt("GRACIAS\nCAJA");expect(value.items).toEqual([]);expect(value.unrecognizedLines).toEqual(["GRACIAS","CAJA"])});
 it("keeps ambiguous dates nullable",()=>expect(parseReceipt("TIENDA\n03/04/2026\nPAN 1,00 €").purchaseDate).toBeNull());
 it("rejects an invalid accepted line as one payload",()=>expect(()=>validateConfirmLines([{lineId:"1",accepted:true,name:" ",quantity:"1",unitPrice:null,totalPrice:null}])).toThrow("INVALID_LINES"));
});
