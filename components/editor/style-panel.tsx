"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomStyles } from "@/lib/validators";

type MermaidTheme = "default" | "dark" | "forest" | "neutral" | "base";

const THEMES: { value: MermaidTheme; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "dark", label: "Dark" },
  { value: "forest", label: "Forest" },
  { value: "neutral", label: "Neutral" },
  { value: "base", label: "Base" },
];

export function StylePanel({
  theme,
  customStyles,
  onThemeChange,
  onStylesChange,
}: {
  theme: MermaidTheme;
  customStyles: CustomStyles;
  onThemeChange: (t: MermaidTheme) => void;
  onStylesChange: (s: CustomStyles) => void;
}) {
  function setStyle<K extends keyof CustomStyles>(key: K, value: CustomStyles[K] | undefined) {
    const next = { ...customStyles };
    if (value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onStylesChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Theme</Label>
        <Select value={theme} onValueChange={(v) => onThemeChange(v as MermaidTheme)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEMES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ColorField
        label="Primary color"
        value={customStyles.primaryColor ?? ""}
        onChange={(v) => setStyle("primaryColor", v || undefined)}
      />
      <ColorField
        label="Background"
        value={customStyles.background ?? ""}
        onChange={(v) => setStyle("background", v || undefined)}
      />
      <ColorField
        label="Font color"
        value={customStyles.fontColor ?? ""}
        onChange={(v) => setStyle("fontColor", v || undefined)}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const valid = /^#([0-9a-fA-F]{3}){1,2}$/.test(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
          aria-label={label}
        />
        <Input
          value={value}
          placeholder="#000000"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
