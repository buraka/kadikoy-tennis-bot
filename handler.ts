import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, ScheduledEvent } from 'aws-lambda';
import { checkCourts } from './tennisCourts';
import { ApnsEnvironment, deleteDevice, saveDevice } from './devices';
import { getSecrets } from './secrets';
import { DEFAULT_AGE, KADIKOY_BASE_URL, KADIKOY_RESERVATION_URL } from './constants';

const done = () => ({
  statusCode: 200,
  body: JSON.stringify({
    message: 'done!',
  }),
});

export async function scheduledFunction(event: ScheduledEvent) {
  try {
    console.log('Scheduled event:', JSON.stringify(event, null, 2));
    await checkCourts();
    return done();
  } catch (error) {
    console.error(error);
    throw error;
  }
}

const json = (statusCode: number, body: object): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const APNS_TOKEN_PATTERN = /^[0-9a-f]{64,200}$/i;
const SITE_ID_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

// GET /go?b=&t=&s= : the court calendar is only reachable via a form POST, so this page
// submits that form on load. Safari lands on the court's calendar (2 weeks if logged in there).
const courtRedirect = (query: Record<string, string | undefined> = {}): APIGatewayProxyResultV2 => {
  const { b, t, s } = query;
  if (![b, t, s].every((id) => id && SITE_ID_PATTERN.test(id))) {
    return { statusCode: 302, headers: { Location: KADIKOY_RESERVATION_URL }, body: '' };
  }
  const field = (name: string, value: string | number) => `<input type="hidden" name="${name}" value="${value}">`;
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Kort takvimi açılıyor</title></head>
<body style="font-family:-apple-system,sans-serif;text-align:center;padding-top:40vh;color:#555">
<form id="f" method="post" action="${KADIKOY_BASE_URL}/Satis/Rezervasyon">
${field('Yas', DEFAULT_AGE)}${field('KiralikBransID', b!)}${field('KiralikTesisID', t!)}${field('KiralikSalonID', s!)}
<noscript><button>Kort takvimini aç</button></noscript></form>
Kort takvimi açılıyor…<script>document.getElementById('f').submit()</script></body></html>`;
  return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: html };
};

// Function URL the iOS app calls to register its push token and filters
export async function registerDevice(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === 'GET' && event.rawPath === '/go') {
    return courtRedirect(event.queryStringParameters);
  }
  try {
    const { appSecret } = await getSecrets();
    if (!appSecret || event.headers['x-app-secret'] !== appSecret) {
      return json(401, { error: 'unauthorized' });
    }

    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body;
    const body = JSON.parse(raw || '{}');
    const token = String(body.token || '');
    if (!APNS_TOKEN_PATTERN.test(token)) {
      return json(400, { error: 'invalid token' });
    }

    if (event.requestContext.http.method === 'DELETE') {
      await deleteDevice(token);
      return json(200, { ok: true });
    }

    const environment: ApnsEnvironment = body.environment === 'sandbox' ? 'sandbox' : 'production';
    const courts = Array.isArray(body.courts) ? body.courts.map(String) : [];
    await saveDevice({ token, environment, courts, primeOnly: body.primeOnly === true });
    return json(200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(500, { error: 'internal error' });
  }
}
