/**
 * Stop stale Next.js on port 3000, clear .next cache, restart dev server.
 * Fixes "Internal Server Error" and 404s on main-app.js / layout.css from corrupted dev sessions.
 */
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const port = 3000;

function killPortWin(portNum) {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${portNum} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { stdio: "pipe" },
    );
  } catch {
    /* no listener */
  }
}

function killPort(portNum) {
  if (process.platform === "win32") {
    killPortWin(portNum);
  }
  try {
    execSync(`npx --yes kill-port ${portNum}`, { cwd: webRoot, stdio: "inherit" });
  } catch {
    console.warn(`Could not free port ${portNum} via kill-port — trying again on Windows…`);
    if (process.platform === "win32") killPortWin(portNum);
  }
}

killPort(port);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await sleep(1500);

  const nextDir = path.join(webRoot, ".next");
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("Removed .next cache");
  }

  const cacheDir = path.join(webRoot, "node_modules", ".cache");
  if (fs.existsSync(cacheDir)) {
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log("Removed node_modules/.cache");
    } catch {
      /* ignore */
    }
  }

  console.log(`Starting next dev on http://localhost:${port} …`);
  console.log("Tip: run the API too — from repo root: npm run dev:api");

  const child = spawn("npx", ["next", "dev", "--port", String(port)], {
    cwd: webRoot,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
