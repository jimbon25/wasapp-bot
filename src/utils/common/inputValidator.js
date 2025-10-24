export class InputValidator {
    static async validateAccountName(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Nama akun harus berupa teks');
        }
        
        if (name.length < 3 || name.length > 30) {
            throw new Error('Nama akun harus antara 3-30 karakter');
        }
        
        if (!/^[a-zA-Z0-9\s-]+$/.test(name)) {
            throw new Error('Nama akun hanya boleh mengandung huruf, angka, spasi, dan tanda hubung');
        }
        
        return name.trim();
    }

    static async validateDriveFolderId(folderId) {
        if (!folderId || typeof folderId !== 'string') {
            throw new Error('ID folder harus berupa teks');
        }

        if (!/^[a-zA-Z0-9_-]{20,100}$/.test(folderId)) {
            throw new Error('Format ID folder Google Drive tidak valid');
        }

        return folderId.trim();
    }

    static validateWhatsappNumbers(numbers) {
        if (!Array.isArray(numbers)) {
            numbers = numbers.split(',').map(n => n.trim());
        }

        return numbers.map(num => {
            let cleaned = num.replace(/\D/g, '');
            if (cleaned.startsWith('0')) {
                cleaned = '62' + cleaned.substring(1);
            }
            if (!/^62\d{9,13}$/.test(cleaned)) {
                throw new Error(`Nomor WhatsApp tidak valid: ${num}`);
            }
            return `${cleaned}@c.us`;
        });
    }
}