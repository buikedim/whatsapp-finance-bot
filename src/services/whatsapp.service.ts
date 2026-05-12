import twilio from 'twilio';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../types';

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export class WhatsAppService {
  static async sendMessage(to: string, body: string): Promise<string> {
    try {
      const message = await client.messages.create({
        from: env.TWILIO_WHATSAPP_NUMBER,
        to,
        body,
      });

      logger.info('WhatsApp message sent', {
        messageId: message.sid,
        to,
        status: message.status,
      });

      return message.sid;
    } catch (error: any) {
      logger.error('Failed to send WhatsApp message', {
        to,
        error: error.message,
        code: error.code,
      });
      throw new ExternalServiceError('Twilio', error.message);
    }
  }

  static validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, any>
  ): boolean {
    try {
      return twilio.validateRequest(
        env.TWILIO_AUTH_TOKEN,
        signature,
        url,
        params
      );
    } catch (error: any) {
      logger.error('Webhook signature validation failed', {
        error: error.message,
      });
      return false;
    }
  }

  static normalizePhoneNumber(whatsappNumber: string): string {
    return whatsappNumber.replace('whatsapp:', '');
  }

  static toWhatsAppFormat(phoneNumber: string): string {
    if (phoneNumber.startsWith('whatsapp:')) {
      return phoneNumber;
    }
    return `whatsapp:${phoneNumber}`;
  }
}