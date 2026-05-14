"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppController = void 0;
const whatsapp_service_1 = require("../services/whatsapp.service");
const queues_1 = require("../queues");
const logger_1 = require("../utils/logger");
class WhatsAppController {
    static async handleIncomingMessage(req, res) {
        try {
            const { MessageSid, From, To, Body, Timestamp, } = req.body;
            if (!MessageSid || !From || !Body) {
                logger_1.logger.warn('Invalid webhook payload', { body: req.body });
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            const phoneNumber = whatsapp_service_1.WhatsAppService.normalizePhoneNumber(From);
            const job = {
                messageId: MessageSid,
                userId: phoneNumber,
                phoneNumber: From,
                messageBody: Body.trim(),
                timestamp: Timestamp ? new Date(parseInt(Timestamp) * 1000) : new Date(),
                rawPayload: req.body,
            };
            await (0, queues_1.enqueueIncomingMessage)(job);
            res.status(200).send('OK');
            logger_1.logger.info('Incoming message enqueued', {
                messageId: MessageSid,
                from: phoneNumber,
                bodyLength: Body.length,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to handle incoming message', {
                error: error.message,
                body: req.body,
            });
            res.status(200).send('ERROR');
        }
    }
    static async healthCheck(req, res) {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'whatsapp-finance-bot',
        });
    }
}
exports.WhatsAppController = WhatsAppController;
