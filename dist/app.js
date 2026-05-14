"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const whatsapp_controller_1 = require("./webhooks/whatsapp.controller");
const validate_webhook_1 = require("./middleware/validate-webhook");
const error_handler_1 = require("./middleware/error-handler");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    logger_1.logger.debug('Incoming request', {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
    });
    next();
});
app.get('/health', (0, error_handler_1.asyncHandler)(whatsapp_controller_1.WhatsAppController.healthCheck));
app.post('/webhooks/whatsapp', validate_webhook_1.validateTwilioWebhook, (0, error_handler_1.asyncHandler)(whatsapp_controller_1.WhatsAppController.handleIncomingMessage));
app.get('/', (req, res) => {
    res.json({
        service: 'WhatsApp Finance Bot',
        version: '1.0.0',
        status: 'running',
    });
});
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
    });
});
app.use(error_handler_1.errorHandler);
const PORT = parseInt(env_1.env.PORT);
app.listen(PORT, () => {
    logger_1.logger.info('Server started', {
        port: PORT,
        env: env_1.env.NODE_ENV,
        nodeVersion: process.version,
    });
});
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
    });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled rejection', {
        reason,
        promise,
    });
    process.exit(1);
});
exports.default = app;
