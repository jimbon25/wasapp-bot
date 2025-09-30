import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPromptForMode, CHAT_MODES } from '../utils/common/prompts.js';
import config from '../config.js';
import logger from '../utils/common/logger.js';
import memoryManager from '../utils/systemService/memoryManager.js';

const genAI = new GoogleGenerativeAI(config.apiKeys.gemini, {
    apiVersion: "v1beta"
});

const MODEL_CONFIGS = config.app.geminiModels.map(modelName => ({ model: modelName }));

async function tryModels(content, config) {
    let lastError = null;
    if (!content.role || !Array.isArray(content.parts)) {
        throw new Error("Invalid content format: missing role or parts array");
    }
    const validatedParts = content.parts.map(part => {
        if (!part.text) {
            throw new Error("Invalid part format: missing text property");
        }
        return {
            text: typeof part.text === 'string' ? part.text : String(part.text)
        };
    });
    for (const modelConfig of MODEL_CONFIGS) {
        try {
            logger.info(`Attempting to use model: ${modelConfig.model}`);
            const model = genAI.getGenerativeModel({ model: modelConfig.model });
            logger.info('Making request with content:', {
                model: modelConfig.model,
                contentPreview: validatedParts[0].text.substring(0, 100) + '...'
            });
            const requestContent = {
                contents: [{
                    role: content.role,
                    parts: validatedParts
                }]
            };
            if (content.generationConfig) {
                requestContent.generationConfig = content.generationConfig;
            }
            const result = await model.generateContent(requestContent);
            logger.info(`Successfully generated content with model: ${modelConfig.model}`);
            return result;
        } catch (error) {
            const errorDetails = {
                error: error.message,
                model: modelConfig.model,
                statusCode: error.status || 'unknown',
                errorType: error.name,
                apiVersion: 'v1beta'
            };
            logger.error('Model generation failed:', errorDetails);
            lastError = error;
            if (error.message.includes('not found for API version')) {
                logger.warn(`Model ${modelConfig.model} is not available in the current API version`);
            }
            continue;
        }
    }
    logger.error('All models failed:', {
        attemptedModels: MODEL_CONFIGS.map(c => c.model),
        finalError: lastError.message
    });
    throw lastError;
}

export class AIChatHandler {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            await memoryManager.initialize();
            this.initialized = true;
        }
    }

    async handleMessage(userId, userInput, mode = CHAT_MODES.TALK) {
        try {
            await this.initialize();
            const conversationHistory = await memoryManager.formatMemoryForAI(userId, mode);
            const prompt = getPromptForMode(mode, userInput);
            try {
                await memoryManager.addMemory(userId, "user", userInput);
                const content = {
                    role: "user",
                    parts: [{
                        text: `${prompt.context}

Chat History:
${conversationHistory}

User: ${userInput}`
                    }],
                    generationConfig: {
                        maxOutputTokens: config.app.maxResponseTokens,
                        temperature: config.app.temperature,
                    }
                };
                const result = await tryModels(content);
                if (!result || !result.response) {
                    throw new Error("No valid response from any model");
                }
                const response = await result.response;
                let responseText = response.text();
                responseText = responseText.replace(/^Assistant:\s*/i, '').trim();
                await memoryManager.addMemory(userId, "assistant", responseText);
                return responseText;
            } catch (genError) {
                logger.error('AI Generation Error:', {
                    error: genError.message,
                    userId: userId,
                    mode: mode,
                    modelAttempts: MODEL_CONFIGS.length
                });
                if (genError.message.includes('API key')) {
                    return "Maaf, terjadi masalah dengan konfigurasi sistem. Mohon hubungi admin untuk bantuan. 🔑";
                }
                if (genError.message.includes('quota') || genError.message.includes('rate')) {
                    return "Maaf, sistem sedang sibuk. Mohon tunggu beberapa saat sebelum mencoba lagi. ⏳";
                }
                return "Maaf, terjadi kesalahan dalam memproses permintaan Anda. Mohon coba lagi dalam beberapa saat. 🙏";
            }
        } catch (error) {
            console.error('Error in AI chat:', error);
            return "Maaf, terjadi kesalahan. Mohon coba lagi dalam beberapa saat. 🙏";
        }
    }

    clearHistory(userId) {
        this.chats.delete(userId);
    }
}

export const aiChatHandler = new AIChatHandler();

