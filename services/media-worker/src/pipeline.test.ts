import test from "node:test";import assert from "node:assert/strict";import{pipelineMetrics,processJob}from"./pipeline.js";import type{JobRepository}from"./repository.js";
const job={id:"00000000-0000-4000-8000-000000000001",sourceType:"manual" as const,manualText:"Tomates maduros aceite de oliva sal pimienta ajo cebolla albahaca. Lava y corta todos los tomates. Sofríe la cebolla y el ajo lentamente, añade tomates, sazona bien y cocina durante veinte minutos hasta que espese la salsa.",provenance:{sourceType:"manual"},attempts:1};
function repository(){const calls:string[]=[];return{calls,repo:{stage:async(_i:string,_w:string,s:string)=>{calls.push(s)},complete:async()=>{calls.push("completed")},fail:async()=>{}} as unknown as JobRepository}}
test("sufficient text skips Whisper and completes",async()=>{const{repo,calls}=repository();let transcriptions=0;const before=pipelineMetrics().whisperSkipped;await processJob(job,"worker",repo,{transcribe:async()=>{transcriptions++;return{text:"",provider:"test"}}},{extract:async()=>({schemaVersion:"recipe-v1",title:"Salsa de tomate",ingredients:[{name:"tomate"}],steps:["Cocinar"],source:{type:"manual"},provenance:{}})});assert.equal(transcriptions,0);assert.equal(pipelineMetrics().whisperSkipped,before+1);assert.deepEqual(calls,["extracting","validating","completed"])});
test("invalid structured output gets one repair then fails",async()=>{const{repo}=repository();let attempts=0;await assert.rejects(processJob(job,"worker",repo,{transcribe:async()=>({text:"",provider:"test"})},{extract:async()=>{attempts++;return{title:"sin schema"}}}),/RECIPE_SCHEMA_INVALID/);assert.equal(attempts,2)});

test("quality pipeline persists only sanitized recipe facts and review metadata", async () => {
  const previous = process.env.RECIPE_IMPORT_QUALITY_ENABLED;
  process.env.RECIPE_IMPORT_QUALITY_ENABLED = "true";
  let saved: unknown;
  const { repo } = repository();
  repo.complete = async (_id, _worker, result) => { saved = result; };
  try {
    await processJob(job, "worker", repo, { transcribe: async () => { throw new Error("Must skip ASR for this complete manual recipe"); } }, {
      extract: async (_text, context) => {
        assert.equal(context.evidence?.[0].kind, "manual");
        return { title: "Salsa", ingredients: [{ name: "Tomates", amount: "Por casa", evidenceIds: ["source-0"] }], steps: [{ text: "Corta los tomates.", evidenceIds: ["source-0"] }] };
      },
    });
    const recipe = saved as { ingredients: { name: string; amount?: string }[]; provenance: { quality: { status: string }; transcriptRetained: boolean } };
    assert.equal(recipe.ingredients[0].amount, undefined);
    assert.equal(recipe.provenance.quality.status, "review_required");
    assert.equal(recipe.provenance.transcriptRetained, false);
    assert.equal(JSON.stringify(recipe).includes("source-0"), false);
  } finally {
    if (previous === undefined) delete process.env.RECIPE_IMPORT_QUALITY_ENABLED;
    else process.env.RECIPE_IMPORT_QUALITY_ENABLED = previous;
  }
});
