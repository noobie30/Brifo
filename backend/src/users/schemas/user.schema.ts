import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop({ default: "Asia/Kolkata" })
  timezone!: string;

  @Prop({ type: Object, default: {} })
  integrations!: {
    googleCalendar?: {
      connected: boolean;
      refreshToken?: string;
      accessToken?: string;
      expiryDate?: number;
    };
    jira?: {
      connected: boolean;
      cloudId?: string;
      siteName?: string;
      siteUrl?: string;
      defaultProjectId?: string;
      defaultProjectKey?: string;
      defaultSprintId?: string;
      email?: string;
      apiToken?: string;
      accountId?: string;
      displayName?: string;
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number;
    };
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
