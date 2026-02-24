export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Debug: tell us exactly what's happening
  if (!apiKey) {
    return res.status(500).json({
      error: {
        message: 'ANTHROPIC_API_KEY is not set in Vercel Environment Variables. Go to Vercel Dashboard → Settings → Environment Variables → Add ANTHROPIC_API_KEY'
      }
    });
  }

  if (!apiKey.startsWith('sk-ant-')) {
    return res.status(500).json({
      error: {
        message: 'ANTHROPIC_API_KEY looks invalid. It should start with sk-ant-'
      }
    });
  }

  try {
    const body = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: { message: 'Unknown API error' } }));
      return res.status(response.status).json(errData);
    }

    // Stream the response back
    const text = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/event-stream');
    return res.status(200).send(text);

  } catch (err) {
    return res.status(500).json({
      error: { message: 'Server error: ' + err.message }
    });
  }
}
