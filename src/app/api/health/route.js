export function GET() {
  return Response.json({
    status: "ok",
    application: "NEXUS Foundation",
    version: "1.1.0"
  });
}
