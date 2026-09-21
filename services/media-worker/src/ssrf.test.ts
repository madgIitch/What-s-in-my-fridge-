import test from"node:test";import assert from"node:assert/strict";import{assertPublicUrl}from"./ssrf.js";
const resolver=(address:string)=>Promise.resolve([{address:address.includes("evil")?"127.0.0.1":"93.184.216.34",family:4}]) as never;
for(const url of["http://localhost/x","http://127.0.0.1/x","http://10.0.0.1/x","http://172.16.1.1/x","http://192.168.1.1/x","http://169.254.169.254/latest","http://metadata.google.internal/"])test(`blocks ${url}`,async()=>assert.rejects(assertPublicUrl(url,resolver)));
test("blocks observable DNS rebinding result",async()=>assert.rejects(assertPublicUrl("https://evil.example/x",resolver)));test("allows public resolution",async()=>assert.equal((await assertPublicUrl("https://example.com/x",resolver)).hostname,"example.com"));
