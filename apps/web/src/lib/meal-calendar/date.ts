export function isCivilDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split("-").map(Number),x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d}
export function currentCivilDate(){const p=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=(t:string)=>p.find(x=>x.type===t)?.value??"";return `${get("year")}-${get("month")}-${get("day")}`}
export function monthOf(date:string){return date.slice(0,7)}
