"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const client = (0, twilio_1.default)(env_1.env.TWILIO_ACCOUNT_SID, env_1.env.TWILIO_AUTH_TOKEN);
class WhatsAppService {
    static async sendMessage(to, body) {
        try {
            const message = await client.messages.create({
                from: env_1.env.TWILIO_WHATSAPP_NUMBER,
                to,
                body,
            });
            logger_1.logger.info('WhatsApp message sent', {
                messageId: message.sid,
                to,
                status: message.status,
            });
            return message.sid;
        }
        catch (error) {
            logger_1.logger.error('Failed to send WhatsApp message', {
                to,
                error: error.message,
                code: error.code,
            });
            throw new types_1.ExternalServiceError('Twilio', error.message);
        }
    }
    static validateWebhookSignature(signature, url, params) {
        try {
            return twilio_1.default.validateRequest(env_1.env.TWILIO_AUTH_TOKEN, signature, url, params);
        }
        catch (error) {
            logger_1.logger.error('Webhook signature validation failed', {
                error: error.message,
            });
            return false;
        }
    }
    static normalizePhoneNumber(whatsappNumber) {
        return whatsappNumber.replace('whatsapp:', '');
    }
    static toWhatsAppFormat(phoneNumber) {
        if (phoneNumber.startsWith('whatsapp:')) {
            return phoneNumber;
        }
        return `whatsapp:${phoneNumber}`;
    }
}
exports.WhatsAppService = WhatsAppService;
