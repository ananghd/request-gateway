import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3030;
const TARGET_SERVERS = (process.env.TARGET_SERVERS || '').split(',').filter(Boolean);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('*', async (req, res) => {
  const { method, path, headers, body } = req;

  console.log(`[INCOMING REQUEST] ${method} ${path}`);
  console.log(`Headers:`, headers);
  console.log(`Body:`, body);

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

    return res.status(primary.status).set(primary.headers).send(primary.data);
  } catch (err) {
    console.error(`[FATAL]`, err);
    res.status(500).send({ error: 'Internal Proxy Error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Multi-forwarding proxy running on port ${PORT}`);
  console.log(`📡 Forwarding requests to: ${TARGET_SERVERS.join(', ')}`);
});
