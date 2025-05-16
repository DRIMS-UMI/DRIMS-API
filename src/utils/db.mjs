import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';

const mongoURI = process.env.DATABASE_URL;

// Create a connection to MongoDB
export const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Initialize GridFS
let gfs;
conn.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads',
  });
});

export { gfs };

/**
 * Prisma client instance
 * @type {PrismaClient}
 */
const prisma = new PrismaClient();
export default prisma;