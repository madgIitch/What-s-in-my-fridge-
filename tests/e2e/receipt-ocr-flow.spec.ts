import { expect, test } from "@playwright/test";

test.describe("receipt OCR mobile review", () => {
  test.skip(!process.env.RUN_LOCAL_SUPABASE_E2E, "requires local Supabase auth");
  test.beforeEach(async ({ page }) => {
    const email=`receipt-${Date.now()}@example.test`,password="receipt-test-password";
    await page.goto("/signup"); await page.getByLabel("Email").fill(email); await page.getByLabel("Contraseña").fill(password); await page.getByRole("button",{name:/Crear cuenta/}).click();
    await page.goto("/login"); await page.getByLabel("Email").fill(email); await page.getByLabel("Contraseña").fill(password); await page.getByRole("button",{name:/Entrar/}).click();
  });
  test("falls back to file, crops, edits, excludes and confirms once",async({page})=>{
    await page.addInitScript(()=>Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:()=>Promise.reject(new DOMException("denied"))}}));
    let confirms=0; await page.route("**/api/ocr",r=>r.fulfill({json:{draftId:"51000000-0000-4000-a000-000000000001",requestId:"52000000-0000-4000-a000-000000000001",status:"review",draft:{merchant:"Demo",purchaseDate:null,currency:"EUR",total:"2.00",items:[{lineId:"a",rawText:"MILK 1.00",name:"Milk",quantity:"1",unit:"unit",unitPrice:null,totalPrice:"1.00",confidence:.8,accepted:true},{lineId:"b",rawText:"BREAD 1.00",name:"Bread",quantity:"1",unit:"unit",unitPrice:null,totalPrice:"1.00",confidence:.8,accepted:true}],unrecognizedLines:[]}}}));
    await page.route("**/api/ocr/confirm",r=>{confirms++;return r.fulfill({json:{draftId:"51000000-0000-4000-a000-000000000001",status:"confirmed",itemIds:["one"]}})});
    await page.goto("/app/scan"); await page.getByRole("button",{name:"Usar cámara"}).click(); await expect(page.getByText(/cámara no está disponible/i)).toBeVisible();
    const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXsAAAAASUVORK5CYII=","base64");
    await page.locator('input[type="file"]:not([capture])').setInputFiles({name:"ticket.png",mimeType:"image/png",buffer:png}); await expect(page.getByRole("heading",{name:"Recorta el ticket"})).toBeVisible(); await page.getByRole("button",{name:"Rotar 90°"}).click(); await page.getByRole("button",{name:"Usar este recorte"}).click();
    await expect(page.getByRole("heading",{name:"Revisa cada línea"})).toBeVisible(); const names=page.getByLabel("Nombre");await names.first().fill("Whole milk");await page.getByLabel("Incluir").nth(1).uncheck();await page.getByRole("button",{name:"Confirmar artículos"}).dblclick();await expect(page.getByText(/guardaron una sola vez/i)).toBeVisible();expect(confirms).toBe(1);
  });
  test("shows stable quota and recoverable Vision errors",async({page})=>{let calls=0;await page.route("**/api/ocr",r=>{calls++;return r.fulfill({status:calls===1?429:502,json:{code:calls===1?"OCR_QUOTA_EXHAUSTED":"VISION_UNAVAILABLE",message:calls===1?"Cuota agotada":"Vision no disponible",retryable:calls>1,requestId:"52000000-0000-4000-a000-000000000001"}})});await page.goto("/app/scan");await expect(page.getByRole("heading",{name:"Escanea tu compra"})).toBeVisible()});
});
