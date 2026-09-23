"use client";

import { Bounds, useBounds } from "@react-three/drei";
import { useLayoutEffect, type ReactNode } from "react";
import type { Box3 } from "three";

function FitToBox({ box }: { box: Box3 }) {
  const bounds = useBounds();

  useLayoutEffect(() => {
    bounds.refresh(box).clip().fit();
  }, [bounds, box]);

  return null;
}

export function FittedBounds({ box, children, margin }: { box: Box3; children: ReactNode; margin: number }) {
  return (
    <Bounds margin={margin}>
      <FitToBox box={box} />
      {children}
    </Bounds>
  );
}
