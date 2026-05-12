import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('warn', (e) => {
  logger.warn('Database warning', { message: e.message });
});

prisma.$on('error', (e) => {
  logger.error('Database error', { message: e.message });
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export { prisma };