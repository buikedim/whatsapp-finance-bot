import { Request, Response, NextFunction } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function validateTwilioWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (env.NODE_ENV === 'development' && !env.TWILIO_WEBHOOK_URL) {
    logger.warn('Skipping webhook validation in development mode');
    next();
    return;
  }

  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    logger.warn('Missing Twilio signature header');
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const url = env.TWILIO_WEBHOOK_URL || `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  const isValid = WhatsAppService.validateWebhookSignature(
    signature,
    url,
    req.body
  );

  if (!isValid) {
    logger.warn('Invalid Twilio signature', {
      url,
      signature: signature.substring(0, 20) + '...',
    });
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  logger.debug('Webhook signature validated successfully');
  next();
}