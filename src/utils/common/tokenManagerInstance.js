import { TokenManager } from './tokenManager.js';
import EncryptionUtil from './encryptionUtil.js';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_CREDENTIALS_DIR = path.join(__dirname, '../../data/credentials');
const CREDENTIALS_DIR = {
    gmail: path.join(process.cwd(), 'src', 'data', 'credentials', 'gmailCredentials'),
    drive: BASE_CREDENTIALS_DIR
};

const encryptionUtil = new EncryptionUtil(config.mega.credentialsSecret);

const tokenManager = {
    gmail: new TokenManager(CREDENTIALS_DIR.gmail, encryptionUtil),
    drive: new TokenManager(CREDENTIALS_DIR.drive, encryptionUtil)
};

export default tokenManager;