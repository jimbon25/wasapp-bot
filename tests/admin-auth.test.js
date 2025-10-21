const SecurityManager = require('../src/utils/securityManager');
const config = require('../src/config');

describe('SecurityManager Admin Authentication', () => {
    let securityManager;
    const testAdminNumber = '62812345678@c.us';

    beforeEach(() => {
        config.adminNumbers = [testAdminNumber];
        securityManager = new SecurityManager();
    });

    test('should recognize configured admin number', () => {
        expect(securityManager.isAdmin(testAdminNumber)).toBe(true);
    });

    test('should reject non-admin number', () => {
        expect(securityManager.isAdmin('6281234567890@c.us')).toBe(false);
    });

    test('should properly handle empty admin list', () => {
        config.adminNumbers = [];
        securityManager = new SecurityManager();
        expect(securityManager.isAdmin(testAdminNumber)).toBe(false);
    });

    test('should authorize admin for any role', async () => {
        const isAuthorized = await securityManager.isAuthorized(testAdminNumber, 'admin');
        expect(isAuthorized).toBe(true);
    });
});