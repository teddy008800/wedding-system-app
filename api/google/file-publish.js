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

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET'
    });
  }

  try {
    const fileId = String(req.body?.fileId || '').trim();
    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    const refreshToken = await getStoredRefreshToken(supabaseUrl, serviceRoleKey);
    if (!refreshToken) {
      return res.status(400).json({ error: 'Google account not connected yet. Run /api/google/auth/start first.' });
    }

    const accessToken = await getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken);

    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'anyone',
        role: 'reader'
      })
    });

    const metaResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    const meta = await metaResp.json().catch(() => ({}));
    if (!metaResp.ok || !meta?.id) {
      return res.status(metaResp.status || 500).json({
        error: 'Failed to fetch file metadata'
      });
    }

    return res.status(200).json({
      ok: true,
      fileId: meta.id,
      webViewLink: meta.webViewLink || `https://drive.google.com/file/d/${meta.id}/view`,
      directUrl: `https://drive.google.com/uc?export=view&id=${meta.id}`,
      mimeType: meta.mimeType || ''
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to publish file'
    });
  }
}
