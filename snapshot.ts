import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export const SNAPSHOT_KEY = 'slots.json';

export interface Snapshot {
    updatedAt: string;
    courts: { key: string; name: string; branchId: string; facilityId: string; availableSlots: string[] }[];
}

const client = new S3Client({});

// Public JSON the iOS app reads; written on every run so updatedAt shows the bot is alive
export const writeSnapshot = async (snapshot: Snapshot) => {
    const bucket = process.env.SLOTS_BUCKET;
    if (!bucket) throw new Error('SLOTS_BUCKET env is not set');
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: SNAPSHOT_KEY,
        Body: JSON.stringify(snapshot),
        ContentType: 'application/json',
        CacheControl: 'max-age=30',
    }));
};
