"use client";

/**
 * Featured YouTube embed for the public campaign hero (additive).
 *
 * Purpose: Play a featured watch/Shorts video muted with autoplay when the
 * slide is active; YouTube chrome lets the visitor unmute / play / pause.
 * Notifies the parent when playback ends so the carousel can advance.
 *
 * Inputs:
 *   videoId — 11-char YouTube id
 *   title — iframe accessible title
 *   active — whether this slide is currently selected
 *   onEnded — called once when the player reports ended (state 0)
 *
 * Outputs: iframe UI only (no API calls)
 */
import { useEffect, useId, useRef } from "react";

export interface FeaturedYoutubeEmbedProps {
  videoId: string;
  title: string;
  active: boolean;
  onEnded?: () => void;
  className?: string;
}

/**
 * Renders a YouTube iframe with enablejsapi for ended detection.
 * Inputs: FeaturedYoutubeEmbedProps
 * Outputs: JSX embed frame
 */
export function FeaturedYoutubeEmbed({
  videoId,
  title,
  active,
  onEnded,
  className,
}: FeaturedYoutubeEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerId = useId().replace(/:/g, "");
  const endedFiredRef = useRef(false);

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
    videoId,
  )}?enablejsapi=1&autoplay=${active ? 1 : 0}&mute=1&playsinline=1&rel=0&modestbranding=1&origin=${
    typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""
  }`;

  useEffect(() => {
    endedFiredRef.current = false;
  }, [videoId, active]);

  useEffect(() => {
    /**
     * Subscribe to YouTube iframe API postMessage events.
     * Inputs: MessageEvent from youtube.com / youtube-nocookie.com
     * Outputs: calls onEnded when playerState === 0 (ended)
     */
    const onMessage = (event: MessageEvent) => {
      if (
        typeof event.origin !== "string" ||
        (!event.origin.includes("youtube.com") &&
          !event.origin.includes("youtube-nocookie.com"))
      ) {
        return;
      }
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const payload = data as {
        event?: string;
        info?: number | { playerState?: number };
        id?: string;
      };
      if (payload.id && payload.id !== playerId) return;

      let playerState: number | undefined;
      if (typeof payload.info === "number") {
        playerState = payload.info;
      } else if (payload.info && typeof payload.info === "object") {
        playerState = payload.info.playerState;
      }

      // 0 = ended (YT.PlayerState.ENDED)
      if (
        (payload.event === "onStateChange" || playerState !== undefined) &&
        playerState === 0 &&
        active &&
        !endedFiredRef.current
      ) {
        endedFiredRef.current = true;
        onEnded?.();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [active, onEnded, playerId]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    /**
     * Tell the YouTube player we want API events.
     * Inputs: none. Outputs: postMessage to iframe.
     */
    const listen = () => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: playerId }),
          "*",
        );
      } catch {
        /* ignore cross-origin race */
      }
    };

    listen();
    const t = window.setInterval(listen, 1000);
    return () => window.clearInterval(t);
  }, [playerId, src]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: active ? "playVideo" : "pauseVideo",
          args: [],
          id: playerId,
        }),
        "*",
      );
    } catch {
      /* ignore */
    }
  }, [active, playerId]);

  return (
    <div className={className ?? "mx-auto aspect-[16/10] w-full bg-black"}>
      <iframe
        key={`${videoId}-${active ? "on" : "off"}`}
        ref={iframeRef}
        title={title}
        src={src}
        className="size-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
