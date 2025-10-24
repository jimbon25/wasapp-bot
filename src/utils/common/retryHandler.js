import logger from './logger.js';

export async function withRetry(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            logger.warn(`Attempt ${attempt}/${maxRetries} failed:`, {
                error: error.message,
                operation: operation.name
            });

            if (attempt < maxRetries) {
                const waitTime = delay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

// Contoh penggunaan:
/*
await withRetry(async () => {
    await saveToken(accountName, tokens);
}, 3, 1000);
*/