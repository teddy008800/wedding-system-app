import crypto from 'crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(serviceAccountEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountEmail,
    scope: GOOGLE_DRIVE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const tokenBody = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(tokenBody);
  signer.end();
  const signature = signer.sign(privateKey);
  const encodedSignature = signature
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${tokenBody}.${encodedSignature}`;
}

async function getAccessToken(serviceAccountEmail, privateKey) {
  const assertion = signJwt(serviceAccountEmail, privateKey);
  const formBody = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || 'Unable to get Google access token');
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

async function setPublicRead(accessToken, fileId) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
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
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const defaultFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const maxSizeMb = Number(process.env.GUEST_UPLOAD_MAX_MB || '25');

  if (!serviceAccountEmail || !privateKeyRaw || !defaultFolderId) {
    return res.status(500).json({
      error: 'Missing env: GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_DRIVE_FOLDER_ID'
    });
  }

  try {
    const body = req.body || {};
    const fileName = String(body.fileName || '').trim();
    const mimeType = String(body.mimeType || '').trim().toLowerCase();
    const base64Data = String(body.base64Data || '');
    const folderId = String(body.folderId || defaultFolderId).trim() || defaultFolderId;

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

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    const accessToken = await getAccessToken(serviceAccountEmail, privateKey);

    const metadata = {
      name: fileName,
      parents: [folderId]
    };

    const { boundary, bodyBuffer } = buildMultipartBody(metadata, mimeType, fileBuffer);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType',
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
        error: uploadPayload?.error?.message || 'Failed to upload file to Google Drive'
      });
    }

    await setPublicRead(accessToken, uploadPayload.id);

    const fileId = uploadPayload.id;
    const webViewLink = uploadPayload.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return res.status(200).json({
      ok: true,
      fileId,
      name: uploadPayload.name || fileName,
      mimeType: uploadPayload.mimeType || mimeType,
      webViewLink,
      directUrl
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Upload to Drive failed'
    });
  }
}
