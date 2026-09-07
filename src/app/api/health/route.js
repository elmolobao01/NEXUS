export function GET() {
  return Response.json({
    status: "ok",
    application: "PLENIUM Foundation",
    version: "1.1.0"
  });
}
