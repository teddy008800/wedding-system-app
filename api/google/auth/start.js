import crypto from 'crypto';

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signState(payload, secret) {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(encodedPayload);
  const signature = hmac
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encodedPayload}.${signature}`;
}

export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;

  if (!clientId || !redirectUri || !stateSecret) {
    return res.status(500).json({
      error: 'Missing env: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_REDIRECT_URI / GOOGLE_OAUTH_STATE_SECRET'
    });
  }

  const returnTo = String(req.query.return_to || '/').trim() || '/';
  const payload = {
    t: Date.now(),
    r: returnTo
  };
  const state = signState(payload, stateSecret);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: 'https://www.googleapis.com/auth/drive.file',
    state
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(302, url);
}
