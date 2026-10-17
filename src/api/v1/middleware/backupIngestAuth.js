import crypto from 'crypto';
import { flagSecurityEvent } from '../../../utils/securityEvents.js';

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();

/**
 * Machine authentication for the backup script on the droplet. It sends BACKUP_INGEST_KEY
 * in the x-backup-key header. The key can only add backup records, so it is kept separate
 * from AUTH_SECRET and from any user login.
 */
function requireBackupIngestKey(req, res, next) {
    const expected = process.env.BACKUP_INGEST_KEY;
    if (!expected || expected.length < 32) {
        return res.status(503).json({ message: 'Backup ingest is not configured (BACKUP_INGEST_KEY missing or shorter than 32 characters)' });
    }
    const given = req.headers['x-backup-key'];
    if (!given || !crypto.timingSafeEqual(sha256(given), sha256(expected))) {
        flagSecurityEvent(req, given ? 'INVALID_TOKEN' : 'UNAUTHENTICATED');
        return res.status(401).json({ message: 'Invalid backup key' });
    }
    next();
}

// Lets the system report classify this route as machine-authenticated rather than public.
requireBackupIngestKey.isMachineAuthentication = true;

export default requireBackupIngestKey;
