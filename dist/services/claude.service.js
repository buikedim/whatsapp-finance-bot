"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeService = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const client = new sdk_1.default({
    apiKey: env_1.env.ANTHROPIC_API_KEY,
});
class ClaudeService {
    static async parseSpendingMessage(userMessage, userContext) {
        try {
            const systemPrompt = this.buildParsingSystemPrompt();
            const userPrompt = this.buildParsingUserPrompt(userMessage, userContext);
            logger_1.logger.debug('Calling Claude API for spending parsing', {
                messageLength: userMessage.length,
            });
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 500,
                temperature: 0,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            });
            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type from Claude');
            }
            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in Claude response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            const validated = types_1.ParsedSpendingSchema.parse(parsed);
            logger_1.logger.info('Successfully parsed spending message', {
                amount: validated.amountNgn,
                category: validated.category,
                confidence: validated.confidence,
            });
            return validated;
        }
        catch (error) {
            logger_1.logger.error('Failed to parse spending message', {
                error: error.message,
                userMessage,
            });
            if (error instanceof sdk_1.default.APIError) {
                throw new types_1.ExternalServiceError('Claude API', error.message);
            }
            throw error;
        }
    }
    static async generateAcknowledgment(parsedSpending, userContext) {
        try {
            const systemPrompt = this.buildEngagingSystemPrompt();
            const userPrompt = this.buildEngagingUserPrompt(parsedSpending, userContext);
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                temperature: 0.9,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            });
            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type from Claude');
            }
            return content.text.trim();
        }
        catch (error) {
            logger_1.logger.error('Failed to generate acknowledgment', {
                error: error.message,
            });
            return this.getFallbackResponse(parsedSpending, userContext);
        }
    }
    static buildEngagingSystemPrompt() {
        return `You are a brutally honest but caring Nigerian finance buddy with PERSONALITY.

YOUR IDENTITY:
- Name: "Stingy Bot" (but you're actually looking out for them)
- Age: Late 20s vibes
- Personality: Sassy, witty, uses Nigerian slang, keeps it real
- Goal: Help people spend smarter WITHOUT being preachy or boring
- Tone: Like a friend who's not afraid to drag you (lovingly)

SPEAKING STYLE:
- Use Nigerian Pidgin English naturally: "abeg", "e choke", "wahala", "omo", "sha", "o"
- Be conversational, not robotic
- Mix humor with genuine care
- Keep responses SHORT (1-2 sentences max, sometimes just a line)
- Use emojis SPARINGLY (max 1-2, and only when they add flavor)
- NEVER sound like customer service

YOUR MOODS (vary based on spending patterns):
1. SUPPORTIVE (small/reasonable spending): Encouraging, proud
2. TEASING (slightly over budget): Playful jabs, light roasting
3. CONCERNED (consistently overspending): Real talk, but still friendly
4. CELEBRATORY (under budget): Hype them up!

NIGERIAN CONTEXT:
- ₦ is Naira (Nigerian currency)
- Transport: "okada" (bike), "danfo" (bus), "keke" (tricycle), Uber/Bolt
- Food: "suya", "shawarma", "party jollof", "amala"
- Hangouts: "club", "lounge", "owambe" (party), "mainland/island" (Lagos areas)
- Common phrases: "e choke" (expensive), "wahala" (trouble), "sharp sharp" (quickly)

RESPONSE GUIDELINES:
1. Always acknowledge the amount in Naira (₦)
2. Reference today's or week's total NATURALLY (not formulaic)
3. Add context ONLY if it's interesting (don't just recite numbers)
4. Match energy to spending: small = chill, large = react
5. Be SPECIFIC not generic: "Uber to VI" gets different response than "okada to junction"

WHAT TO AVOID:
- Don't sound like a bank: ❌ "Transaction recorded successfully"
- Don't be judgmental: ❌ "You're bad with money"
- Don't overdo slang: ❌ "Omo, you don buy suya again o, e choke gan, abeg rest na"
- Don't be repetitive: Vary your responses even for similar amounts
- Don't give advice unless spending is clearly problematic

Now respond to the user's spending with YOUR personality.`;
    }
    static buildEngagingUserPrompt(spending, context) {
        const isHighSpending = spending.amountNgn > 10000;
        const todayPercent = context.todayTotal > 0
            ? Math.round((spending.amountNgn / context.todayTotal) * 100)
            : 100;
        let prompt = `User just spent:
Amount: ₦${spending.amountNgn.toLocaleString()}
Category: ${spending.category || 'general'}
Description: ${spending.description || 'none'}

Context:
- This is ${todayPercent}% of their spending today
- They've spent ₦${context.todayTotal.toLocaleString()} total today
- They've spent ₦${context.weekTotal.toLocaleString()} total this week`;
        if (context.categoryTotal && spending.category) {
            prompt += `\n- They've spent ₦${context.categoryTotal.toLocaleString()} on ${spending.category} this week`;
        }
        if (isHighSpending) {
            prompt += `\n- This is a significant expense (>₦10k)`;
        }
        prompt += `\n\nGenerate a SHORT (1-2 sentences), engaging acknowledgment with personality. Be conversational, use Nigerian context, and match your energy to the spending.`;
        return prompt;
    }
    static getFallbackResponse(spending, context) {
        const amount = spending.amountNgn;
        const category = spending.category || 'that';
        const responses = [
            `₦${amount.toLocaleString()} on ${category}. You're at ₦${context.todayTotal.toLocaleString()} today.`,
            `Noted. ₦${amount.toLocaleString()}. Today's total: ₦${context.todayTotal.toLocaleString()}.`,
            `₦${amount.toLocaleString()} logged. Week total now ₦${context.weekTotal.toLocaleString()}.`,
        ];
        if (amount > 10000) {
            responses.push(`₦${amount.toLocaleString()}? Okay o. You've spent ₦${context.weekTotal.toLocaleString()} this week.`, `Big man things. ₦${amount.toLocaleString()}. That's ₦${context.weekTotal.toLocaleString()} total this week.`);
        }
        return responses[Math.floor(Math.random() * responses.length)];
    }
    static buildParsingSystemPrompt() {
        return `You are a spending message parser for Nigerian users.
Your job is to extract spending information from natural language messages.

Extract the following fields:
- amountNgn: The amount in Nigerian Naira (required, number only, no currency symbol)
- category: One of: food, transport, entertainment, bills, shopping, health, education, other (optional)
- description: Brief description of what was purchased (optional)
- confidence: How confident you are in the extraction - "high", "medium", or "low"
- recordedAt: ISO 8601 datetime string when spending occurred (optional, default to now if not specified)
- notes: Any additional context you extracted (optional)

Handle various Nigerian formats:
- "5k" or "5K" = 5000
- "2.5k" = 2500
- "₦5000" or "N5000" = 5000
- "500 naira" = 500
- Informal spellings: "okada" = transport, "suya" = food, "fuel" = transport

Today's date: ${new Date().toISOString()}
Timezone: Africa/Lagos (WAT, UTC+1)

Respond ONLY with a JSON object, no other text or markdown.`;
    }
    static buildParsingUserPrompt(message, context) {
        let prompt = `Parse this spending message:\n\n"${message}"`;
        if (context?.recentSpending && context.recentSpending.length > 0) {
            prompt += '\n\nRecent spending for context:\n';
            context.recentSpending.slice(0, 3).forEach((s) => {
                prompt += `- ₦${s.amount} on ${s.category}${s.description ? `: ${s.description}` : ''}\n`;
            });
        }
        prompt += '\n\nRespond with JSON only.';
        return prompt;
    }
}
exports.ClaudeService = ClaudeService;
