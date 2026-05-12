import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env';
import { IncomingMessageJob, OutboundMessageJob } from '../types';
import { logger } from '../utils/logger';

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

connection.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

connection.on('connect', () => {
  logger.info('Redis connected successfully');
});

export const incomingMessagesQueue = new Queue<IncomingMessageJob>('incoming-messages', {
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

export const outboundMessagesQueue = new Queue<OutboundMessageJob>('outbound-messages', {
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

export async function enqueueIncomingMessage(job: IncomingMessageJob): Promise<void> {
  await incomingMessagesQueue.add('process-message', job, {
    jobId: job.messageId,
  });
  
  logger.info('Enqueued incoming message', {
    messageId: job.messageId,
    userId: job.userId,
  });
}

export async function enqueueOutboundMessage(job: OutboundMessageJob): Promise<void> {
  await outboundMessagesQueue.add('send-message', job);
  
  logger.info('Enqueued outbound message', {
    userId: job.userId,
    messageLength: job.messageBody.length,
  });
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing queues...');
  await incomingMessagesQueue.close();
  await outboundMessagesQueue.close();
  await connection.quit();
});