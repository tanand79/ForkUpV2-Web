export const STORY_MIN_WORDS = 12;
export const STORY_MIN_CHARS = 75;

export function storyRequirementMet(description: string): boolean {
  const storyText = description.trim();
  if (!storyText) return false;
  const storyWords = storyText.split(/\s+/).filter(Boolean).length;
  return storyWords >= STORY_MIN_WORDS || storyText.length >= STORY_MIN_CHARS;
}

export function storyWordCount(description: string): number {
  return description.trim().split(/\s+/).filter(Boolean).length;
}
