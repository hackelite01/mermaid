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
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true },
);

diagramSchema.index({ userId: 1, updatedAt: -1 });
diagramSchema.index({ userId: 1, title: "text" });

export type DiagramDoc = InferSchemaType<typeof diagramSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Diagram: Model<DiagramDoc> =
  (mongoose.models.Diagram as Model<DiagramDoc>) ||
  mongoose.model<DiagramDoc>("Diagram", diagramSchema);
