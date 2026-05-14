"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient({
    log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
    ],
});
exports.prisma = prisma;
prisma.$on('warn', (e) => {
    logger_1.logger.warn('Database warning', { message: e.message });
});
prisma.$on('error', (e) => {
    logger_1.logger.error('Database error', { message: e.message });
});
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
