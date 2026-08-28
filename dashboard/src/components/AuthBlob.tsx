"use client";

import type { CSSProperties } from "react";
import { JellyBlobMascot, type JellyBlobMood } from "feral-blob";
import type { BlobSkin } from "@/lib/blob-skins";

export type BlobMood =
  | "idle"
  | "focused"
  | "thinking"
  | "concerned"
  | "success"
  | "goodbye";

const FERAL_MOODS: Record<BlobMood, JellyBlobMood> = {
  idle: "neutral",
  focused: "neutral",
  thinking: "hmm",
  concerned: "sad",
  success: "happy",
  goodbye: "happy",
};

type JellySkinProperties = CSSProperties & {
  [key: `--jelly-${string}`]: string;
};

const SKIN_STYLES: Record<BlobSkin, JellySkinProperties> = {
  violet: {
    "--jelly-body-top": "#ecb8ff",
    "--jelly-body-mid": "#c57af3",
    "--jelly-body-deep": "#a662e8",
    "--jelly-body-rim": "#d292fb",
    "--jelly-outline": "#8d52de",
    "--jelly-outline-light": "#b66af0",
    "--jelly-arm-light": "#e1a8ff",
    "--jelly-arm-mid": "#bc78ed",
    "--jelly-arm-deep": "#9c5de2",
    "--jelly-belly-glow": "#ffb2dc",
    "--jelly-eye-sparkle": "#b471e6",
  },
  blue: {
    "--jelly-body-top": "#b9e3ff",
    "--jelly-body-mid": "#55a9ef",
    "--jelly-body-deep": "#3489d2",
    "--jelly-body-rim": "#79c4f7",
    "--jelly-outline": "#2672b8",
    "--jelly-outline-light": "#4198dc",
    "--jelly-arm-light": "#a8d9fb",
    "--jelly-arm-mid": "#55a4e5",
    "--jelly-arm-deep": "#327fc5",
    "--jelly-belly-glow": "#a9ecff",
    "--jelly-eye-sparkle": "#55b4ee",
  },
  teal: {
    "--jelly-body-top": "#b3f2e6",
    "--jelly-body-mid": "#42c7b5",
    "--jelly-body-deep": "#25a592",
    "--jelly-body-rim": "#6edbc9",
    "--jelly-outline": "#218b7d",
    "--jelly-outline-light": "#35b5a3",
    "--jelly-arm-light": "#9be9dc",
    "--jelly-arm-mid": "#42c0ae",
    "--jelly-arm-deep": "#259a89",
    "--jelly-belly-glow": "#a5f1dc",
    "--jelly-eye-sparkle": "#42c7b5",
  },
  green: {
    "--jelly-body-top": "#c9f2b8",
    "--jelly-body-mid": "#72c96a",
    "--jelly-body-deep": "#4fac50",
    "--jelly-body-rim": "#94da83",
    "--jelly-outline": "#3f913f",
    "--jelly-outline-light": "#64b85c",
    "--jelly-arm-light": "#b8eaa8",
    "--jelly-arm-mid": "#70c267",
    "--jelly-arm-deep": "#4a9f49",
    "--jelly-belly-glow": "#d5efa6",
    "--jelly-eye-sparkle": "#72c96a",
  },
  orange: {
    "--jelly-body-top": "#ffd2a8",
    "--jelly-body-mid": "#f49a55",
    "--jelly-body-deep": "#dc7438",
    "--jelly-body-rim": "#ffb371",
    "--jelly-outline": "#c2602e",
    "--jelly-outline-light": "#e58443",
    "--jelly-arm-light": "#ffc898",
    "--jelly-arm-mid": "#ee9250",
    "--jelly-arm-deep": "#cd6b35",
    "--jelly-belly-glow": "#ffe094",
    "--jelly-eye-sparkle": "#ef8e46",
  },
  pink: {
    "--jelly-body-top": "#ffc5e2",
    "--jelly-body-mid": "#ed79b4",
    "--jelly-body-deep": "#d55798",
    "--jelly-body-rim": "#f598c8",
    "--jelly-outline": "#bd4383",
    "--jelly-outline-light": "#df63a3",
    "--jelly-arm-light": "#ffb8da",
    "--jelly-arm-mid": "#e975ae",
    "--jelly-arm-deep": "#c94e8e",
    "--jelly-belly-glow": "#ffc5dd",
    "--jelly-eye-sparkle": "#e96dad",
  },
};

export default function AuthBlob({
  mood = "idle",
  size = 150,
  sensitive = false,
  gaze,
  skin = "violet",
  className = "",
}: {
  mood?: BlobMood;
  size?: number;
  sensitive?: boolean;
  gaze?: { x: number; y: number; intensity?: number };
  skin?: BlobSkin;
  className?: string;
}) {
  const feralMood = sensitive && mood === "focused" ? "password" : FERAL_MOODS[mood];

  return (
    <div
      data-blob-mood={mood}
      className={`relative flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size, ...SKIN_STYLES[skin] }}
      aria-hidden="true"
    >
      <JellyBlobMascot
        mood={feralMood}
        gaze={sensitive ? { x: 18, y: -9, intensity: 0.8 } : gaze}
        nod={mood === "thinking"}
        respectReducedMotion={false}
        happyEyes="smile"
        className="h-full w-full"
      />
    </div>
  );
}
