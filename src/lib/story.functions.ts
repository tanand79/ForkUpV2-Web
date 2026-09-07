import { getApiBaseUrl } from "@/lib/api-config";
import { authHeaders } from "@/lib/auth-storage";
import { getAiModel } from "@/lib/aiModelSetting";

export async function improveStory(data: { story: string }): Promise<{ improved: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/improve-story`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ...data, modelId: getAiModel() }),
  });

  const body = (await res.json().catch(() => ({}))) as { improved?: string; error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? "Could not improve the story. Please try again.");
  }

  if (!body.improved) {
    throw new Error("Could not improve the story. Please try again.");
  }

  return { improved: body.improved };
}
