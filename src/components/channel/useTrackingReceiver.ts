"use client";

import { useEffect, useRef, useState } from "react";
import {
  isTrackingChannelMessage,
  supportsTrackingChannel,
  TRACKING_CHANNEL_NAME,
  TRACKING_CHANNEL_VERSION,
  type ChannelConnectionStatus,
  type HologramGoodbye,
  type HologramHello,
} from "@/lib/channel/trackingChannel";
import {
  BUILT_IN_MODEL_CONFIG,
  getActiveModelConfiguration,
  type ModelConfiguration,
} from "@/lib/model/modelStorage";
import { EMPTY_SKELETAL_FRAME, type SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import { TrackingState } from "@/lib/tracking/types";

export function useTrackingReceiver() {
  const skeletalFrameRef = useRef<SkeletalFrame>({ ...EMPTY_SKELETAL_FRAME });
  const [status, setStatus] = useState<ChannelConnectionStatus>("waiting");
  const [trackingState, setTrackingState] = useState(TrackingState.NO_PERSON);
  const [model, setModel] = useState<ModelConfiguration>(BUILT_IN_MODEL_CONFIG);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [garmentVisible, setGarmentVisible] = useState(true);

  useEffect(() => {
    const cachedModel = getActiveModelConfiguration();
    const cachedModelFrame = window.requestAnimationFrame(() => setModel(cachedModel));
    if (!supportsTrackingChannel()) {
      const frame = window.requestAnimationFrame(() => setStatus("unsupported"));
      return () => {
        window.cancelAnimationFrame(cachedModelFrame);
        window.cancelAnimationFrame(frame);
      };
    }
    const channel = new BroadcastChannel(TRACKING_CHANNEL_NAME);
    const clientId = window.crypto.randomUUID();
    let lastSnapshotAt = 0;
    let currentStatus: ChannelConnectionStatus = "waiting";
    let currentTrackingState = TrackingState.NO_PERSON;
    let currentAvatarVisible = true;
    let currentGarmentVisible = true;
    let currentModel = cachedModel;
    const sayHello = () => {
      const message: HologramHello = {
        type: "HOLOGRAM_HELLO",
        version: TRACKING_CHANNEL_VERSION,
        clientId,
        sentAt: Date.now(),
      };
      channel.postMessage(message);
    };

    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isTrackingChannelMessage(event.data) || event.data.type !== "TRACKING_SNAPSHOT") return;
      lastSnapshotAt = Date.now();
      skeletalFrameRef.current = event.data.skeletalFrame;
      if (currentStatus !== "connected") {
        currentStatus = "connected";
        setStatus("connected");
      }
      if (currentTrackingState !== event.data.trackingState) {
        currentTrackingState = event.data.trackingState;
        setTrackingState(event.data.trackingState);
      }
      if (currentAvatarVisible !== event.data.avatarVisible) {
        currentAvatarVisible = event.data.avatarVisible;
        setAvatarVisible(event.data.avatarVisible);
      }
      if (currentGarmentVisible !== event.data.garmentVisible) {
        currentGarmentVisible = event.data.garmentVisible;
        setGarmentVisible(event.data.garmentVisible);
      }
      if (currentModel.id !== event.data.model.id || currentModel.kind !== event.data.model.kind) {
        currentModel = event.data.model;
        setModel(event.data.model);
      }
    };

    sayHello();
    const heartbeat = window.setInterval(() => {
      sayHello();
      if (lastSnapshotAt > 0 && Date.now() - lastSnapshotAt > 2_500) {
        skeletalFrameRef.current = { ...EMPTY_SKELETAL_FRAME };
        if (currentStatus !== "waiting") {
          currentStatus = "waiting";
          setStatus("waiting");
        }
        if (currentTrackingState !== TrackingState.NO_PERSON) {
          currentTrackingState = TrackingState.NO_PERSON;
          setTrackingState(TrackingState.NO_PERSON);
        }
      }
    }, 1_000);
    return () => {
      window.cancelAnimationFrame(cachedModelFrame);
      window.clearInterval(heartbeat);
      const goodbye: HologramGoodbye = {
        type: "HOLOGRAM_GOODBYE",
        version: TRACKING_CHANNEL_VERSION,
        clientId,
      };
      channel.postMessage(goodbye);
      channel.close();
    };
  }, []);

  return { skeletalFrameRef, status, trackingState, model, avatarVisible, garmentVisible };
}
