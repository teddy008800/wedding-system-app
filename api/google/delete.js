async function getStoredRefreshToken(supabaseUrl, serviceRoleKey) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/google_oauth_tokens?id=eq.drive_uploader&select=refresh_token&limit=1`,
    {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    }
  );

  if (!response.ok) {
    return '';
  }
  const rows = await response.json().catch(() => []);
  return String(rows?.[0]?.refresh_token || '');
}

async function getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || 'Failed to refresh access token');
  }
  return payload.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Missing env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET'
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!userResp.ok) {
      const reason = await userResp.text();
      return res.status(401).json({ error: `Invalid auth token: ${reason}` });
    }

    const fileId = String(req.body?.fileId || '').trim();
    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    const refreshToken = await getStoredRefreshToken(supabaseUrl, serviceRoleKey);
    if (!refreshToken) {
      return res.status(400).json({ error: 'Google account not connected yet. Run /api/google/auth/start first.' });
    }

    const accessToken = await getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken);
    const deleteResp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (deleteResp.status === 404) {
      return res.status(200).json({ ok: true, alreadyMissing: true, fileId });
    }
    if (!deleteResp.ok) {
      const detail = await deleteResp.text();
      return res.status(deleteResp.status).json({
        error: 'Failed to delete Google Drive file',
        detail
      });
    }

    return res.status(200).json({ ok: true, fileId });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Google delete failed'
    });
  }
}
