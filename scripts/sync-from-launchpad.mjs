import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const webSrc = path.join(webRoot, "src");
const launchpadSrc = path.join(webRoot, "..", "Campaign Launchpad (56)", "src");

const PRESERVE = new Set([
  path.join(webSrc, "lib", "utils.ts"),
  path.join(webSrc, "lib", "story.functions.ts"),
  path.join(webSrc, "lib", "api.ts"),
  path.join(webSrc, "components", "campaign", "CampaignApp.tsx"),
]);

const COPY_DIRS = ["components", "data", "hooks", "lib", "assets"];

function copyDir(srcDir, destDir, skipDirs = new Set()) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, skipDirs);
    } else if (!PRESERVE.has(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function ensureAssetSrcImport(content) {
  if (!content.includes('from "@/assets/') && !content.includes("from '@/assets/")) {
    return content;
  }
  if (content.includes("assetSrc")) return content;
  if (content.includes('@/lib/utils')) {
    return content.replace(
      /import \{([^}]*)\} from ["']@\/lib\/utils["'];/,
      (match, names) => {
        const parts = names.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.includes("assetSrc")) return match;
        return `import { ${[...parts, "assetSrc"].join(", ")} } from "@/lib/utils";`;
      },
    );
  }
  const importBlockEnd = content.match(/^import[\s\S]*?;\n/m);
  if (importBlockEnd) {
    const insertAt = importBlockEnd.index + importBlockEnd[0].length;
    return (
      content.slice(0, insertAt) +
      'import { assetSrc } from "@/lib/utils";\n' +
      content.slice(insertAt)
    );
  }
  return `import { assetSrc } from "@/lib/utils";\n${content}`;
}

function wrapAssetAssignments(content) {
  return content
    .replace(/(\bimage:\s*)(biz[A-Za-z]+)/g, "$1assetSrc($2)")
    .replace(/(\bimage:\s*)([a-z]+(?:Img)?)(,)/g, (match, prefix, name, suffix) => {
      if (name.startsWith("assetSrc") || name === "campaign") return match;
      if (/^(restaurant|animals|arts|foodbank|library|market|coffee|environment|seniors|sports)$/.test(name)) {
        return `${prefix}assetSrc(${name})${suffix}`;
      }
      if (/Img$/.test(name)) return `${prefix}assetSrc(${name})${suffix}`;
      return match;
    })
    .replace(/(\burl:\s*)(biz[A-Za-z]+)/g, "$1assetSrc($2)");
}

function wrapImgSrcStaticImports(content) {
  const staticImports = [...content.matchAll(/import (\w+) from ["']@\/assets\/[^"']+["'];?/g)].map((m) => m[1]);
  let result = content;
  for (const name of staticImports) {
    result = result.replace(
      new RegExp(`src=\\{${name}\\}`, "g"),
      `src={assetSrc(${name})}`,
    );
  }
  return result;
}

function fixDynamicImageSrc(content) {
  return content
    .replace(/src=\{coverImage\}/g, "src={assetSrc(coverImage)}")
    .replace(/src=\{heroImage\}/g, "src={assetSrc(heroImage)}")
    .replace(/src=\{heroCommunity\}/g, "src={assetSrc(heroCommunity)}");
}

function fixBrokenImportInsertion(content) {
  return content.replace(/^import \{\nimport \{ assetSrc \} from ["']@\/lib\/utils["'];\n/gm, "import {\n");
}

function fixCampaignDetails(content) {
  return content
    .replace(/import \{ useServerFn \} from "@tanstack\/react-start";\n/, "")
    .replace(/const callImproveStory = useServerFn\(improveStory\);/, "const callImproveStory = improveStory;")
    .replace(
      /await callImproveStory\(\{ data: \{ story: original \} \}\)/,
      "await callImproveStory({ story: original })",
    );
}

function fixCampaignContext(content) {
  let result = wrapAssetAssignments(content);
  if (!result.includes("initialStep")) {
    result = result.replace(
      /export function CampaignProvider\(\{ children \}: \{ children: ReactNode \}\) \{\s*\n\s*const \[step, setStep\] = useState<StepId>\("start"\);/,
      `export function CampaignProvider({
  children,
  initialStep = "website-landing",
}: {
  children: ReactNode;
  initialStep?: StepId;
}) {
  const [step, setStep] = useState<StepId>(initialStep);`,
    );
  }
  return result;
}

function fixWizardHeader(content) {
  if (content.includes('if (step === "website-landing")')) return content;
  return content.replace(
    /(\n\n)(  \/\/ The Start screen is a welcoming entry point)/,
    `$1  if (step === "website-landing") {
    return null;
  }
$2`,
  );
}

function fixCampaignDisplay(content) {
  content = ensureAssetSrcImport(content);
  return content.replace(/image: bizFallback,/g, "image: assetSrc(bizFallback),");
}

function transformFile(filePath, content) {
  const rel = path.relative(webSrc, filePath).replace(/\\/g, "/");
  let result = content;

  if (rel === "components/campaign/CampaignDetails.tsx") {
    result = fixCampaignDetails(result);
  }

  if (rel === "lib/campaign-context.tsx") {
    result = ensureAssetSrcImport(result);
    result = fixCampaignContext(result);
  }

  if (rel === "lib/campaign-display.ts") {
    result = fixCampaignDisplay(result);
  }

  if (rel === "components/campaign/WizardHeader.tsx") {
    result = fixWizardHeader(result);
  }

  if (rel.startsWith("data/") || rel.startsWith("components/")) {
    if (result.includes('from "@/assets/')) {
      result = ensureAssetSrcImport(result);
      result = wrapAssetAssignments(result);
      result = wrapImgSrcStaticImports(result);
      result = fixDynamicImageSrc(result);
    }
  }

  result = fixBrokenImportInsertion(result);

  return result;
}

console.log("Syncing from:", launchpadSrc);
console.log("Into:", webSrc);

for (const dir of COPY_DIRS) {
  const skip = dir === "lib" ? new Set(["api"]) : new Set();
  copyDir(path.join(launchpadSrc, dir), path.join(webSrc, dir), skip);
}

const duplicateAssets = path.join(webSrc, "assets", "assets");
if (fs.existsSync(duplicateAssets)) {
  fs.rmSync(duplicateAssets, { recursive: true, force: true });
  console.log("Removed duplicate assets/assets folder");
}

const tanstackApiExample = path.join(webSrc, "lib", "api", "example.functions.ts");
if (fs.existsSync(tanstackApiExample)) {
  fs.rmSync(tanstackApiExample, { force: true });
  console.log("Removed TanStack-only lib/api/example.functions.ts");
}

for (const file of walkFiles(webSrc)) {
  if (PRESERVE.has(file)) continue;
  if (file.includes(`${path.sep}app${path.sep}`)) continue;
  const original = fs.readFileSync(file, "utf8");
  const transformed = transformFile(file, original);
  if (transformed !== original) {
    fs.writeFileSync(file, transformed, "utf8");
  }
}

console.log("Sync complete.");
