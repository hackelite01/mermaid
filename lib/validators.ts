import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export const themeEnum = z.enum(["default", "dark", "forest", "neutral", "base"]);

export const customStylesSchema = z
  .object({
    primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
    background: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
    fontColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
    fontFamily: z.string().max(80).optional(),
  })
  .strict();

export const tagsSchema = z
  .array(z.string().min(1).max(32).regex(/^[a-z0-9-_ ]+$/i))
  .max(20);

export const diagramCreateSchema = z.object({
  title: z.string().min(1).max(120).default("Untitled diagram"),
  code: z.string().max(50_000).default(""),
  theme: themeEnum.default("default"),
  customStyles: customStylesSchema.default({}),
  customCss: z.string().max(10_000).default(""),
  tags: tagsSchema.default([]),
});

export const diagramUpdateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  code: z.string().max(50_000).optional(),
  theme: themeEnum.optional(),
  customStyles: customStylesSchema.optional(),
  customCss: z.string().max(10_000).optional(),
  tags: tagsSchema.optional(),
});

export const shareSchema = z.object({ isPublic: z.boolean() });

export const versionCreateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DiagramCreateInput = z.infer<typeof diagramCreateSchema>;
export type DiagramUpdateInput = z.infer<typeof diagramUpdateSchema>;
export type CustomStyles = z.infer<typeof customStylesSchema>;
