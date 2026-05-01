import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const customStylesSchema = new Schema(
  {
    primaryColor: { type: String },
    background: { type: String },
    fontColor: { type: String },
    fontFamily: { type: String },
  },
  { _id: false },
);

const diagramSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, default: "Untitled diagram" },
    code: { type: String, default: "" },
    theme: {
      type: String,
      enum: ["default", "dark", "forest", "neutral", "base"],
      default: "default",
    },
    customStyles: { type: customStylesSchema, default: () => ({}) },
    customCss: { type: String, default: "", maxlength: 10_000 },
    tags: {
      type: [String],
      default: [],
      validate: [(v: string[]) => v.length <= 20, "Too many tags"],
    },
    isPublic: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

diagramSchema.index({ userId: 1, updatedAt: -1 });
diagramSchema.index({ userId: 1, title: "text" });
diagramSchema.index({ userId: 1, tags: 1 });

export type DiagramDoc = InferSchemaType<typeof diagramSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Diagram: Model<DiagramDoc> =
  (mongoose.models.Diagram as Model<DiagramDoc>) ||
  mongoose.model<DiagramDoc>("Diagram", diagramSchema);
