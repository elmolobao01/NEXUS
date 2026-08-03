import { access } from "node:fs/promises";

const required = [
  "src/app/page.jsx",
  "src/app/layout.jsx",
  "src/app/globals.css",
  "src/components/layout/nexus-shell.jsx",
  "src/design-system/temas/index.js",
  "package.json",
  "next.config.mjs",
];

for (const file of required) {
  await access(file);
  console.log(`✓ ${file}`);
}
console.log("Estrutura NEXUS validada.");
