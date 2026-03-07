module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, pdfBase64, filename } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  if (!pdfBase64) return res.status(400).json({ error: 'No PDF provided' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            },
            {
              type: 'text',
              text: `You are a content writer for Sarah Eileen Mehta's professional portfolio blog. Sarah is a strategic operations and enterprise risk leader with 6+ years experience across Big 4 consulting, federal agencies (NASA, DOI, FHWA), and Fortune 500 clients.

Based on this PDF document, generate a professional blog post that:
1. Is written in first person from Sarah's perspective
2. Highlights key insights, data points, and outcomes from the document
3. Positions Sarah as a thought leader in strategic operations and risk management
4. Sounds natural and authoritative, not like a summary

Return a JSON object with exactly these keys:
{
  "title": "compelling blog post title",
  "content": "the full article body as HTML paragraphs (<p> tags only, no h2/h3, no divs — just <p> tags with the content)"
}

Return valid JSON only, no code blocks or markdown fences.`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let raw = data.content[0].text;
    raw = raw.replace(/^```json?\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    const parsed = JSON.parse(raw);
    return res.status(200).json({
      title: parsed.title || '',
      content: parsed.content || ''
    });

  } catch (error) {
    console.error('PDF extract error:', error);
    return res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
  }
};

module.exports.config = { maxDuration: 60 };
