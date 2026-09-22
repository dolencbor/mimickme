import { TRACKING_CONFIG } from "@/config/tracking";
import { TrackingState } from "./types";

export type TrackingTransitionInput = {
  current: TrackingState;
  personDetected: boolean;
  now: number;
  lastPersonSeenAt: number | null;
};

export function nextTrackingState({ current, personDetected, now, lastPersonSeenAt }: TrackingTransitionInput) {
  if (personDetected) {
    return current === TrackingState.CALIBRATING ? TrackingState.CALIBRATING : TrackingState.TRACKING;
  }

  if (current === TrackingState.NO_PERSON) return TrackingState.NO_PERSON;
  if (lastPersonSeenAt === null) return TrackingState.NO_PERSON;

  const missingFor = now - lastPersonSeenAt;
  if (missingFor < TRACKING_CONFIG.lostTrackingTimeoutMs) return current;
  if (missingFor < TRACKING_CONFIG.noPersonTimeoutMs) return TrackingState.TRACKING_LOST;
  return TrackingState.NO_PERSON;
}
