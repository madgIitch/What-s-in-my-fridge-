export function productV3ApiEnabled(): boolean { return process.env.PRODUCT_V3 === "true"; }
export function productV3Unavailable(): Response { return Response.json({ code: "NOT_FOUND", message: "No encontrado" }, { status: 404 }); }
