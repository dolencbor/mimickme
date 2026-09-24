import type { ModelConfiguration } from "@/lib/model/modelStorage";
import type { SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import type { TrackingState } from "@/lib/tracking/types";

export const TRACKING_CHANNEL_NAME = "fashion-hologram-tracking";
export const TRACKING_CHANNEL_VERSION = 2;

export type ChannelConnectionStatus = "unsupported" | "waiting" | "connected";

export type TrackingSnapshot = {
  type: "TRACKING_SNAPSHOT";
  version: typeof TRACKING_CHANNEL_VERSION;
  sentAt: number;
  trackingState: TrackingState;
  skeletalFrame: SkeletalFrame;
  model: ModelConfiguration;
  avatarVisible: boolean;
  garmentVisible: boolean;
};

export type HologramHello = {
  type: "HOLOGRAM_HELLO";
  version: typeof TRACKING_CHANNEL_VERSION;
  clientId: string;
  sentAt: number;
};

export type HologramGoodbye = {
  type: "HOLOGRAM_GOODBYE";
  version: typeof TRACKING_CHANNEL_VERSION;
  clientId: string;
};

export type TrackingChannelMessage = TrackingSnapshot | HologramHello | HologramGoodbye;

export function supportsTrackingChannel() {
  return typeof window !== "undefined" && "BroadcastChannel" in window;
}

export function isTrackingChannelMessage(value: unknown): value is TrackingChannelMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrackingChannelMessage>;
  return candidate.version === TRACKING_CHANNEL_VERSION && (
    candidate.type === "TRACKING_SNAPSHOT" ||
    candidate.type === "HOLOGRAM_HELLO" ||
    candidate.type === "HOLOGRAM_GOODBYE"
  );
}
