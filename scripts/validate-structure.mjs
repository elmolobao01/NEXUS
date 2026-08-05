import { existsSync } from "node:fs";

const required = [
  "src/app/layout.jsx",
  "src/app/page.jsx",
  "src/app/login/page.jsx",
  "src/app/admin/page.jsx",
  "src/app/portal/page.jsx",
  "src/components/auth/login-screen.jsx",
  "src/components/layout/nexus-shell.jsx",
  "src/components/client/client-portal-shell.jsx",
  "src/core/acessos/configuracao.js",
  "src/design-system/temas/index.js",
  "package.json",
  "next.config.mjs",
];

const missing = required.filter((path) => !existsSync(path));
if (missing.length) {
  console.error("Estrutura NEXUS incompleta:\n" + missing.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Estrutura NEXUS 1.3 validada com sucesso.");
