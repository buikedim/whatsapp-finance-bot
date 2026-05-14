"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    // Server
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().default('3000'),
    // Database
    DATABASE_URL: zod_1.z.string().url(),
    // Redis
    REDIS_URL: zod_1.z.string().url(),
    // Twilio WhatsApp
    TWILIO_ACCOUNT_SID: zod_1.z.string().min(1),
    TWILIO_AUTH_TOKEN: zod_1.z.string().min(1),
    TWILIO_WHATSAPP_NUMBER: zod_1.z.string().regex(/^whatsapp:\+\d+$/),
    TWILIO_WEBHOOK_URL: zod_1.z.string().url().optional(),
    // Anthropic Claude
    ANTHROPIC_API_KEY: zod_1.z.string().min(1),
    // Application
    MAX_MESSAGE_CONTEXT: zod_1.z.string().default('10'),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});
function validateEnv() {
    try {
        return envSchema.parse(process.env);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.error('❌ Invalid environment variables:');
            error.issues.forEach((err) => {
                console.error(`  ${err.path.join('.')}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
}
exports.env = validateEnv();
