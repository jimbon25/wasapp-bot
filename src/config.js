import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
  env: process.env.NODE_ENV || 'development',
  admins: (process.env.ADMIN_NUMBERS || '').split(','),
  botNumber: process.env.BOT_NUMBER,
  sessionDir: process.env.WABOT_SESSION_DIR || './sessions',

  apis: {
    googleDrive: {
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      tokenPath: process.env.GOOGLE_DRIVE_TOKEN_PATH || join(__dirname, './data/credentials/token.json'),
      credentialsPath: process.env.GOOGLE_DRIVE_CREDENTIALS_PATH || join(__dirname, './data/credentials/credentials.json'),
      maxFileSize: parseInt(process.env.GOOGLE_DRIVE_MAX_FILE_SIZE, 10) || 100,
      uploadTimeout: parseInt(process.env.GOOGLE_DRIVE_UPLOAD_TIMEOUT, 10) || 300000,
      mimeTypes: (process.env.GOOGLE_DRIVE_MIME_TYPES || 'image/*,video/*,application/pdf').split(','),
      maxRetries: parseInt(process.env.GOOGLE_DRIVE_MAX_RETRIES, 10) || 3,
      retryDelay: parseInt(process.env.GOOGLE_DRIVE_RETRY_DELAY, 10) || 1000
    },
    gmail: {
      enabled: process.env.GMAIL_ENABLED === 'true',
      leaveAsUnread: process.env.GMAIL_LEAVE_AS_UNREAD === 'true',
      pollingInterval: parseInt(process.env.GMAIL_POLLING_INTERVAL_SECONDS, 10) || 60,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      topicName: process.env.GMAIL_PUBSUB_TOPIC_NAME,
      subscriptionName: process.env.GMAIL_PUBSUB_SUBSCRIPTION_NAME,
      notifiedIdExpiryDays: parseInt(process.env.GMAIL_NOTIFIED_ID_EXPIRY_DAYS, 10) || 30,
      credentialsBaseDir: process.env.GMAIL_CREDENTIALS_BASE_DIR || join(__dirname, './data/credentials'),
      credentialsDir: process.env.GMAIL_CREDENTIALS_DIR || join(__dirname, './data/credentials/gmailCredentials'),
      sharedCredentialsPath: process.env.GMAIL_SHARED_CREDENTIALS_PATH || join(__dirname, './data/credentials/gmailCredentials/credentials-gmail-all.json'),
      pubsubKeyPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || join(__dirname, './data/credentials/gmailCredentials/wabot-pubsub-key.json'),
      accounts: (() => {
        try {
          const jsonPath = join(__dirname, './data/credentials/gmailCredentials/gmail_accounts.json');
          const jsonData = fs.readFileSync(jsonPath, 'utf8');
          const jsonAccounts = JSON.parse(jsonData);
          if (Array.isArray(jsonAccounts) && jsonAccounts.length > 0) {
            return jsonAccounts;
          }
        } catch (error) {
          // Ignore error if file doesn't exist or is invalid
        }

        // Return an empty array if JSON is not found or is empty
        return [];
      })(),
    },
    jikan: {
      baseUrl: process.env.JIKAN_API_URL || 'https://api.jikan.moe/v4',
      cache: {
        prefix: process.env.ANIME_CACHE_PREFIX || 'anime:',
        ttl: parseInt(process.env.ANIME_CACHE_TTL || '86400', 10)
      }
    },
  },

  mega: {
    email: process.env.MEGA_EMAIL,
    password: process.env.MEGA_PASSWORD,
    uploadFolder: process.env.MEGA_UPLOAD_FOLDER || '/Root/WabotUploads/',
    credentialsSecret: process.env.MEGA_CREDENTIALS_SECRET
  },

  system: {
    memory: {
      filePath: process.env.MEMORY_FILE_PATH || 'memoryAI/chathistory.json',
      prefix: process.env.CHAT_HISTORY_PREFIX || 'chat_history:',
      maxHistory: parseInt(process.env.MAX_CHAT_HISTORY, 10) || 25,
      backupDelay: parseInt(process.env.MEMORY_BACKUP_DELAY, 10) || 10000
    },
    cleanup: {
      retention: {
        temp: parseInt(process.env.TEMP_RETENTION_PERIOD, 10) || 24 * 60 * 60 * 1000,
        docs: parseInt(process.env.DOCS_RETENTION_PERIOD, 10) || 7 * 24 * 60 * 60 * 1000,
        media: parseInt(process.env.MEDIA_RETENTION_PERIOD, 10) || 3 * 24 * 60 * 60 * 1000
      },
      intervals: {
        temp: parseInt(process.env.TEMP_CLEANUP_INTERVAL, 10) || 60 * 60 * 1000,
        docs: parseInt(process.env.DOCS_CLEANUP_INTERVAL, 10) || 24 * 60 * 60 * 1000,
        media: parseInt(process.env.MEDIA_CLEANUP_INTERVAL, 10) || 12 * 60 * 60 * 1000
      }
    }
  },

  security: {
    messageLimiter: {
      maxRequests: 30,
      windowMs: 60000, // 1 minute
      capacity: parseInt(process.env.MESSAGE_LIMITER_CAPACITY, 10) || 60,
      refillRate: parseFloat(process.env.MESSAGE_LIMITER_REFILL_RATE) || 1,
      refillInterval: parseInt(process.env.MESSAGE_LIMITER_REFILL_INTERVAL, 10) || 1000,
    },
    // Command rate limiting
    commandLimiter: {
      maxRequests: 10,
      windowMs: 60000, // 1 minute
      capacity: parseInt(process.env.COMMAND_LIMITER_CAPACITY, 10) || 30,
      refillRate: parseFloat(process.env.COMMAND_LIMITER_REFILL_RATE) || 1,
      refillInterval: parseInt(process.env.COMMAND_LIMITER_REFILL_INTERVAL, 10) || 1000,
    },
    // Virtex detection settings
    virtex: {
      whitelistedCommands: (process.env.WHITELISTED_COMMANDS || '/text2pdf,/ask,/translate').split(','),
      maxWhitelistedLength: parseInt(process.env.MAX_WHITELISTED_LENGTH || '5000', 10),
      maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '1000', 10),
      maxEmojiRatio: parseFloat(process.env.MAX_EMOJI_RATIO || '0.3'),
      maxRepeatedChars: parseInt(process.env.MAX_REPEATED_CHARS || '10', 10),
    },
    // Group moderation
    groupWarningThreshold: 3,
    // Auto-Mute Configuration
    autoMute: {
      warningThreshold: parseInt(process.env.MODERATION_MUTE_WARNING_THRESHOLD, 10) || 3,
      durationSeconds: parseInt(process.env.MODERATION_MUTE_DURATION_SECONDS, 10) || 300,
    },
    // AI Command Limiter
    aiCommandLimiter: {
      capacity: parseInt(process.env.AI_COMMAND_LIMITER_CAPACITY, 10) || 10,
      refillRate: parseFloat(process.env.AI_COMMAND_LIMITER_REFILL_RATE) || 0.2,
      refillInterval: parseInt(process.env.AI_COMMAND_LIMITER_REFILL_INTERVAL, 10) || 1000,
    },
    // Translate Limiter
    translateLimiter: {
      capacity: parseInt(process.env.TRANSLATE_LIMITER_CAPACITY, 10) || 20,
      refillRate: parseFloat(process.env.TRANSLATE_LIMITER_REFILL_RATE) || 0.5,
      refillInterval: parseInt(process.env.TRANSLATE_LIMITER_REFILL_INTERVAL, 10) || 1000,
    },
    // Command Cooldowns
    cooldowns: {
      default: parseInt(process.env.COOLDOWN_DEFAULT, 10) || 1000,
      ai: parseInt(process.env.COOLDOWN_AI, 10) || 5000,
      media: parseInt(process.env.COOLDOWN_MEDIA, 10) || 10000,
      translate: parseInt(process.env.COOLDOWN_TRANSLATE, 10) || 2000,
    },
  },

  redis: {
    // Connection Settings
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined, // Use undefined if no password
    maxRetryTime: parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) || 300000, // Max time for Redis connection retries (in milliseconds)
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 10, // Max number of Redis connection retry attempts
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 15000, // Redis connection timeout (in milliseconds)

    // Queue & Cache Settings
    queueMaxLength: parseInt(process.env.REDIS_QUEUE_MAX_LENGTH, 10) || 1000, // Max length for Redis-backed message queues
    cacheTtl: parseInt(process.env.REDIS_CACHE_TTL, 10) || 3600, // Default TTL for Redis cache entries (in seconds)
    sessionBackupInterval: parseInt(process.env.REDIS_SESSION_BACKUP_INTERVAL, 10) || 300, // Interval for session backups to Redis (in seconds)

    // Rate Limit Settings (for Redis-based rate limiting)
    rateLimitThreshold: parseInt(process.env.REDIS_RATE_LIMIT_THRESHOLD, 10) || 80, // Threshold (%) for switching to Redis rate limiting
    rateLimitWindow: parseInt(process.env.REDIS_RATE_LIMIT_WINDOW, 10) || 60000, // Window for Redis rate limiting (in milliseconds)
    rateLimitMax: parseInt(process.env.REDIS_RATE_LIMIT_MAX, 10) || 100, // Max requests within the rate limit window

    // Performance Monitoring Thresholds (for Redis health checks)
    memoryThreshold: parseInt(process.env.REDIS_MEMORY_THRESHOLD, 10) || 80, // Redis memory usage threshold (as percentage)
    cpuThreshold: parseInt(process.env.REDIS_CPU_THRESHOLD, 10) || 80,     // Redis CPU usage threshold (as percentage)
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN, // Telegram Bot API Token
    chatId: process.env.TELEGRAM_CHAT_ID,     // Telegram Chat ID for notifications
    enabled: process.env.TELEGRAM_NOTIFICATIONS_ENABLED === 'true', // Enable/disable Telegram notifications
    notifyLevels: (process.env.TELEGRAM_NOTIFY_LEVELS || 'error,warn').split(','), // Comma-separated notification levels (e.g., 'error,warn,info')
  },

  apiKeys: {
    gemini: process.env.GEMINI_API_KEY,       // Google Gemini API Key for AI features
    removebg: process.env.REMOVEBG_API_KEY,   // Remove.bg API Key for background removal
  },

  app: {
    environment: process.env.NODE_ENV || 'development', // Application environment (e.g., 'development', 'production')

    // AI Chat Settings (for Gemini integration)
    maxResponseTokens: parseInt(process.env.MAX_RESPONSE_TOKENS, 10) || 1000, // Max tokens for AI responses
    temperature: parseFloat(process.env.TEMPERATURE) || 0.8, // AI model temperature (creativity)
    geminiModels: (process.env.GEMINI_MODELS || 'models/gemini-1.5-flash').split(',').filter(m => m).map(m => m.trim()), // Comma-separated list of Gemini models to use

    // Proactive AI Chatbot Mode
    proactive: {
      enabled: process.env.AI_PROACTIVE_MODE_ENABLED === 'true',
      idleTimeout: parseInt(process.env.AI_PROACTIVE_IDLE_TIMEOUT_MINUTES, 10) || 15,
    },

    // Auto Upload Feature
    autoUpload: {
      enabled: !!process.env.AUTO_UPLOAD_GROUP_IDS,
      groupIds: (process.env.AUTO_UPLOAD_GROUP_IDS || '').split(',').map(id => id.trim()).filter(id => id),
      debounceSeconds: parseInt(process.env.AUTO_UPLOAD_DEBOUNCE_SECONDS, 10) || 30
    },

    // Directory Settings
    baseDir: process.env.BASE_DIR || process.cwd(), // Base directory for the application
    logDir: process.env.LOG_DIR || join(__dirname, '../logs'), // Directory for application logs
    tempDir: process.env.TEMP_DIR || join(__dirname, '../temp'), // Directory for temporary files
    mediaDir: process.env.MEDIA_DIR || join(__dirname, '../media'), // Directory for all media files
    sessionsDir: process.env.WABOT_SESSION_DIR || join(__dirname, '../sessions'), // Directory for WhatsApp session data
    firefoxCookieDbPath: process.env.FIREFOX_COOKIE_DB_PATH, // Path to Firefox cookie database

    // Service-Specific Settings
    translation: {
      cacheDuration: parseInt(process.env.TRANSLATION_CACHE_DURATION, 10) || 3600, // Cache duration for translation results (in seconds)
    },
    prayer: {
      apiUrl: process.env.MYQURAN_API_URL || 'https://api.myquran.com/v2/sholat', // API URL for prayer times
      cacheDuration: parseInt(process.env.PRAYER_TIMES_CACHE_DURATION, 10) || 3600, // Cache duration for prayer times (in seconds)
    },
    sticker: {
      tempDir: process.env.STICKER_TEMP_DIR || join(__dirname, '../temp'), // Temporary directory for sticker creation
    },
    wikipedia: {
      apiUrl: process.env.WIKIPEDIA_API_URL || 'https://id.wikipedia.org/w/api.php',
    },

    // Puppeteer Configurations (for whatsapp-web.js)
    puppeteer: {
      headless: process.env.HEADLESS === 'false' ? false : true, // Run Chromium in headless mode
      args: (process.env.CHROME_ARGS || '').split(',').filter(arg => arg), // Additional Chromium command-line arguments
      executablePath: process.env.CHROME_BIN || undefined, // Path to Chromium executable (if not using default)
    },
  },

  instagram: {
    // Instagram Accounts (up to 4 accounts for rotation)
    accounts: [
      { username: process.env.INSTAGRAM_ACCOUNT_1_USERNAME, password: process.env.INSTAGRAM_ACCOUNT_1_PASSWORD },
      { username: process.env.INSTAGRAM_ACCOUNT_2_USERNAME, password: process.env.INSTAGRAM_ACCOUNT_2_PASSWORD },
      { username: process.env.INSTAGRAM_ACCOUNT_3_USERNAME, password: process.env.INSTAGRAM_ACCOUNT_3_PASSWORD },
      { username: process.env.INSTAGRAM_ACCOUNT_4_USERNAME, password: process.env.INSTAGRAM_ACCOUNT_4_PASSWORD }
    ].filter(acc => acc.username && acc.password), // Filter out accounts without both username and password

    // Account Rotation and Cooldown Settings
    rotation: {
      retryDelay: parseInt(process.env.INSTAGRAM_RETRY_DELAY, 10) || 5000, // Delay between retries (in milliseconds)
      maxRetries: parseInt(process.env.INSTAGRAM_MAX_RETRIES, 10) || 4, // Maximum number of retries across all accounts
      cooldowns: {
        rateLimited: parseInt(process.env.INSTAGRAM_COOLDOWN_RATE_LIMITED, 10) || 1800000, // Cooldown for rate limits (30 minutes)
        authFailed: parseInt(process.env.INSTAGRAM_COOLDOWN_AUTH_FAILED, 10) || 3600000,  // Cooldown for authentication failures (1 hour)
        blocked: parseInt(process.env.INSTAGRAM_COOLDOWN_BLOCKED, 10) || 86400000,        // 24 hours
        default: parseInt(process.env.INSTAGRAM_COOLDOWN_DEFAULT, 10) || 300000           // Default cooldown (5 minutes)
      }
    }
  },

  adminNumbers: process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',') : [],

  // Removed duplicate security configuration

  services: {
    sticker: {
      cleanupInterval: parseInt(process.env.STICKER_CLEANUP_INTERVAL, 10) || 3600000, // 1 hour in milliseconds
      maxFileAge: parseInt(process.env.STICKER_MAX_FILE_AGE, 10) || 86400000, // 24 hours in milliseconds
    },
    removebg: {
      apiUrl: process.env.REMOVEBG_API_URL || 'https://api.remove.bg/v1.0/removebg',
      supportedFormats: (process.env.REMOVEBG_SUPPORTED_FORMATS || 'image/jpeg,image/png').split(','),
    },
  },

  files: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 16 * 1024 * 1024, // Maximum allowed file size for uploads (default 16MB in bytes)
    allowedImageTypes: (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(','), // Comma-separated allowed image MIME types
    allowedDocTypes: (process.env.ALLOWED_DOC_TYPES || 'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document').split(','), // Comma-separated allowed document MIME types
    limits: {
      document: {
        pdf: parseInt(process.env.MAX_PDF_SIZE, 10) || 10 * 1024 * 1024,
        word: parseInt(process.env.MAX_WORD_SIZE, 10) || 10 * 1024 * 1024,
        excel: parseInt(process.env.MAX_EXCEL_SIZE, 10) || 10 * 1024 * 1024,
        default: parseInt(process.env.MAX_DOC_SIZE, 10) || 10 * 1024 * 1024
      },
      image: {
        jpeg: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 5 * 1024 * 1024,
        png: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 5 * 1024 * 1024,
        gif: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 5 * 1024 * 1024,
        default: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 5 * 1024 * 1024
      },
      video: {
        mp4: parseInt(process.env.MAX_VIDEO_SIZE, 10) || 15 * 1024 * 1024,
        default: parseInt(process.env.MAX_VIDEO_SIZE, 10) || 15 * 1024 * 1024
      },
      audio: {
        mp3: parseInt(process.env.MAX_AUDIO_SIZE, 10) || 5 * 1024 * 1024,
        default: parseInt(process.env.MAX_AUDIO_SIZE, 10) || 5 * 1024 * 1024
      }
    },
    cleanupInterval: parseInt(process.env.FILE_CLEANUP_INTERVAL, 10) || 3600000, // Interval for general file cleanup (in milliseconds, 1 hour)
    tempFileMaxAge: parseInt(process.env.TEMP_FILE_MAX_AGE, 10) || 86400000, // Maximum age for temporary files before cleanup (in milliseconds, 24 hours)
    // Instagram Cache Cleanup Settings
    instagramCache: {
      cleanupInterval: parseInt(process.env.INSTAGRAM_CACHE_CLEANUP_INTERVAL, 10) || 600000, // Interval for Instagram cache cleanup (in milliseconds, 10 minutes)
      maxAge: parseInt(process.env.INSTAGRAM_CACHE_MAX_AGE, 10) || 600000 // Maximum age for Instagram cache files (in milliseconds, 10 minutes)
    }
  },
};

export default config;
