"use client";

import { useEffect, useRef, type RefObject } from "react";
import { getHandCursor, type CursorHand } from "@/lib/tracking/handCursor";
import type { PoseFrame } from "@/lib/tracking/types";

type Props = {
  enabled: boolean;
  hand: CursorHand;
  poseFrameRef: RefObject<PoseFrame>;
};

export function HandCursorOverlay({ enabled, hand, poseFrameRef }: Props) {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrame = 0;
    const draw = () => {
      const element = cursorRef.current;
      if (element) {
        const cursor = getHandCursor(poseFrameRef.current, hand);
        element.hidden = !enabled || !cursor.visible;
        if (!element.hidden) {
          element.style.left = `${cursor.cursorX * 100}%`;
          element.style.top = `${cursor.cursorY * 100}%`;
          element.dataset.hand = cursor.hand;
        }
      }
      animationFrame = window.requestAnimationFrame(draw);
    };
    animationFrame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [enabled, hand, poseFrameRef]);

  return (
    <div className="hand-cursor-layer" aria-hidden="true">
      <div ref={cursorRef} className="hand-cursor" hidden />
    </div>
  );
}
