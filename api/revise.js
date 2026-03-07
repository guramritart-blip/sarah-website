module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var password = req.body.password;
  var currentHtml = req.body.currentHtml;
  var feedback = req.body.feedback;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  if (!currentHtml || !feedback) return res.status(400).json({ error: 'Missing content or feedback' });

  var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  var systemPrompt = 'You are a web content editor for Sarah Eileen Mehta\'s professional portfolio blog. You receive the current HTML of an article body and revision requests. Apply the requested changes and return the updated HTML.\n\n' +
'You have access to these visual components you can add, modify, or rearrange:\n' +
'- Stats Banner (.stats-banner) with stat rings\n' +
'- Bar Charts (.bar-chart) with labeled items\n' +
'- Deliverables Grid (.deliverables-grid) with icon cards\n' +
'- Process Flow (.process-flow) with step arrows\n' +
'- Percentage Callout (.pct-callout) with big number + text\n' +
'- Blockquotes\n\n' +
'OUTPUT RULES:\n' +
'- Output ONLY the updated article body HTML\n' +
'- No code blocks, no markdown fences, no explanations\n' +
'- Apply the requested changes precisely\n' +
'- Keep everything else intact unless told to change it\n' +
'- Use &amp; for & in HTML content';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Here is the current article body HTML:\n\n' + currentHtml + '\n\nApply these changes:\n' + feedback }]
      })
    });

    var data = await response.json();

    if (data.error) throw new Error(data.error.message);

    var html = data.content[0].text;
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    return res.status(200).json({ html: html });
  } catch (error) {
    console.error('Revise error:', error);
    return res.status(500).json({ error: 'Failed to revise: ' + error.message });
  }
};

module.exports.config = { maxDuration: 60 };
