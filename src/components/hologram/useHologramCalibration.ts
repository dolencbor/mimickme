"use client";

import { useCallback, useRef, useState } from "react";
import {
  DEFAULT_HOLOGRAM_CALIBRATION,
  readHologramCalibration,
  resetHologramCalibration,
  writeHologramCalibration,
  type HologramCalibration,
} from "@/lib/hologram/calibration";

export function useHologramCalibration() {
  const [calibration, setCalibration] = useState<HologramCalibration>(() => (
    typeof window === "undefined" ? DEFAULT_HOLOGRAM_CALIBRATION : readHologramCalibration()
  ));
  const valueRef = useRef<HologramCalibration>(calibration);

  const updateCalibration = useCallback((update: (current: HologramCalibration) => HologramCalibration) => {
    const next = update(valueRef.current);
    valueRef.current = next;
    setCalibration(next);
    writeHologramCalibration(next);
  }, []);

  const resetCalibration = useCallback(() => {
    const defaults = resetHologramCalibration();
    valueRef.current = defaults;
    setCalibration(defaults);
  }, []);

  return { calibration, updateCalibration, resetCalibration };
}
