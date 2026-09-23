import mongoose from 'mongoose';
import { conn } from './db.mjs';

const BUCKET_NAME = 'uploads';

const gridFSReady = new Promise((resolve) => {
  if (conn.readyState === 1) {
    resolve();
  } else {
    conn.once('open', resolve);
  }
});

const getBucket = () => new mongoose.mongo.GridFSBucket(conn.db, { bucketName: BUCKET_NAME });

export const storeFileToGridFS = async (buffer, { filename, contentType, metadata = {} }) => {
  await gridFSReady;
  return new Promise((resolve, reject) => {
    const uploadStream = getBucket().openUploadStream(filename, { contentType, metadata });
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
};

export const openGridFSStream = async (fileId) => {
  await gridFSReady;
  return getBucket().openDownloadStream(new mongoose.Types.ObjectId(fileId));
};

export const deleteFromGridFS = async (fileId) => {
  await gridFSReady;
  await getBucket().delete(new mongoose.Types.ObjectId(fileId));
};

export { gridFSReady };