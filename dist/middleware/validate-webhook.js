"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTwilioWebhook = validateTwilioWebhook;
const whatsapp_service_1 = require("../services/whatsapp.service");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
function validateTwilioWebhook(req, res, next) {
    if (env_1.env.NODE_ENV === 'development' && !env_1.env.TWILIO_WEBHOOK_URL) {
        logger_1.logger.warn('Skipping webhook validation in development mode');
        next();
        return;
    }
    const signature = req.headers['x-twilio-signature'];
    if (!signature) {
        logger_1.logger.warn('Missing Twilio signature header');
        res.status(401).json({ error: 'Missing signature' });
        return;
    }
    const url = env_1.env.TWILIO_WEBHOOK_URL || `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const isValid = whatsapp_service_1.WhatsAppService.validateWebhookSignature(signature, url, req.body);
    if (!isValid) {
        logger_1.logger.warn('Invalid Twilio signature', {
            url,
            signature: signature.substring(0, 20) + '...',
        });
        res.status(403).json({ error: 'Invalid signature' });
        return;
    }
    logger_1.logger.debug('Webhook signature validated successfully');
    next();
}
