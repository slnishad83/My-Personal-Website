const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

if (!admin.apps.length) {
  admin.initializeApp();
}

const meteredApiKey = defineSecret('METERED_API_KEY');
const METERED_APP_URL = 'teamchatnishad.metered.live';

function setCorsHeaders(response) {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Max-Age', '3600');
}

async function verifyFirebaseUser(request) {
  const authorization = request.get('Authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/);

  if (!match) {
    throw new Error('Missing Firebase auth token');
  }

  return admin.auth().verifyIdToken(match[1]);
}

exports.getTurnCredentials = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    secrets: [meteredApiKey]
  },
  async (request, response) => {
    setCorsHeaders(response);
    response.set('Cache-Control', 'private, no-store');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      await verifyFirebaseUser(request);

      const apiKey = meteredApiKey.value();
      if (!apiKey) {
        response.status(500).json({ error: 'TURN secret is not configured' });
        return;
      }

      const meteredResponse = await fetch(
        `https://${METERED_APP_URL}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`
      );

      if (!meteredResponse.ok) {
        response.status(502).json({ error: 'Metered TURN request failed' });
        return;
      }

      const iceServers = await meteredResponse.json();
      if (!Array.isArray(iceServers) || !iceServers.length) {
        response.status(502).json({ error: 'Metered returned no TURN servers' });
        return;
      }

      response.status(200).json(iceServers);
    } catch (error) {
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
);
