import http2 from 'http2';
import crypto from 'crypto';
import { ApnsEnvironment } from './devices';

const HOSTS: Record<ApnsEnvironment, string> = {
    production: 'https://api.push.apple.com',
    sandbox: 'https://api.sandbox.push.apple.com',
};

export interface ApnsCredentials {
    key: string; // .p8 contents
    keyId: string;
    teamId: string;
    bundleId: string;
}

export interface PushResult {
    token: string;
    status: number;
    reason?: string;
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

// Provider token, valid for up to an hour; one per Lambda invocation is enough
const createJwt = ({ key, keyId, teamId }: ApnsCredentials) => {
    const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
    const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
    const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
    return `${header}.${claims}.${base64url(signature)}`;
};

const sendOne = (session: http2.ClientHttp2Session, jwt: string, bundleId: string, token: string, payload: string) =>
    new Promise<PushResult>((resolve) => {
        const req = session.request({
            ':method': 'POST',
            ':path': `/3/device/${token}`,
            authorization: `bearer ${jwt}`,
            'apns-topic': bundleId,
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'content-type': 'application/json',
        });
        let status = 0;
        let body = '';
        req.on('response', (headers) => { status = Number(headers[':status']); });
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            let reason: string | undefined;
            try { reason = body ? JSON.parse(body).reason : undefined; } catch { reason = body; }
            resolve({ token, status, reason });
        });
        req.on('error', (error) => resolve({ token, status: 0, reason: error.message }));
        req.end(payload);
    });

export const sendPushes = async (
    credentials: ApnsCredentials,
    environment: ApnsEnvironment,
    messages: { token: string; title: string; body: string; court?: Record<string, string> }[],
): Promise<PushResult[]> => {
    if (messages.length === 0) return [];
    const jwt = createJwt(credentials);
    const session = http2.connect(HOSTS[environment]);
    try {
        return await Promise.all(messages.map(({ token, title, body, court }) => sendOne(
            session, jwt, credentials.bundleId, token,
            JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, court }),
        )));
    } finally {
        session.close();
    }
};

// Token is dead for good; remove the device instead of retrying forever
export const isInvalidToken = (result: PushResult) =>
    result.status === 410 || (result.status === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(result.reason || ''));
