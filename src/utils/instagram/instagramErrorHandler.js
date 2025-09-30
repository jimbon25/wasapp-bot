const INSTAGRAM_ERRORS = {
    // Rate limit related errors
    RATE_LIMITED: {
        type: 'rate_limited',
        patterns: [
            /rate limited/i,
            /too many requests/i,
            /try again later/i
        ]
    },
    
    // Authentication related errors
    AUTH_FAILED: {
        type: 'auth_failed',
        patterns: [
            /login required/i,
            /authentication required/i,
            /login failed/i,
            /invalid credentials/i
        ]
    },
    
    // Account blocked or restricted
    ACCOUNT_BLOCKED: {
        type: 'account_blocked',
        patterns: [
            /account.*blocked/i,
            /account.*restricted/i,
            /account.*suspended/i,
            /unusual activity/i
        ]
    },
    
    // Media not available
    MEDIA_UNAVAILABLE: {
        type: 'media_unavailable',
        patterns: [
            /media.*not.*available/i,
            /content.*removed/i,
            /page.*private/i
        ]
    }
};

export function detectInstagramError(error) {
    const errorMessage = error.toString().toLowerCase();
    
    for (const [errorKey, errorData] of Object.entries(INSTAGRAM_ERRORS)) {
        if (errorData.patterns.some(pattern => pattern.test(errorMessage))) {
            return errorData.type;
        }
    }
    
    return 'unknown';
}

export function shouldRotateAccount(errorType) {
    return ['rate_limited', 'auth_failed', 'account_blocked'].includes(errorType);
}

export function getErrorMessage(errorType) {
    switch (errorType) {
        case 'rate_limited':
            return 'Akun Instagram sedang dibatasi. Mencoba dengan akun lain...';
        case 'auth_failed':
            return 'Gagal login ke Instagram. Mencoba dengan akun lain...';
        case 'account_blocked':
            return 'Akun Instagram diblokir sementara. Mencoba dengan akun lain...';
        case 'media_unavailable':
            return 'Media tidak tersedia atau bersifat private.';
        default:
            return 'Terjadi kesalahan yang tidak diketahui.';
    }
}

export default {
    INSTAGRAM_ERRORS,
    detectInstagramError,
    shouldRotateAccount,
    getErrorMessage
};