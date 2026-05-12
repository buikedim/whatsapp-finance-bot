import { Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import { enqueueIncomingMessage } from '../queues';
import { IncomingMessageJob } from '../types';
import { logger } from '../utils/logger';

export class WhatsAppController {
  static async handleIncomingMessage(req: Request, res: Response): Promise<void> {
    try {
      const {
        MessageSid,
        From,
        To,
        Body,
        Timestamp,
      } = req.body;

      if (!MessageSid || !From || !Body) {
        logger.warn('Invalid webhook payload', { body: req.body });
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const phoneNumber = WhatsAppService.normalizePhoneNumber(From);

      const job: IncomingMessageJob = {
        messageId: MessageSid,
        userId: phoneNumber,
        phoneNumber: From,
        messageBody: Body.trim(),
        timestamp: Timestamp ? new Date(parseInt(Timestamp) * 1000) : new Date(),
        rawPayload: req.body,
      };

      await enqueueIncomingMessage(job);

      res.status(200).send('OK');

      logger.info('Incoming message enqueued', {
        messageId: MessageSid,
        from: phoneNumber,
        bodyLength: Body.length,
      });
    } catch (error: any) {
      logger.error('Failed to handle incoming message', {
        error: error.message,
        body: req.body,
      });

      res.status(200).send('ERROR');
    }
  }

  static async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'whatsapp-finance-bot',
    });
  }
}