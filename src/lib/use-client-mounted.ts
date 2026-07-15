"use client";

import { useEffect, useState } from "react";

/** True after the first client paint — use to gate browser-only state (localStorage, etc.). */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
