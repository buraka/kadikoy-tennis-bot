import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

// Read at runtime instead of deploy time, so the stack deploys before the APNs key exists
// and the private key never lands in Lambda env vars.
const PARAMS = {
    apnsKey: '/tennis/APNS_KEY_P8',
    apnsKeyId: '/tennis/APNS_KEY_ID',
    appSecret: '/tennis/APP_SHARED_SECRET',
    kadikoyTc: '/tennis/KADIKOY_TC',
    kadikoyPassword: '/tennis/KADIKOY_PASSWORD',
} as const;

export type Secrets = Partial<Record<keyof typeof PARAMS, string>>;

const client = new SSMClient({});
let cached: Promise<Secrets> | undefined;

export const getSecrets = (): Promise<Secrets> => {
    if (!cached) {
        cached = client
            .send(new GetParametersCommand({ Names: Object.values(PARAMS), WithDecryption: true }))
            .then((res) => {
                const byName = new Map((res.Parameters || []).map((p) => [p.Name, p.Value]));
                const secrets: Secrets = {};
                for (const [key, name] of Object.entries(PARAMS)) {
                    secrets[key as keyof typeof PARAMS] = byName.get(name);
                }
                if (res.InvalidParameters?.length) {
                    console.warn('missing SSM params:', res.InvalidParameters);
                }
                return secrets;
            })
            .catch((error) => {
                cached = undefined;
                throw error;
            });
    }
    return cached;
};
