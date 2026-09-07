/**
 * Bedrock model selection for ForkUp AI (receipt OCR, drafts, story) — user-facing.
 * Mirrors Dermwrite aiModelSetting: localStorage + optional server sync when signed in.
 */

export type AiModelId =
  | "amazon.nova-micro-v1:0"
  | "amazon.nova-lite-v1:0"
  | "amazon.nova-pro-v1:0"
  | "anthropic.claude-haiku-4-5-20251001-v1:0"
  | "anthropic.claude-sonnet-4-5-20250929-v1:0"
  | "anthropic.claude-sonnet-4-6";

export type AiModelVendor = "Amazon" | "Anthropic";

export type AiModelOption = {
  id: AiModelId;
  label: string;
  vendor: AiModelVendor;
  tier: string;
  blurb: string;
  inputPer1M: number;
  outputPer1M: number;
};

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: "amazon.nova-micro-v1:0",
    label: "Nova Micro",
    vendor: "Amazon",
    tier: "Lite",
    blurb: "Fastest & lowest cost",
    inputPer1M: 0.035,
    outputPer1M: 0.14,
  },
  {
    id: "amazon.nova-lite-v1:0",
    label: "Nova Lite",
    vendor: "Amazon",
    tier: "Balanced",
    blurb: "Fast & balanced — good for receipts",
    inputPer1M: 0.06,
    outputPer1M: 0.24,
  },
  {
    id: "amazon.nova-pro-v1:0",
    label: "Nova Pro",
    vendor: "Amazon",
    tier: "Pro",
    blurb: "Deeper reasoning on Bedrock",
    inputPer1M: 0.8,
    outputPer1M: 3.2,
  },
  {
    id: "anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5",
    vendor: "Anthropic",
    tier: "Lite",
    blurb: "Fast Claude responses",
    inputPer1M: 1.0,
    outputPer1M: 5.0,
  },
  {
    id: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    label: "Claude Sonnet 4.5",
    vendor: "Anthropic",
    tier: "Balanced",
    blurb: "Balanced Claude reasoning",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  {
    id: "anthropic.claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    vendor: "Anthropic",
    tier: "Pro",
    blurb: "Best receipt & draft quality",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
];

export const DEFAULT_AI_MODEL: AiModelId = "amazon.nova-lite-v1:0";

const STORAGE_KEY = "forkup.aiModel";

export function migrateAiModelId(stored: string | null | undefined): AiModelId {
  const trimmed = String(stored ?? "").trim();
  if (!trimmed) return DEFAULT_AI_MODEL;
  if (AI_MODEL_OPTIONS.some((o) => o.id === trimmed)) return trimmed as AiModelId;
  return DEFAULT_AI_MODEL;
}

export function getAiModel(): AiModelId {
  if (typeof window === "undefined") return DEFAULT_AI_MODEL;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const resolved = migrateAiModelId(stored);
  if (stored !== resolved) {
    window.localStorage.setItem(STORAGE_KEY, resolved);
  }
  return resolved;
}

export function setAiModel(id: AiModelId, options?: { skipServerSync?: boolean }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent("ai-model-changed", { detail: { id } }));
  if (!options?.skipServerSync) {
    void import("@/lib/api")
      .then(({ saveUserAiSettings }) => saveUserAiSettings(id))
      .catch(() => undefined);
  }
}

export function applyServerAiSettings(settings: { modelId: string }) {
  const modelId = migrateAiModelId(settings.modelId);
  setAiModel(modelId, { skipServerSync: true });
  return modelId;
}

export async function loadAiSettingsFromServer(): Promise<boolean> {
  try {
    const { fetchUserAiSettings } = await import("@/lib/api");
    const settings = await fetchUserAiSettings();
    applyServerAiSettings(settings);
    return true;
  } catch {
    return false;
  }
}

export const formatRunCost = (inputPer1M: number, outputPer1M: number, inTok = 2000, outTok = 500) => {
  const cost = (inputPer1M * inTok + outputPer1M * outTok) / 1_000_000;
  return cost < 0.01 ? "< $0.01" : `~$${cost.toFixed(cost < 0.1 ? 3 : 2)}`;
};
