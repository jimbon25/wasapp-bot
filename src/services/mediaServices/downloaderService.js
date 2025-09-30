import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import sqlite3 from 'sqlite3';
import logger from '../../utils/common/logger.js';
import { generateCacheKey } from '../../utils/common/urlHasher.js';
import fileManager, { FILE_TYPES } from '../../utils/fileManagement/fileManager.js';
import config from '../../config.js';
import InstagramAccountManager from '../../utils/instagram/instagramAccountManager.js';
import InstagramCacheManager from '../../utils/instagram/instagramCacheManager.js';
import { detectInstagramError, shouldRotateAccount, getErrorMessage } from '../../utils/instagram/instagramErrorHandler.js';

class DownloaderService {
    constructor() {
        this.instagramManager = new InstagramAccountManager(config.instagram.accounts);
        this.cacheManager = new InstagramCacheManager(config.app.tempDir);
    }

    async _getSocialMediaCookies(domain) {
        const cookieDbPath = config.app.firefoxCookieDbPath;
        if (!cookieDbPath) {
            logger.warn('FIREFOX_COOKIE_DB_PATH is not configured in .env. Skipping Firefox cookie extraction.');
            return null;
        }
        const tempDir = os.tmpdir();
        const tempDbPath = path.join(tempDir, `wa_bot_cookies_${Date.now()}.sqlite`);
        const tempCookieTxtPath = path.join(tempDir, `wa_bot_cookies_${Date.now()}.txt`);

        try {
            await fs.access(cookieDbPath);
        } catch (error) {
            logger.warn(`Firefox cookie database not found at ${cookieDbPath}. Skipping cookie extraction.`);
            return null;
        }

        try {
            await fs.copyFile(cookieDbPath, tempDbPath);
            const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY);
            const dbAll = (query, params) => {
                return new Promise((resolve, reject) => {
                    db.all(query, params, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
            };

            const rows = await dbAll(
                "SELECT host, path, isSecure, expiry, name, value FROM moz_cookies WHERE host LIKE ?",
                [`%${domain}`]
            );
            db.close();

            if (!rows || rows.length === 0) {
                logger.warn('No Instagram cookies found in Firefox DB.');
                await fs.unlink(tempDbPath);
                return null;
            }

            const cookieFileContent = rows.map(row => {
                return `${row.host}\tTRUE\t${row.path}\t${row.isSecure ? 'TRUE' : 'FALSE'}\t${row.expiry}\t${row.name}\t${row.value}`;
            }).join('\n');

            await fs.writeFile(tempCookieTxtPath, "# Netscape HTTP Cookie File\n" + cookieFileContent);
            logger.info(`Instagram cookies extracted to ${tempCookieTxtPath}`);
            await fs.unlink(tempDbPath);
            return tempCookieTxtPath;

        } catch (error) {
            logger.error('Failed to extract Firefox cookies:', error);
            await fs.unlink(tempDbPath).catch(() => {});
            await fs.unlink(tempCookieTxtPath).catch(() => {});
            return null;
        }
    }

    async download(url) {
        const tempDir = fileManager.getPath(FILE_TYPES.TEMP);
        const cacheKey = generateCacheKey(url);
        const cacheFilePath = path.join(tempDir, `${cacheKey}.mp4`);

        try {
            const stats = await fs.stat(cacheFilePath);
            if (stats.isFile()) {
                logger.info(`File found in cache: ${cacheFilePath}`);
                return cacheFilePath;
            }
        } catch (error) {
            logger.info(`File not found in cache, downloading: ${url}`);
        }

        return new Promise(async (resolve, reject) => {
            const predictableFilePath = cacheFilePath;

            const ytdlpArgs = [
                '--no-warnings',
                '--ignore-errors',
                '-f', 'best[ext=mp4]/best',
                '--max-filesize', '50M',
                '--socket-timeout', '30',
                '--rate-limit', '500K',
                '--sleep-interval', '5',
                '--max-sleep-interval', '10',
                '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
            ];

            let cookieFilePath = null;

            const isInstagramUrl = /instagram\.com/.test(url);
            const isTikTokUrl = /tiktok\.com/.test(url);

            if (isInstagramUrl) {
                logger.info('Instagram URL detected. Attempting with account rotation...');
                let currentAccount = this.instagramManager.getCurrentAccount();
                let retryCount = 0;
                let lastError = null;

                while (retryCount < config.instagram.rotation.maxRetries) {
                    try {
                        cookieFilePath = await this._getSocialMediaCookies('instagram.com');
                        if (cookieFilePath) {
                            ytdlpArgs.push('--cookies', cookieFilePath);
                        } else {
                            ytdlpArgs.push('--username', currentAccount.username);
                            ytdlpArgs.push('--password', currentAccount.password);
                        }

                        logger.info(`Attempting download with Instagram account: ${currentAccount.username}`);
                        break;

                    } catch (error) {
                        const errorType = detectInstagramError(error);
                        lastError = error;

                        if (shouldRotateAccount(errorType)) {
                            this.instagramManager.markAccountError(currentAccount.index, errorType);
                            currentAccount = this.instagramManager.getNextAvailableAccount();

                            if (currentAccount.waitTime > 0) {
                                logger.info(`Waiting ${currentAccount.waitTime}ms before using next account`);
                                await new Promise(resolve => setTimeout(resolve, currentAccount.waitTime));
                            }

                            retryCount++;
                            continue;
                        }
                        break;
                    }
                }

                if (retryCount >= config.instagram.rotation.maxRetries) {
                    throw new Error('Semua akun Instagram sedang dalam cooldown. Silakan coba lagi nanti.');
                }
            } else if (isTikTokUrl) {
                logger.info('TikTok URL detected. Attempting to use Firefox cookies.');
                cookieFilePath = await this._getSocialMediaCookies('tiktok.com');
                
                ytdlpArgs.push(
                    '--referer', 'https://www.tiktok.com/',
                    '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
                );
            }

            if (url.includes('/stories/')) {
                logger.info('Instagram Story URL detected. Applying --no-playlist option.');
                ytdlpArgs.push('--no-playlist');
            }

            ytdlpArgs.push('-o', predictableFilePath, url);

            logger.info(`Spawning yt-dlp. Output will be at: ${predictableFilePath}`);

            const ytdlpProcess = spawn('yt-dlp', ytdlpArgs);

            let stderrOutput = '';

            ytdlpProcess.stdout.on('data', (data) => {
                logger.info(`[yt-dlp stdout]: ${data.toString().trim()}`);
            });

            ytdlpProcess.stderr.on('data', (data) => {
                stderrOutput += data.toString();
            });

            ytdlpProcess.on('close', async (code) => {
                if (cookieFilePath) {
                    fs.unlink(cookieFilePath).catch(err => logger.error(`Failed to delete temp cookie file ${cookieFilePath}:`, err));
                }

                if (code === 0 && isInstagramUrl) {
                    const currentAccount = this.instagramManager.getCurrentAccount();
                    this.instagramManager.markAccountSuccess(currentAccount.index);
                }

                if (code === 0) {
                    fs.access(predictableFilePath)
                        .then(() => {
                            logger.info(`Download successful. File is at the predictable path: ${predictableFilePath}`);
                            resolve(predictableFilePath);
                        })
                        .catch(err => {
                            logger.error(`Download process exited successfully, but the output file was not found at the predictable path: ${predictableFilePath}`, err);
                            reject(new Error('Download succeeded but the output file is missing.'));
                        });
                } else {
                    logger.error(`yt-dlp process exited with code ${code}. Stderr: ${stderrOutput}`);
                    reject(new Error(`Download failed. yt-dlp error: ${stderrOutput.split('\n').filter(line => line.toLowerCase().includes('error')).join(' ')}`));
                }
            });

            ytdlpProcess.on('error', (err) => {
                logger.error('Failed to spawn yt-dlp process:', err);
                reject(new Error('Failed to start the download process. Is yt-dlp installed correctly?'));
            });
        });
    }
}

export default new DownloaderService();
