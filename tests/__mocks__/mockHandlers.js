const commandHandler = {
    commands: new Map(),
    handleMessage: async (message) => {
        if (!message.body.startsWith('/')) {
            return { handled: false, reason: 'not-command' };
        }

        const commandName = message.body.slice(1).split(' ')[0];
        
        if (!commandHandler.commands.has(commandName)) {
            return { handled: false, reason: 'command-not-found' };
        }

        const command = commandHandler.commands.get(commandName);

        if (command.adminOnly) {
            const isAdmin = await SecurityManager.isAuthorized(message.from, 'admin');
            if (!isAdmin) {
                await message.reply('❌ Anda tidak memiliki izin untuk menggunakan perintah ini.');
                return { handled: false, reason: 'unauthorized' };
            }
        }

        if (command.requiredPermissions) {
            for (const permission of command.requiredPermissions) {
                const hasPermission = await SecurityManager.hasPermission(message.from, permission);
                if (!hasPermission) {
                    await message.reply('❌ Anda tidak memiliki izin yang diperlukan untuk perintah ini.');
                    return { handled: false, reason: 'permission-denied' };
                }
            }
        }

        try {
            if (command.error) {
                throw command.error;
            }

            await command.execute(message, message.body.slice(commandName.length + 2).split(' ').filter(Boolean));
            return { handled: true, command: commandName };
        } catch (error) {
            await message.reply('Maaf, terjadi kesalahan saat menjalankan perintah tersebut.');
            return { handled: false, reason: 'error', error: error.message };
        }
    }
};

const SecurityManager = {
    isAuthorized: async () => false,
    hasPermission: async () => false
};

module.exports = {
    commandHandler,
    SecurityManager
};