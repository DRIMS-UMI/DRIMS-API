import express from 'express';
import requireBackupIngestKey from '../middleware/backupIngestAuth.js';
import { ingestBackupRuns } from '../controllers/backupIngestController.js';

const router = express.Router();

// Machine-to-machine endpoints for jobs running on the droplet (not for browsers).

// Called by mongodb_backup.sh after every run, and by `mongodb_backup.sh --sync` to backfill history.csv
router.post('/backups/ingest', requireBackupIngestKey, ingestBackupRuns);

export default router;
