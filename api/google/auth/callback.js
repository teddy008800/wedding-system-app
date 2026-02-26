import crypto from 'crypto';

function unbase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function verifyState(state, secret) {
  const [encodedPayload, signature] = String(state || '').split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(encodedPayload);
  const expected = hmac
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (expected !== signature) {
    return null;
  }

  try {
    return JSON.parse(unbase64Url(encodedPayload));
  } catch {
    return null;
  }
}

async function upsertRefreshToken(supabaseUrl, serviceRoleKey, refreshToken) {
  const upsertResp = await fetch(`${supabaseUrl}/rest/v1/google_oauth_tokens`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({
      id: 'drive_uploader',
      provider: 'google',
      refresh_token: refreshToken,
      updated_at: new Date().toISOString()
    })
  });

  return upsertResp.ok;
}

export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !redirectUri || !stateSecret || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).send('Missing required env vars for OAuth callback.');
  }

  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const parsedState = verifyState(state, stateSecret);
  if (!code || !parsedState) {
    return res.status(400).send('Invalid OAuth callback request.');
  }

  const ageMs = Date.now() - Number(parsedState.t || 0);
  if (Number.isNaN(ageMs) || ageMs > 10 * 60 * 1000) {
    return res.status(400).send('Expired OAuth state.');
  }

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });

  const tokenPayload = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok) {
    return res.status(400).send(`Token exchange failed: ${tokenPayload?.error || 'unknown'}`);
  }

  const refreshToken = String(tokenPayload?.refresh_token || '');
  if (!refreshToken) {
    return res.status(400).send(
      'No refresh token returned. Revoke app access in Google Account and retry with consent prompt.'
    );
  }

  const saved = await upsertRefreshToken(supabaseUrl, serviceRoleKey, refreshToken);
  if (!saved) {
    return res.status(500).send('Failed to save refresh token.');
  }

  const returnTo = String(parsedState.r || '/');
  return res.redirect(302, returnTo);
}
