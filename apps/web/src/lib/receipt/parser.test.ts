import { describe,expect,it } from "vitest";
import { parseReceipt,validateConfirmLines,RECEIPT_PARSER_VERSION } from "./parser";
describe(RECEIPT_PARSER_VERSION,()=>{
 it("normalizes comma amounts and useful lines deterministically",()=>{const a=parseReceipt("MERCADO\n2 x TOMATE 3,50 €\nTOTAL 3,50 €");expect(a).toEqual(parseReceipt("MERCADO\n2 x TOMATE 3,50 €\nTOTAL 3,50 €"));expect(a.items[0]).toMatchObject({name:"TOMATE",quantity:"2",totalPrice:"3.50",accepted:true});expect(a.currency).toBe("EUR")});
 it("does not invent lines for empty OCR",()=>expect(parseReceipt(" \n")).toEqual({merchant:null,purchaseDate:null,currency:null,total:null,items:[],unrecognizedLines:[]}));
 it("preserves non-empty OCR with no useful line",()=>{const value=parseReceipt("GRACIAS\nCAJA");expect(value.items).toEqual([]);expect(value.unrecognizedLines).toEqual(["GRACIAS","CAJA"])});
 it("keeps ambiguous dates nullable",()=>expect(parseReceipt("TIENDA\n03/04/2026\nPAN 1,00 €").purchaseDate).toBeNull());
 it("recovers products when Vision puts prices on the next line and ignores receipt headers",()=>{
   const draft=parseReceipt("MERCADO EJEMPLO\nCL MAYOR, 3\nTELEFONO: 910000000\nDescripción P. Unit Imp.(€)\n1 COUS COUS\n1,95\n1 TOMATE TRITURADO\n0,55\n1 PEPINO HOLANDES\n1 CEBOLLA TUBO\n1,06\n2 PISTO DE VERDURAS\nTOTAL\n4,56");
   expect(draft.items.map(item=>({name:item.name,quantity:item.quantity,price:item.totalPrice}))).toEqual([
     {name:"COUS COUS",quantity:"1",price:"1.95"},
     {name:"TOMATE TRITURADO",quantity:"1",price:"0.55"},
     {name:"PEPINO HOLANDES",quantity:"1",price:null},
     {name:"CEBOLLA TUBO",quantity:"1",price:"1.06"},
     {name:"PISTO DE VERDURAS",quantity:"2",price:null},
   ]);
   expect(draft.total).toBe("4.56");
   expect(draft.unrecognizedLines).toContain("CL MAYOR, 3");
 });
 it("does not turn isolated numbers or price calculations into articles",()=>{
   const draft=parseReceipt("MERCADO\n2,10 x 4,20\n1.49 2\nCAJA 2\n2 x TOMATE 3,50 €");
   expect(draft.items).toHaveLength(1);
   expect(draft.items[0]).toMatchObject({name:"TOMATE",quantity:"2",totalPrice:"3.50"});
 });
 it("keeps ordinary products starting with C",()=>{
   expect(parseReceipt("MERCADO\nCHOCOLATE 2,50").items[0]).toMatchObject({name:"CHOCOLATE",totalPrice:"2.50"});
 });
 it("flags OCR-corrupted names for review instead of accepting them",()=>{
   const draft=parseReceipt("MERCADO\n1 PECHUGA 2 UNDqqsats.nu astidio 4,84\n16 HUEVOS CAMPEROS 1,95");
   expect(draft.items[0]).toMatchObject({quantity:"1",totalPrice:"4.84",accepted:false});
   expect(draft.items[1]).toMatchObject({name:"HUEVOS CAMPEROS",quantity:"16",totalPrice:"1.95",accepted:true});
 });
 it("rejects an invalid accepted line as one payload",()=>expect(()=>validateConfirmLines([{lineId:"1",accepted:true,name:" ",quantity:"1",unitPrice:null,totalPrice:null}])).toThrow("INVALID_LINES"));
});
