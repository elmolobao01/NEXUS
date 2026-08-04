import { existsSync, readFileSync } from "node:fs";

const required = [
  "package.json",
  "next.config.mjs",
  "vercel.json",
  "src/app/layout.jsx",
  "src/app/page.jsx",
  "src/app/globals.css",
  "src/app/api/health/route.js",
  "src/components/layout/nexus-shell.jsx",
  "src/design-system/temas/index.js"
];

const missing = required.filter((path) => !existsSync(path));
if (missing.length) {
  console.error("Estrutura inválida. Arquivos ausentes:", missing.join(", "));
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (!pkg.scripts?.build || !pkg.dependencies?.next) {
  console.error("package.json sem script de build ou dependência Next.js.");
  process.exit(1);
}

console.log("Estrutura NEXUS Foundation 1.1 validada com sucesso.");
