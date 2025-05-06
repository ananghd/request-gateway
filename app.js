require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

const TARGET_SERVERS = process.env.TARGET_SERVERS
  ? process.env.TARGET_SERVERS.split(',').map(s => s.trim())
  : [];

if (TARGET_SERVERS.length === 0) {
  console.error('❌ No TARGET_SERVERS defined in .env');
  process.exit(1);
}

const PORT = process.env.PORT || 3030;

// Allow all CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('*', async (req, res) => {
  const { method, path, headers, body } = req;

  console.log(`[INCOMING REQUEST] ${method} ${path}`);
  console.log('Headers:', headers);

  if (method === 'OPTIONS') {
    console.log('[CORS Preflight] Responding with 204 No Content');
    return res.sendStatus(204);
  }

  console.log('Body:', body);

  const requests = TARGET_SERVERS.map(url =>
    axios({
      method,
      url: url + req.originalUrl,
      headers,
      data: body,
      validateStatus: () => true,
    }).catch(error => ({
      error: error.message,
      status: 500,
    }))
  );

  try {
    const responses = await Promise.all(requests);
    const primary = responses[0];

    if (primary.error) {
      console.error(`[ERROR] Failed to forward to primary: ${primary.error}`);
      return res.status(primary.status || 500).send({ error: primary.error });
    }

    console.log(`[FORWARDED] Response from primary: ${primary.status}`);
    return res.status(primary.status).set(primary.headers).send(primary.data);
  } catch (err) {
    console.error(`[FATAL]`, err);
    res.status(500).send({ error: 'Internal Proxy Error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server listening on port ${PORT}`);
  console.log(`🌐 Forwarding requests to:`);
  TARGET_SERVERS.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
});