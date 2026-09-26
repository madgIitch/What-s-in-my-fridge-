export const RECEIPT_PARSER_VERSION="receipt-v1" as const;
export type ReceiptItem={lineId:string;rawText:string;name:string|null;quantity:string|null;unit:string|null;unitPrice:string|null;totalPrice:string|null;confidence:number|null;accepted:boolean};
export type ReceiptDraft={merchant:string|null;purchaseDate:string|null;currency:string|null;total:string|null;items:ReceiptItem[];unrecognizedLines:string[]};
const money=/(?:^|\s)(\d{1,7}(?:[.,]\d{1,2})?)\s*(€|eur|usd|gbp)?\s*$/i;
const productQuantity=/^(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:[xX×]\s*)?([\p{L}].+)$/u;
const nonProduct=/^(?:c\/|cl\.?\s|calle\b|av\.?\s|avenida\b|cif\b|nif\b|tel(?:efo(?:no)?)?\b|factura\b|ticket\b|caja\b|cajero\b|descripci[oó]n\b|p\.?\s*unit\b|imp\.?\s*\(?€|importe\b|precio\b|subtotal\b|iva\b|tax\b|descuento\b|discount\b|fecha\b|date\b|hora\b|base imponible\b|cuota\b|tarjeta\b|efectivo\b|cambio\b|gracias\b|cliente\b|www\.|https?:\/\/|s\.?a\.?\b)/i;
const dec=(value:string|undefined)=>{if(!value)return null;const n=value.replace(",",".");return /^\d+(?:\.\d{1,2})?$/.test(n)?n.replace(/^0+(?=\d)/,""):null};
function receiptDate(line:string,locale:string){const m=line.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);if(!m)return /^\d{4}-\d{2}-\d{2}$/.test(line.trim())?line.trim():null;const a=+m[1],b=+m[2];if(a<=12&&b<=12)return null;const day=locale.toLowerCase().startsWith("en-us")?b:a,month=locale.toLowerCase().startsWith("en-us")?a:b;return day>0&&day<=31&&month>0&&month<=12?`${m[3]}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`:null}
export function parseReceipt(text:string,locale="es-ES"):ReceiptDraft{
  const lines=text.replace(/\r\n?/g,"\n").split("\n").map(v=>v.trim()).filter(Boolean);
  const draft:ReceiptDraft={merchant:lines[0]??null,purchaseDate:null,currency:null,total:null,items:[],unrecognizedLines:[]};
  if(!lines.length)return draft;
  if(/(?:€|\bEUR\b)/i.test(text))draft.currency="EUR";
  else if(/(?:\$|\bUSD\b)/i.test(text))draft.currency="USD";
  else if(/(?:£|\bGBP\b)/i.test(text))draft.currency="GBP";
  let pendingIndex=-1;
  let pendingTotal=false;
  lines.forEach((line,index)=>{
    const date=receiptDate(line,locale);
    if(date){draft.purchaseDate??=date;pendingIndex=-1;return}
    const totalLine=line.match(/^total\b[^\d]*(\d+(?:[.,]\d{1,2})?)?/i);
    if(totalLine){draft.total=dec(totalLine[1]);pendingTotal=!draft.total;pendingIndex=-1;return}
    const amountMatch=line.match(money);
    const price=amountMatch&&(/[.,]/.test(amountMatch[1])||amountMatch[2])?dec(amountMatch[1]):null;
    if(pendingTotal&&price&&amountMatch?.index===0){draft.total=price;pendingTotal=false;return}
    pendingTotal=false;
    if(price&&amountMatch?.index===0){
      if(pendingIndex>=0&&index===pendingIndex+1){
        const item=draft.items.at(-1);
        if(item){item.totalPrice=price;item.rawText+=`\n${line}`}
      }else draft.unrecognizedLines.push(line);
      pendingIndex=-1;
      return;
    }
    if(index===0||nonProduct.test(line)){draft.unrecognizedLines.push(line);pendingIndex=-1;return}
    const body=price&&amountMatch?line.slice(0,amountMatch.index).trim():line;
    const quantityMatch=body.match(productQuantity);
    const name=(quantityMatch?.[2]??(price?body:null))?.trim()||null;
    const quantity=dec(quantityMatch?.[1]);
    if(!name||!/[\p{L}]{2}/u.test(name)||(!quantity&&!price)){
      draft.unrecognizedLines.push(line);pendingIndex=-1;return;
    }
    const noisy=/[\p{L}]{3,}\.[\p{L}]{2,}|[\p{L}]{2,}\d+[.,]\d+/u.test(name);
    draft.items.push({lineId:`line-${index+1}`,rawText:line,name,quantity:quantity??"1",unit:"unit",unitPrice:null,totalPrice:price,confidence:noisy?.45:price?.9:.75,accepted:!noisy});
    pendingIndex=price?-1:index;
  });
  if(!draft.items.length)draft.unrecognizedLines=lines;
  return draft;
}
export function validateConfirmLines(value:unknown):ReceiptItem[]{if(!Array.isArray(value))throw new Error("INVALID_LINES");return value.map(candidate=>{if(!candidate||typeof candidate!=="object")throw new Error("INVALID_LINES");const line=candidate as Partial<ReceiptItem>,valid=(v:unknown)=>v===null||(typeof v==="string"&&/^\d+(?:\.\d{1,2})?$/.test(v));if(typeof line.lineId!=="string"||typeof line.accepted!=="boolean")throw new Error("INVALID_LINES");if(line.accepted&&(typeof line.name!=="string"||!line.name.trim()||typeof line.quantity!=="string"||!/^\d+(?:\.\d+)?$/.test(line.quantity)||Number(line.quantity)<=0))throw new Error("INVALID_LINES");if(![line.unitPrice,line.totalPrice].every(valid))throw new Error("INVALID_LINES");return{lineId:line.lineId,rawText:typeof line.rawText==="string"?line.rawText:"",name:typeof line.name==="string"?line.name.trim():null,quantity:line.quantity??null,unit:typeof line.unit==="string"?line.unit.trim()||null:null,unitPrice:line.unitPrice??null,totalPrice:line.totalPrice??null,confidence:typeof line.confidence==="number"?line.confidence:null,accepted:line.accepted}})}
