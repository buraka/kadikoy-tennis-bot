import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

export type ApnsEnvironment = 'production' | 'sandbox';

export interface Device {
    token: string;
    environment: ApnsEnvironment;
    courts: string[]; // court keys; empty means every court
    primeOnly: boolean; // only weekend / evening slots
    updatedAt?: string;
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = () => {
    const name = process.env.DEVICES_TABLE;
    if (!name) throw new Error('DEVICES_TABLE env is not set');
    return name;
};

// Friends-group scale: a full scan is a handful of items
export const listDevices = async (): Promise<Device[]> => {
    const devices: Device[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
        const res = await client.send(new ScanCommand({ TableName: tableName(), ExclusiveStartKey: startKey }));
        devices.push(...((res.Items || []) as Device[]));
        startKey = res.LastEvaluatedKey;
    } while (startKey);
    return devices;
};

export const saveDevice = async (device: Device) => {
    await client.send(new PutCommand({
        TableName: tableName(),
        Item: { ...device, updatedAt: new Date().toISOString() },
    }));
};

export const deleteDevice = async (token: string) => {
    await client.send(new DeleteCommand({ TableName: tableName(), Key: { token } }));
};
