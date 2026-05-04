import type { AnnotationColor } from "@/lib/validators";

export const ANNOTATION_COLORS: Record<
  AnnotationColor,
  { bg: string; border: string; text: string; stroke: string; fill: string }
> = {
  yellow: {
    bg: "rgba(250, 204, 21, 0.18)",
    border: "rgb(202, 138, 4)",
    text: "rgb(113, 63, 18)",
    stroke: "rgb(202, 138, 4)",
    fill: "rgb(250, 204, 21)",
  },
  red: {
    bg: "rgba(239, 68, 68, 0.16)",
    border: "rgb(220, 38, 38)",
    text: "rgb(127, 29, 29)",
    stroke: "rgb(220, 38, 38)",
    fill: "rgb(239, 68, 68)",
  },
  green: {
    bg: "rgba(34, 197, 94, 0.18)",
    border: "rgb(22, 163, 74)",
    text: "rgb(20, 83, 45)",
    stroke: "rgb(22, 163, 74)",
    fill: "rgb(34, 197, 94)",
  },
  blue: {
    bg: "rgba(59, 130, 246, 0.16)",
    border: "rgb(37, 99, 235)",
    text: "rgb(30, 58, 138)",
    stroke: "rgb(37, 99, 235)",
    fill: "rgb(59, 130, 246)",
  },
  purple: {
    bg: "rgba(168, 85, 247, 0.18)",
    border: "rgb(147, 51, 234)",
    text: "rgb(88, 28, 135)",
    stroke: "rgb(147, 51, 234)",
    fill: "rgb(168, 85, 247)",
  },
};

export const COLOR_KEYS: AnnotationColor[] = [
  "yellow",
  "red",
  "green",
  "blue",
  "purple",
];
