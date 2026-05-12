import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env';
import { OutboundMessageJob } from '../types';
import { logger } from '../utils/logger';
import { WhatsAppService } from '../services/whatsapp.service';

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

async function sendOutboundMessage(job: Job<OutboundMessageJob>) {
  const { userId, phoneNumber, messageBody, metadata } = job.data;

  logger.info('Sending outbound message', {
    userId,
    messageLength: messageBody.length,
    hasMetadata: !!metadata,
  });

  try {
    const messageSid = await WhatsAppService.sendMessage(phoneNumber, messageBody);

    logger.info('Outbound message sent successfully', {
      userId,
      messageSid,
      replyTo: metadata?.replyToMessageId,
    });

    return {
      success: true,
      messageSid,
    };
  } catch (error: any) {
    logger.error('Failed to send outbound message', {
      userId,
      phoneNumber,
      error: error.message,
      attempts: job.attemptsMade,
    });

    throw error;
  }
}

const outboundSenderWorker = new Worker<OutboundMessageJob>(
  'outbound-messages',
  async (job) => {
    return await sendOutboundMessage(job);
  },
  {
    connection,
    concurrency: 10,
    limiter: {
      max: 20,
      duration: 1000,
    },
  }
);

outboundSenderWorker.on('completed', (job) => {
  logger.info('Outbound job completed', {
    jobId: job.id,
    userId: job.data.userId,
  });
});

outboundSenderWorker.on('failed', (job, err) => {
  logger.error('Outbound job failed', {
    jobId: job?.id,
    userId: job?.data.userId,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

outboundSenderWorker.on('error', (err) => {
  logger.error('Outbound worker error', { error: err.message });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing outbound sender worker...');
  await outboundSenderWorker.close();
});

logger.info('Outbound sender worker started', {
  concurrency: 10,
  queue: 'outbound-messages',
});