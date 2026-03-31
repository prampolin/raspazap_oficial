"use strict";

var major = parseInt(String(process.versions.node).split(".")[0], 10);

if (major < 18 || Number.isNaN(major)) {
  console.error(
    "[raspazap-oficial] Node.js 18 ou superior é necessário (Next.js 16).",
  );
  console.error("Versão detectada: " + process.version);
  console.error(
    "Ajuste o PATH ou use nvm/fnm: nvm install 20 && nvm use 20",
  );
  process.exit(1);
}
