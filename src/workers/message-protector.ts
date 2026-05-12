import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env';
import { IncomingMessageJob, OutboundMessageJob } from '../types';
import { logger } from '../utils/logger';
import { ClaudeService } from '../services/claude.service';
import { SpendingService } from '../services/spending.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { enqueueOutboundMessage } from '../queues';

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

async function processIncomingMessage(job: Job<IncomingMessageJob>) {
  const { messageId, userId, phoneNumber, messageBody, timestamp } = job.data;

  logger.info('Processing incoming message', {
    messageId,
    userId,
    bodyLength: messageBody.length,
  });

  try {
    const userDbId = await SpendingService.ensureUser(userId);

    const recentSpending = await SpendingService.getRecentSpending(userDbId, 3);

    const parsedSpending = await ClaudeService.parseSpendingMessage(
      messageBody,
      {
        recentSpending,
        timezone: 'Africa/Lagos',
      }
    );

    logger.info('Message parsed successfully', {
      messageId,
      amount: parsedSpending.amountNgn,
      category: parsedSpending.category,
      confidence: parsedSpending.confidence,
    });

    const spendingRecord = await SpendingService.createSpendingRecord(
      userDbId,
      parsedSpending,
      {
        rawMessage: messageBody,
        messageId,
      }
    );

    const summary = await SpendingService.getUserSpendingSummary(userDbId);

    const categoryTotal = parsedSpending.category
      ? await SpendingService.getCategoryWeekTotal(userDbId, parsedSpending.category)
      : undefined;

    const acknowledgment = await ClaudeService.generateAcknowledgment(
      parsedSpending,
      {
        todayTotal: summary.todayTotal,
        weekTotal: summary.weekTotal,
        categoryTotal,
      }
    );

    const outboundJob: OutboundMessageJob = {
      userId: userDbId,
      phoneNumber,
      messageBody: acknowledgment,
      metadata: {
        replyToMessageId: messageId,
        spendingRecordId: spendingRecord.id,
      },
    };

    await enqueueOutboundMessage(outboundJob);

    logger.info('Message processed successfully', {
      messageId,
      spendingRecordId: spendingRecord.id,
      acknowledgmentLength: acknowledgment.length,
    });

    return {
      success: true,
      spendingRecordId: spendingRecord.id,
    };
  } catch (error: any) {
    logger.error('Failed to process message', {
      messageId,
      userId,
      error: error.message,
      stack: error.stack,
    });

    if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
      const errorMessage = "I'm having trouble processing that message. Could you try again with a format like: 'Spent 5000 on lunch'?";
      
      await enqueueOutboundMessage({
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

const messageProcessorWorker = new Worker<IncomingMessageJob>(
  'incoming-messages',
  async (job) => {
    return await processIncomingMessage(job);
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

messageProcessorWorker.on('completed', (job) => {
  logger.info('Job completed', {
    jobId: job.id,
    messageId: job.data.messageId,
  });
});

messageProcessorWorker.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job?.id,
    messageId: job?.data.messageId,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

messageProcessorWorker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing message processor worker...');
  await messageProcessorWorker.close();
});

logger.info('Message processor worker started', {
  concurrency: 5,
  queue: 'incoming-messages',
});