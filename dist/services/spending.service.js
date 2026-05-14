"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpendingService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class SpendingService {
    static async ensureUser(phoneNumber) {
        try {
            const user = await database_1.prisma.user.upsert({
                where: { phoneNumber },
                update: {},
                create: {
                    phoneNumber,
                    timezone: 'Africa/Lagos',
                },
            });
            logger_1.logger.debug('User ensured', { userId: user.id, phoneNumber });
            return user.id;
        }
        catch (error) {
            logger_1.logger.error('Failed to ensure user', {
                phoneNumber,
                error: error.message,
            });
            throw error;
        }
    }
    static async createSpendingRecord(userId, parsedSpending, metadata) {
        try {
            const recordedAt = parsedSpending.recordedAt
                ? new Date(parsedSpending.recordedAt)
                : new Date();
            const record = await database_1.prisma.spendingRecord.create({
                data: {
                    userId,
                    amountNgn: parsedSpending.amountNgn,
                    category: parsedSpending.category || 'other',
                    description: parsedSpending.description,
                    recordedAt,
                    metadata: {
                        rawMessage: metadata.rawMessage,
                        messageId: metadata.messageId,
                        confidence: parsedSpending.confidence,
                        notes: parsedSpending.notes,
                        parsedAt: new Date().toISOString(),
                    },
                },
            });
            logger_1.logger.info('Spending record created', {
                recordId: record.id,
                userId,
                amount: Number(record.amountNgn),
                category: record.category,
            });
            return {
                id: record.id,
                userId: record.userId,
                amountNgn: Number(record.amountNgn),
                category: record.category,
                description: record.description,
                recordedAt: record.recordedAt,
                createdAt: record.createdAt,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to create spending record', {
                userId,
                error: error.message,
            });
            throw error;
        }
    }
    static async getUserSpendingSummary(userId) {
        try {
            const now = new Date();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const weekStart = new Date(now);
            const dayOfWeek = weekStart.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            weekStart.setDate(weekStart.getDate() - daysToMonday);
            weekStart.setHours(0, 0, 0, 0);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const [todayRecords, weekRecords, monthRecords] = await Promise.all([
                database_1.prisma.spendingRecord.findMany({
                    where: {
                        userId,
                        recordedAt: { gte: todayStart },
                    },
                }),
                database_1.prisma.spendingRecord.findMany({
                    where: {
                        userId,
                        recordedAt: { gte: weekStart },
                    },
                }),
                database_1.prisma.spendingRecord.findMany({
                    where: {
                        userId,
                        recordedAt: { gte: monthStart },
                    },
                }),
            ]);
            const todayTotal = todayRecords.reduce((sum, r) => sum + Number(r.amountNgn), 0);
            const weekTotal = weekRecords.reduce((sum, r) => sum + Number(r.amountNgn), 0);
            const monthTotal = monthRecords.reduce((sum, r) => sum + Number(r.amountNgn), 0);
            const categoryMap = new Map();
            weekRecords.forEach((r) => {
                const category = r.category || 'other';
                categoryMap.set(category, (categoryMap.get(category) || 0) + Number(r.amountNgn));
            });
            const categoryBreakdown = Array.from(categoryMap.entries())
                .map(([category, amount]) => ({ category, amount }))
                .sort((a, b) => b.amount - a.amount);
            return {
                todayTotal,
                weekTotal,
                monthTotal,
                categoryBreakdown,
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get spending summary', {
                userId,
                error: error.message,
            });
            throw error;
        }
    }
    static async getCategoryWeekTotal(userId, category) {
        try {
            const now = new Date();
            const weekStart = new Date(now);
            const dayOfWeek = weekStart.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            weekStart.setDate(weekStart.getDate() - daysToMonday);
            weekStart.setHours(0, 0, 0, 0);
            const records = await database_1.prisma.spendingRecord.findMany({
                where: {
                    userId,
                    category,
                    recordedAt: { gte: weekStart },
                },
            });
            return records.reduce((sum, r) => sum + Number(r.amountNgn), 0);
        }
        catch (error) {
            logger_1.logger.error('Failed to get category week total', {
                userId,
                category,
                error: error.message,
            });
            return 0;
        }
    }
    static async getRecentSpending(userId, limit = 5) {
        try {
            const records = await database_1.prisma.spendingRecord.findMany({
                where: { userId },
                orderBy: { recordedAt: 'desc' },
                take: limit,
            });
            return records.map((r) => ({
                amount: Number(r.amountNgn),
                category: r.category || 'other',
                description: r.description || undefined,
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get recent spending', {
                userId,
                error: error.message,
            });
            return [];
        }
    }
}
exports.SpendingService = SpendingService;
