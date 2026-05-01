import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const diagramVersionSchema = new Schema(
  {
    diagramId: {
      type: Schema.Types.ObjectId,
      ref: "Diagram",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    code: { type: String, default: "" },
    theme: { type: String, default: "default" },
    customStyles: { type: Schema.Types.Mixed, default: {} },
    customCss: { type: String, default: "" },
    label: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

diagramVersionSchema.index({ diagramId: 1, createdAt: -1 });

export type DiagramVersionDoc = InferSchemaType<typeof diagramVersionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const DiagramVersion: Model<DiagramVersionDoc> =
  (mongoose.models.DiagramVersion as Model<DiagramVersionDoc>) ||
  mongoose.model<DiagramVersionDoc>("DiagramVersion", diagramVersionSchema);
