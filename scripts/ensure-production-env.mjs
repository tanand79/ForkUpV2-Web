import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(root, "..");
const target = path.join(webRoot, ".env.production");
const source = path.join(webRoot, "_env.production");

if (!fs.existsSync(target) && fs.existsSync(source)) {
  fs.copyFileSync(source, target);
  console.log("Created web/.env.production from _env.production");
}
