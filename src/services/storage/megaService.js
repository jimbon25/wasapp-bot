import { Storage } from 'megajs';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/common/logger.js';
import config from '../../config.js';

class MegaService {

    async uploadFile(filePath, remoteFileName, credentials) {
        if (!credentials || !credentials.email || !credentials.password) {
            throw new Error('Mega.nz credentials are required but were not provided.');
        }

        let storage;
        try {
            storage = await new Storage({
                email: credentials.email,
                password: credentials.password
            }).ready;
        } catch (error) {
            logger.error('Failed to login to Mega.nz with provided credentials:', error);
            throw new Error('Gagal login ke Mega.nz. Periksa kembali email dan password Anda melalui `/mega account`.');
        }

        try {
            const uploadFolder = config.mega.uploadFolder || '/Root/';
            let uploadTarget = storage.root;

            // Navigate to the target upload folder if specified
            if (uploadFolder && uploadFolder !== '/Root/') {
                const parts = uploadFolder.split('/').filter(p => p && p !== 'Root');
                for (const part of parts) {
                    let child = uploadTarget.children.find(c => c.name === part);
                    if (!child) {
                        child = await uploadTarget.mkdir(part);
                    }
                    uploadTarget = child;
                }
            }

            const fileName = remoteFileName || path.basename(filePath);
            logger.info(`Uploading file "${fileName}" to Mega.nz folder "${uploadTarget.name}" for user ${credentials.email}...`);

            const fileStream = fs.createReadStream(filePath);
            const uploadedFile = await uploadTarget.upload({
                name: fileName,
                size: fs.statSync(filePath).size
            }, fileStream).complete;

            const link = await uploadedFile.link(false);

            logger.info(`File ${fileName} uploaded successfully to Mega.nz.`);
            return {
                name: uploadedFile.name,
                size: uploadedFile.size,
                link: link,
                folder: uploadTarget.name
            };
        } catch (error) {
            logger.error('Failed to upload file to Mega.nz:', error);
            if (error.message.includes('ESID')) {
                 throw new Error('Sesi Mega.nz berakhir. Coba lagi.');
            }
            if (error.message.includes('EFAILED')) {
                throw new Error('Upload Mega.nz gagal. File mungkin kosong atau rusak.');
            }
            if (error.message.includes('EAGAIN')) {
                throw new Error('Server Mega.nz sedang sibuk. Silakan coba lagi dalam beberapa saat.');
            }
            throw new Error('Terjadi kesalahan tak terduga saat upload ke Mega.nz.');
        }
    }
}

const megaService = new MegaService();
export default megaService;