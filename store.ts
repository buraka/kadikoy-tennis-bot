import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export interface CourtState {
    courtKey: string;
    name: string;
    availableSlots: string[];
    updatedAt?: string;
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = () => {
    const name = process.env.SLOTS_TABLE;
    if (!name) throw new Error('SLOTS_TABLE env is not set');
    return name;
};

export const getCourtState = async (courtKey: string): Promise<CourtState | undefined> => {
    const res = await client.send(new GetCommand({ TableName: tableName(), Key: { courtKey } }));
    return res.Item as CourtState | undefined;
};

export const saveCourtState = async (state: CourtState) => {
    await client.send(new PutCommand({
        TableName: tableName(),
        Item: { ...state, updatedAt: new Date().toISOString() },
    }));
};

// Kadikoy member session cookies, kept in the same table under a reserved key
const SESSION_KEY = '__session__';

export const getSessionCookies = async (): Promise<Record<string, string>> => {
    const res = await client.send(new GetCommand({ TableName: tableName(), Key: { courtKey: SESSION_KEY } }));
    return res.Item?.cookies ? JSON.parse(res.Item.cookies) : {};
};

export const saveSessionCookies = async (cookies: Record<string, string>) => {
    await client.send(new PutCommand({
        TableName: tableName(),
        Item: { courtKey: SESSION_KEY, cookies: JSON.stringify(cookies), updatedAt: new Date().toISOString() },
    }));
};
