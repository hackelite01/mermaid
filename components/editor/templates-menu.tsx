"use client";

import * as React from "react";
import { FileCode, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TEMPLATES, type TemplateKey } from "@/lib/templates";

export function TemplatesMenu({ onPick }: { onPick: (code: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileCode className="mr-1 h-4 w-4" /> Templates
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => (
          <DropdownMenuItem key={key} onSelect={() => onPick(TEMPLATES[key].code)}>
            {TEMPLATES[key].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
