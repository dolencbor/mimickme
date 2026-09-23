import { TRACKING_CONFIG } from "@/config/tracking";
import type { PoseFrame } from "./types";

export type CursorHand = "LEFT" | "RIGHT";

export type HandCursorData = {
  cursorX: number;
  cursorY: number;
  visible: boolean;
  hand: CursorHand;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function getHandCursor(frame: PoseFrame, hand: CursorHand): HandCursorData {
  const joint = frame.joints[hand === "LEFT" ? "leftWrist" : "rightWrist"];
  const visible = Boolean(
    frame.trackingActive &&
    joint &&
    joint.confidence >= TRACKING_CONFIG.handCursorConfidenceThreshold,
  );

  return {
    // The camera presentation is mirrored, so mirror only the cursor's display coordinate.
    cursorX: joint ? clamp01(1 - joint.image.x) : 0.5,
    cursorY: joint ? clamp01(joint.image.y) : 0.5,
    visible,
    hand,
  };
}
