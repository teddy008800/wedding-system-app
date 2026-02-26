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

function buildMultipartBody(metadata, mimeType, fileBuffer) {
  const boundary = `drive-boundary-${Date.now()}`;
  const delimiter = `--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const metadataPart =
    `${delimiter}` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n`;
  const mediaHeader =
    `${delimiter}` +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: binary\r\n\r\n';
  const bodyBuffer = Buffer.concat([
    Buffer.from(metadataPart, 'utf8'),
    Buffer.from(mediaHeader, 'utf8'),
    fileBuffer,
    Buffer.from(closeDelimiter, 'utf8')
  ]);
  return { boundary, bodyBuffer };
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

    const body = req.body || {};
    const fileName = String(body.fileName || '').trim();
    const mimeType = String(body.mimeType || '').trim().toLowerCase();
    const base64Data = String(body.base64Data || '');

    if (!fileName || !mimeType || !base64Data) {
      return res.status(400).json({ error: 'fileName, mimeType, base64Data are required' });
    }

    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    if (!isImage && !isVideo) {
      return res.status(400).json({ error: 'Only image/* or video/* uploads are allowed' });
    }

    const fileBuffer = Buffer.from(base64Data, 'base64');
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (!fileBuffer.length || fileBuffer.length > maxBytes) {
      return res.status(400).json({ error: `File too large. Max ${maxSizeMb}MB` });
    }

    const accessToken = await getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken);
    const metadata = { name: fileName, parents: [folderId] };
    const { boundary, bodyBuffer } = buildMultipartBody(metadata, mimeType, fileBuffer);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: bodyBuffer
      }
    );
    const uploadPayload = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !uploadPayload?.id) {
      return res.status(uploadResponse.status || 500).json({
        error: uploadPayload?.error?.message || 'Failed to upload to Google Drive'
      });
    }

    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadPayload.id}/permissions`, {
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

    const fileId = uploadPayload.id;
    const webViewLink = uploadPayload.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    return res.status(200).json({
      ok: true,
      fileId,
      webViewLink,
      directUrl,
      mimeType: uploadPayload.mimeType || mimeType
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Google upload failed'
    });
  }
}
