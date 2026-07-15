const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function improveStory(data: { story: string }): Promise<{ improved: string }> {
  const res = await fetch(`${apiBase}/api/improve-story`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
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

