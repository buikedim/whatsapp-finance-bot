import express from 'express';
import { env } from './config/env';
import { logger } from './utils/logger';
import { WhatsAppController } from './webhooks/whatsapp.controller';
import { validateTwilioWebhook } from './middleware/validate-webhook';
import { errorHandler, asyncHandler } from './middleware/error-handler';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });
  next();
});

app.get('/health', asyncHandler(WhatsAppController.healthCheck));

app.post(
  '/webhooks/whatsapp',
  asyncHandler(WhatsAppController.handleIncomingMessage)
);

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

app.use(errorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason,
    promise,
  });
  process.exit(1);
});

export default app;