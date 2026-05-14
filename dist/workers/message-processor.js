"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const claude_service_1 = require("../services/claude.service");
const spending_service_1 = require("../services/spending.service");
const queues_1 = require("../queues");
const connection = new ioredis_1.Redis(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
async function processIncomingMessage(job) {
    const { messageId, userId, phoneNumber, messageBody, timestamp } = job.data;
    logger_1.logger.info('Processing incoming message', {
        messageId,
        userId,
        bodyLength: messageBody.length,
    });
    try {
        const userDbId = await spending_service_1.SpendingService.ensureUser(userId);
        const recentSpending = await spending_service_1.SpendingService.getRecentSpending(userDbId, 3);
        const parsedSpending = await claude_service_1.ClaudeService.parseSpendingMessage(messageBody, {
            recentSpending,
            timezone: 'Africa/Lagos',
        });
        logger_1.logger.info('Message parsed successfully', {
            messageId,
            amount: parsedSpending.amountNgn,
            category: parsedSpending.category,
            confidence: parsedSpending.confidence,
        });
        const spendingRecord = await spending_service_1.SpendingService.createSpendingRecord(userDbId, parsedSpending, {
            rawMessage: messageBody,
            messageId,
        });
        const summary = await spending_service_1.SpendingService.getUserSpendingSummary(userDbId);
        const categoryTotal = parsedSpending.category
            ? await spending_service_1.SpendingService.getCategoryWeekTotal(userDbId, parsedSpending.category)
            : undefined;
        const acknowledgment = await claude_service_1.ClaudeService.generateAcknowledgment(parsedSpending, {
            todayTotal: summary.todayTotal,
            weekTotal: summary.weekTotal,
            categoryTotal,
        });
        const outboundJob = {
            userId: userDbId,
            phoneNumber,
            messageBody: acknowledgment,
            metadata: {
                replyToMessageId: messageId,
                spendingRecordId: spendingRecord.id,
            },
        };
        await (0, queues_1.enqueueOutboundMessage)(outboundJob);
        logger_1.logger.info('Message processed successfully', {
            messageId,
            spendingRecordId: spendingRecord.id,
            acknowledgmentLength: acknowledgment.length,
        });
        return {
            success: true,
            spendingRecordId: spendingRecord.id,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to process message', {
            messageId,
            userId,
            error: error.message,
            stack: error.stack,
        });
        if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
            const errorMessage = "I'm having trouble processing that message. Could you try again with a format like: 'Spent 5000 on lunch'?";
            await (0, queues_1.enqueueOutboundMessage)({
                userId,
                phoneNumber,
                messageBody: errorMessage,
                metadata: {
                    replyToMessageId: messageId,
                },
            });
        }
        throw error;
    }
}
const messageProcessorWorker = new bullmq_1.Worker('incoming-messages', async (job) => {
    return await processIncomingMessage(job);
}, {
    connection,
    concurrency: 5,
    limiter: {
        max: 10,
        duration: 1000,
    },
});
messageProcessorWorker.on('completed', (job) => {
    logger_1.logger.info('Job completed', {
        jobId: job.id,
        messageId: job.data.messageId,
    });
});
messageProcessorWorker.on('failed', (job, err) => {
    logger_1.logger.error('Job failed', {
        jobId: job?.id,
        messageId: job?.data.messageId,
        error: err.message,
        attempts: job?.attemptsMade,
    });
});
messageProcessorWorker.on('error', (err) => {
    logger_1.logger.error('Worker error', { error: err.message });
});
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received, closing message processor worker...');
    await messageProcessorWorker.close();
});
logger_1.logger.info('Message processor worker started', {
    concurrency: 5,
    queue: 'incoming-messages',
});
