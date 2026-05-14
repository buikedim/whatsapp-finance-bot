"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalServiceError = exports.NotFoundError = exports.ValidationError = exports.AppError = exports.ParsedSpendingSchema = void 0;
const zod_1 = require("zod");
exports.ParsedSpendingSchema = zod_1.z.object({
    amountNgn: zod_1.z.number().positive(),
    category: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    confidence: zod_1.z.enum(['high', 'medium', 'low']),
    recordedAt: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
});
class AppError extends Error {
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(400, message);
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(message) {
        super(404, message);
    }
}
exports.NotFoundError = NotFoundError;
class ExternalServiceError extends AppError {
    constructor(service, message) {
        super(502, `${service} error: ${message}`);
    }
}
exports.ExternalServiceError = ExternalServiceError;
