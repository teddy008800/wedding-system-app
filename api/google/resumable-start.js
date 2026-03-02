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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const maxSizeMb = Number(process.env.GUEST_UPLOAD_MAX_MB || '25');

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret || !folderId) {
    return res.status(500).json({
      error: 'Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_DRIVE_FOLDER_ID'
    });
  }

  try {
    const refreshToken = await getStoredRefreshToken(supabaseUrl, serviceRoleKey);
    if (!refreshToken) {
      return res.status(400).json({ error: 'Google account not connected yet. Run /api/google/auth/start first.' });
    }

    const fileName = String(req.body?.fileName || '').trim();
    const mimeType = String(req.body?.mimeType || '').trim().toLowerCase();
    const fileSize = Number(req.body?.fileSize || 0);
    if (!fileName || !mimeType || !Number.isFinite(fileSize) || fileSize <= 0) {
      return res.status(400).json({ error: 'fileName, mimeType, fileSize are required' });
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (fileSize > maxBytes) {
      return res.status(400).json({ error: 'File too large', maxSizeMb });
    }

    const accessToken = await getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken);
    const metadata = { name: fileName, parents: [folderId] };
    const startResp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,mimeType',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(fileSize)
        },
        body: JSON.stringify(metadata)
      }
    );

    const uploadUrl = startResp.headers.get('location') || '';
    if (!startResp.ok || !uploadUrl) {
      const detail = await startResp.text();
      return res.status(startResp.status || 500).json({
        error: 'Failed to start resumable upload session',
        detail
      });
    }

    return res.status(200).json({
      ok: true,
      uploadUrl
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start resumable upload'
    });
  }
}
