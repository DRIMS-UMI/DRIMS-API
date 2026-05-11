import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';

const mongoURI = process.env.DATABASE_URL;

// Create a connection to MongoDB
export const conn = mongoose.createConnection(mongoURI);

// Initialize GridFS
let gfs;
conn.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads',
  });
});

export { gfs };

import { validateStatusTransition } from './statusValidator.js';

/**
 * Prisma client instance
 * @type {PrismaClient}
 */
const basePrisma = new PrismaClient();

const prisma = basePrisma.$extends({
  query: {
    studentStatus: {
      async create({ args, query }) {
        const data = args.data;
        // Only validate if we are creating a current status (defaults to true if undefined)
        if (data.isCurrent !== false) {
          const studentId = data.student?.connect?.id || data.studentId;
          const definitionId = data.definition?.connect?.id || data.definitionId;

          if (studentId && definitionId) {
            const currentStatus = await basePrisma.studentStatus.findFirst({
              where: { studentId: studentId },
              orderBy: { createdAt: 'desc' },
              include: { definition: true }
            });

            const newDefinition = await basePrisma.statusDefinition.findUnique({
              where: { id: definitionId }
            });

            if (currentStatus?.definition && newDefinition) {
              validateStatusTransition(currentStatus.definition, newDefinition);
            }
          }
        }
        return query(args);
      }
    }
  }
});

export default prisma;