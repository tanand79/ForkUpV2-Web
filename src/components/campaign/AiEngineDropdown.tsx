"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AI_MODEL_OPTIONS,
  DEFAULT_AI_MODEL,
  getAiModel,
  loadAiSettingsFromServer,
  setAiModel,
  formatRunCost,
  type AiModelId,
  type AiModelVendor,
} from "@/lib/aiModelSetting";
import { headerPillClass } from "@/components/campaign/SiteHeader";
import { getAuthToken } from "@/lib/auth-storage";

const VENDORS: AiModelVendor[] = ["Anthropic", "Amazon"];

/**
 * Purpose: User-facing Bedrock model picker (Dermwrite-style AI Engine).
 * Inputs: none. Outputs: updates localStorage + server preference when signed in.
 */
export function AiEngineDropdown() {
  // SSR + first client paint must match — never read localStorage in useState init.
  const [model, setModel] = useState<AiModelId>(DEFAULT_AI_MODEL);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sync = () => setModel(getAiModel());
    window.addEventListener("ai-model-changed", sync);
    setModel(getAiModel());
    if (getAuthToken()) {
      void loadAiSettingsFromServer().finally(() => {
        if (!cancelled) {
          setModel(getAiModel());
          setReady(true);
        }
      });
    } else {
      setReady(true);
    }
    return () => {
      cancelled = true;
      window.removeEventListener("ai-model-changed", sync);
    };
  }, []);

  const current = AI_MODEL_OPTIONS.find((o) => o.id === model);
  const label = ready ? (current?.label ?? "AI Engine") : "AI Engine";

  const handleSelect = (id: AiModelId) => {
    setAiModel(id);
    setModel(id);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={headerPillClass}
          aria-label={ready ? `AI Engine: ${current?.label ?? "AI"}` : "AI Engine"}
          title={ready ? `AI Engine: ${current?.label ?? "AI"}` : "AI Engine"}
        >
          <Sparkles className="size-3.5 text-primary" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          AI Engine
        </DropdownMenuLabel>
        <p className="px-2 pb-2 text-[11px] text-muted-foreground">
          Your choice applies to receipt OCR, campaign drafts, and story AI.
        </p>
        <DropdownMenuSeparator />
        {VENDORS.map((vendor) => (
          <div key={vendor}>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground py-1">
              {vendor}
            </DropdownMenuLabel>
            {AI_MODEL_OPTIONS.filter((o) => o.vendor === vendor).map((opt) => {
              const active = opt.id === model;
              return (
                <DropdownMenuItem
                  key={opt.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleSelect(opt.id);
                  }}
                  className="flex items-start gap-2 py-2 cursor-pointer"
                >
                  <span className="w-4 mt-0.5">{active ? <Check className="size-3.5 text-primary" /> : null}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {formatRunCost(opt.inputPer1M, opt.outputPer1M)}/scan
                      </span>
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{opt.blurb}</span>
                  </span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AiEngineDropdown;
