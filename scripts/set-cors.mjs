import { Storage } from '@google-cloud/storage';
import { readFileSync } from 'fs';

const SERVICE_ACCOUNT_PATH = new URL('./serviceAccountKey.json', import.meta.url);

const ORIGINS = [
  'https://timetowatch1.vercel.app',
  'https://tvtimeclone-dtcq.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const corsConfig = [
  {
    origin: ORIGINS,
    method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'x-goog-*'],
    maxAgeSeconds: 3600,
  },
];

const key = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
const storage = new Storage({ credentials: key });
const bucketName = key.project_id + '.firebasestorage.app';

async function main() {
  const bucket = storage.bucket(bucketName);
  await bucket.setCorsConfiguration(corsConfig);
  console.log(`CORS configurado em ${bucketName} para:`, ORIGINS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
