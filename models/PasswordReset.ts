import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// MongoDB TTL index: documents are removed automatically when expiresAt passes.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetDoc = InferSchemaType<typeof passwordResetSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const PasswordReset: Model<PasswordResetDoc> =
  (mongoose.models.PasswordReset as Model<PasswordResetDoc>) ||
  mongoose.model<PasswordResetDoc>("PasswordReset", passwordResetSchema);
