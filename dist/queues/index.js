"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outboundMessagesQueue = exports.incomingMessagesQueue = void 0;
exports.enqueueIncomingMessage = enqueueIncomingMessage;
exports.enqueueOutboundMessage = enqueueOutboundMessage;
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const connection = new ioredis_1.Redis(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});
connection.on('error', (err) => {
    logger_1.logger.error('Redis connection error', { error: err.message });
});
connection.on('connect', () => {
    logger_1.logger.info('Redis connected successfully');
});
exports.incomingMessagesQueue = new bullmq_1.Queue('incoming-messages', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: {
            age: 86400,
            count: 1000,
        },
        removeOnFail: {
            age: 604800,
        },
    },
});
exports.outboundMessagesQueue = new bullmq_1.Queue('outbound-messages', {
    connection,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 3000,
        },
        removeOnComplete: {
            age: 86400,
            count: 1000,
        },
        removeOnFail: {
            age: 604800,
        },
    },
});
async function enqueueIncomingMessage(job) {
    await exports.incomingMessagesQueue.add('process-message', job, {
        jobId: job.messageId,
    });
    logger_1.logger.info('Enqueued incoming message', {
        messageId: job.messageId,
        userId: job.userId,
    });
}
async function enqueueOutboundMessage(job) {
    await exports.outboundMessagesQueue.add('send-message', job);
    logger_1.logger.info('Enqueued outbound message', {
        userId: job.userId,
        messageLength: job.messageBody.length,
    });
}
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received, closing queues...');
    await exports.incomingMessagesQueue.close();
    await exports.outboundMessagesQueue.close();
    await connection.quit();
});
