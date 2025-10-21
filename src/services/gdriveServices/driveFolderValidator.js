import logger from '../../utils/common/logger.js';
import googleDriveService from './googleDriveService.js';

class DriveFolderValidator {
    async isFolderExists(folderId) {
        try {
            const { client: drive } = await googleDriveService._getDriveClient();
            await drive.files.get({
                fileId: folderId,
                fields: 'id, name, trashed'
            });
            return true;
        } catch (error) {
            if (error.code === 404 || (error.response && error.response.status === 404)) {
                return false;
            }
            logger.error('Error checking folder existence:', error);
            return true;
        }
    }

    async validateFolders(userFolders) {
        try {
            const validFolders = [];
            
            for (const folder of userFolders) {
                const exists = await this.isFolderExists(folder.folderId);
                if (exists) {
                    validFolders.push(folder);
                } else {
                    logger.info(`Folder ${folder.folderName} (${folder.folderId}) no longer exists in Drive`);
                }
            }
            
            return validFolders;
        } catch (error) {
            logger.error('Error validating folders:', error);
            return userFolders;
        }
    }
}

export const driveFolderValidator = new DriveFolderValidator();