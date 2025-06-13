// Google Gemini Vision API OCR Proxy
// 必要: GEMINI_API_KEY 環境変数

const { Buffer } = require('buffer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY not set' });
    return;
  }
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }
    // DataURLからbase64部分を抽出
    const base64 = image.split(',')[1];
    // Gemini Vision APIエンドポイント
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=' + apiKey;
    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64
              }
            },
            {
              text: 'この画像に含まれる日本語テキストをすべて抽出し、1つのテキストとして返してください。改行や空白も維持してください。' // 日本語で明示
            }
          ]
        }
      ]
    };
    const fetch = global.fetch || (await import('node-fetch')).default;
    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      res.status(apiRes.status).json({ error: 'Gemini API error', detail: errText });
      return;
    }
    const data = await apiRes.json();
    // Geminiのレスポンスからテキスト抽出
    let text = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      const part = data.candidates[0].content.parts.find(p => p.text);
      text = part ? part.text : '';
    }
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
