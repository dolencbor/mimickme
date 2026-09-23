"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ModelConfiguration } from "@/lib/model/modelStorage";
import {
  isTrackingChannelMessage,
  supportsTrackingChannel,
  TRACKING_CHANNEL_NAME,
  TRACKING_CHANNEL_VERSION,
  type ChannelConnectionStatus,
  type TrackingSnapshot,
} from "@/lib/channel/trackingChannel";
import type { SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import type { TrackingState } from "@/lib/tracking/types";

type Props = {
  skeletalFrameRef: RefObject<SkeletalFrame>;
  trackingState: TrackingState;
  model: ModelConfiguration;
  avatarVisible: boolean;
};

export function useTrackingTransmitter({ skeletalFrameRef, trackingState, model, avatarVisible }: Props) {
  const [status, setStatus] = useState<ChannelConnectionStatus>("waiting");
  const stateRef = useRef({ trackingState, model, avatarVisible });

  useEffect(() => {
    stateRef.current = { trackingState, model, avatarVisible };
  }, [avatarVisible, model, trackingState]);

  useEffect(() => {
    if (!supportsTrackingChannel()) {
      const frame = window.requestAnimationFrame(() => setStatus("unsupported"));
      return () => window.cancelAnimationFrame(frame);
    }
    const channel = new BroadcastChannel(TRACKING_CHANNEL_NAME);
    const clients = new Map<string, number>();
    let animationFrame = 0;
    let lastFrameTimestamp = -1;
    let lastSentAt = 0;
    let currentStatus: ChannelConnectionStatus = "waiting";

    const updateStatus = () => {
      const nextStatus = clients.size > 0 ? "connected" : "waiting";
      if (nextStatus !== currentStatus) {
        currentStatus = nextStatus;
        setStatus(nextStatus);
      }
    };
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isTrackingChannelMessage(event.data)) return;
      if (event.data.type === "HOLOGRAM_HELLO") {
        clients.set(event.data.clientId, Date.now());
        updateStatus();
      } else if (event.data.type === "HOLOGRAM_GOODBYE") {
        clients.delete(event.data.clientId);
        updateStatus();
      }
    };

    const broadcast = (now: number) => {
      for (const [clientId, seenAt] of clients) {
        if (Date.now() - seenAt > 3_000) clients.delete(clientId);
      }
      const frame = skeletalFrameRef.current;
      const frameChanged = frame.timestamp !== lastFrameTimestamp;
      if (clients.size > 0 && (frameChanged || now - lastSentAt >= 500)) {
        const current = stateRef.current;
        const snapshot: TrackingSnapshot = {
          type: "TRACKING_SNAPSHOT",
          version: TRACKING_CHANNEL_VERSION,
          sentAt: Date.now(),
          trackingState: current.trackingState,
          skeletalFrame: frame,
          model: current.model,
          avatarVisible: current.avatarVisible,
        };
        channel.postMessage(snapshot);
        lastFrameTimestamp = frame.timestamp;
        lastSentAt = now;
      }
      updateStatus();
      animationFrame = window.requestAnimationFrame(broadcast);
    };
    animationFrame = window.requestAnimationFrame(broadcast);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      channel.close();
    };
  }, [skeletalFrameRef]);

  return status;
}
