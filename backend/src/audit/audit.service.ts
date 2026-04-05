import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuditLog, AuditLogDocument } from "./schemas/audit-log.schema";

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.auditModel.create({
      userId,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  async list(userId: string) {
    return this.auditModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
  }
}
