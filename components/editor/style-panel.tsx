"use client";

import * as React from "react";
import { X } from "lucide-react";
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
  customCss,
  tags,
  onThemeChange,
  onStylesChange,
  onCustomCssChange,
  onTagsChange,
}: {
  theme: MermaidTheme;
  customStyles: CustomStyles;
  customCss: string;
  tags: string[];
  onThemeChange: (t: MermaidTheme) => void;
  onStylesChange: (s: CustomStyles) => void;
  onCustomCssChange: (s: string) => void;
  onTagsChange: (t: string[]) => void;
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

      <TagsField tags={tags} onTagsChange={onTagsChange} />

      <div className="space-y-2">
        <Label htmlFor="custom-css">Custom CSS</Label>
        <textarea
          id="custom-css"
          value={customCss}
          onChange={(e) => onCustomCssChange(e.target.value)}
          spellCheck={false}
          placeholder=".node rect { stroke-width: 3px; }"
          className="block h-32 w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Injected inside the rendered SVG. <code>@import</code>, <code>url()</code>,
          and <code>expression()</code> are stripped.
        </p>
      </div>
    </div>
  );
}

function TagsField({
  tags,
  onTagsChange,
}: {
  tags: string[];
  onTagsChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");

  function add(value: string) {
    const v = value.trim();
    if (!v) return;
    if (!/^[a-z0-9-_ ]+$/i.test(v)) return;
    if (tags.includes(v)) return;
    if (tags.length >= 20) return;
    onTagsChange([...tags, v]);
    setDraft("");
  }
  function remove(t: string) {
    onTagsChange(tags.filter((x) => x !== t));
  }

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2 py-0.5 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove tag ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            remove(tags[tags.length - 1]);
          }
        }}
        onBlur={() => add(draft)}
        placeholder="Press Enter to add"
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
