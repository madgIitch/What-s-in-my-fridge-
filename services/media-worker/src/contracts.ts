export type SourceType="youtube"|"instagram"|"tiktok"|"blog"|"manual"|"file";
export type Job={id:string;sourceType:SourceType;sourceUrl?:string;manualText?:string;uploadObject?:string;provenance:Record<string,unknown>;attempts:number};
export type Recipe={schemaVersion:"recipe-v1";title:string;ingredients:Array<{name:string;amount?:string;unit?:string}>;steps:string[];source:{type:SourceType;url?:string};provenance:Record<string,unknown>};
export interface TranscriptionProvider{transcribe(audioPath:string):Promise<{text:string;provider:string}>}
export interface RecipeExtractionProvider{extract(text:string,context:{sourceType:SourceType;sourceUrl?:string;repair?:boolean}):Promise<unknown>}
export function validateRecipe(v:unknown):v is Recipe{if(!v||typeof v!=="object"||Array.isArray(v))return false;const x=v as Partial<Recipe>;return x.schemaVersion==="recipe-v1"&&typeof x.title==="string"&&x.title.trim().length>0&&x.title.length<=200&&Array.isArray(x.ingredients)&&x.ingredients.length>0&&x.ingredients.every(i=>i&&typeof i.name==="string"&&i.name.trim().length>0)&&Array.isArray(x.steps)&&x.steps.length>0&&x.steps.every(s=>typeof s==="string"&&s.trim().length>0)&&!!x.source&&!!x.provenance}
export function sufficientText(text:string){const clean=text.replace(/\s+/g," ").trim();return clean.length>=120&&clean.split(" ").length>=20}
