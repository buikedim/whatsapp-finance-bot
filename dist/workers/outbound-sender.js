"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const whatsapp_service_1 = require("../services/whatsapp.service");
const connection = new ioredis_1.Redis(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
async function sendOutboundMessage(job) {
    const { userId, phoneNumber, messageBody, metadata } = job.data;
    logger_1.logger.info('Sending outbound message', {
        userId,
        messageLength: messageBody.length,
        hasMetadata: !!metadata,
    });
    try {
        const messageSid = await whatsapp_service_1.WhatsAppService.sendMessage(phoneNumber, messageBody);
        logger_1.logger.info('Outbound message sent successfully', {
            userId,
            messageSid,
            replyTo: metadata?.replyToMessageId,
        });
        return {
            success: true,
            messageSid,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to send outbound message', {
            userId,
            phoneNumber,
            error: error.message,
            attempts: job.attemptsMade,
        });
        throw error;
    }
}
const outboundSenderWorker = new bullmq_1.Worker('outbound-messages', async (job) => {
    return await sendOutboundMessage(job);
}, {
    connection,
    concurrency: 10,
    limiter: {
        max: 20,
        duration: 1000,
    },
});
outboundSenderWorker.on('completed', (job) => {
    logger_1.logger.info('Outbound job completed', {
        jobId: job.id,
        userId: job.data.userId,
    });
});
outboundSenderWorker.on('failed', (job, err) => {
    logger_1.logger.error('Outbound job failed', {
        jobId: job?.id,
        userId: job?.data.userId,
        error: err.message,
        attempts: job?.attemptsMade,
    });
});
outboundSenderWorker.on('error', (err) => {
    logger_1.logger.error('Outbound worker error', { error: err.message });
});
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received, closing outbound sender worker...');
    await outboundSenderWorker.close();
});
logger_1.logger.info('Outbound sender worker started', {
    concurrency: 10,
    queue: 'outbound-messages',
});
