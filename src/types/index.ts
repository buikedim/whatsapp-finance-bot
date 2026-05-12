import { z } from 'zod';

export interface IncomingWhatsAppMessage {
  messageId: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  rawPayload: any;
}

export const ParsedSpendingSchema = z.object({
  amountNgn: z.number().positive(),
  category: z.string().optional(),
  description: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  recordedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export type ParsedSpending = z.infer<typeof ParsedSpendingSchema>;

export interface IncomingMessageJob {
  messageId: string;
  userId: string;
  phoneNumber: string;
  messageBody: string;
  timestamp: Date;
  rawPayload: any;
}

export interface OutboundMessageJob {
  userId: string;
  phoneNumber: string;
  messageBody: string;
  metadata?: {
    replyToMessageId?: string;
    spendingRecordId?: string;
  };
}

export interface SpendingRecordCreated {
  id: string;
  userId: string;
  amountNgn: number;
  category: string | null;
  description: string | null;
  recordedAt: Date;
  createdAt: Date;
}

export interface UserSpendingSummary {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
  }>;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(502, `${service} error: ${message}`);
  }
}