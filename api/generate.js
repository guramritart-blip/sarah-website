module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var password = req.body.password;
  var content = req.body.content;
  var title = req.body.title;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  if (!content) return res.status(400).json({ error: 'No content provided' });

  var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  var systemPrompt = 'You are a web content enhancer for Sarah Eileen Mehta\'s professional portfolio blog. Your job is to take article body HTML and enhance it by inserting visual HTML components from the site\'s design system wherever relevant.\n\n' +
'CRITICAL: Do NOT change the article text. Only ADD visual components between existing paragraphs.\n\n' +
'AVAILABLE COMPONENTS:\n\n' +
'1. STATS BANNER — Highlight 3-4 key metrics near the top of the article (after first 1-2 paragraphs).\n' +
'<div class="stats-banner">\n' +
'    <div class="stat-item">\n' +
'        <div class="stat-ring" style="--offset: VALUE;">\n' +
'            <svg viewBox="0 0 100 100">\n' +
'                <circle class="stat-ring__bg" cx="50" cy="50" r="45"/>\n' +
'                <circle class="stat-ring__fill" cx="50" cy="50" r="45"/>\n' +
'            </svg>\n' +
'            <div class="stat-ring__value">NUMBER<span>SUFFIX</span></div>\n' +
'        </div>\n' +
'        <div class="stat-item__label">Label Line 1<br>Label Line 2</div>\n' +
'    </div>\n' +
'    <!-- repeat 3-4 stat-items -->\n' +
'</div>\n' +
'OFFSET CALCULATION: Ring circumference = 283. For percentages: offset = 283 * (1 - percent/100). Example: 30% → offset = 198. For non-percentage numbers, use offset: 0 (full ring).\n\n' +
'2. BAR CHART — Visualize comparisons, breakdowns, or multi-item data.\n' +
'<div class="bar-chart">\n' +
'    <div class="bar-chart__title">Chart Title</div>\n' +
'    <div class="bar-chart__item">\n' +
'        <div class="bar-chart__label">\n' +
'            <span class="bar-chart__name">Item Name</span>\n' +
'            <span class="bar-chart__value">Value</span>\n' +
'        </div>\n' +
'        <div class="bar-chart__track"><div class="bar-chart__fill" style="--width: 85%"></div></div>\n' +
'    </div>\n' +
'    <!-- repeat items -->\n' +
'</div>\n' +
'Add class "bar-chart__fill--gold" for gold-colored bars instead of default navy.\n\n' +
'3. DELIVERABLES GRID — List multiple items/deliverables with icons and descriptions.\n' +
'<div class="deliverables-grid">\n' +
'    <div class="deliverable-card">\n' +
'        <span class="deliverable-card__icon">&#128218;</span>\n' +
'        <div class="deliverable-card__name">Item Name</div>\n' +
'        <div class="deliverable-card__desc">Short description</div>\n' +
'    </div>\n' +
'    <!-- repeat cards -->\n' +
'</div>\n' +
'Use HTML entity emojis like &#128218; &#128200; &#127919; &#128101; &#128187; &#128640; &#127760; &#9745; &#128214; &#128279; &#129517;\n\n' +
'4. PROCESS FLOW — Show sequential steps or workflows.\n' +
'<div class="process-flow">\n' +
'    <div class="process-flow__title">Flow Title</div>\n' +
'    <div class="process-flow__steps">\n' +
'        <div class="process-flow__step">\n' +
'            <div class="process-flow__icon">&#128218;</div>\n' +
'            <div class="process-flow__label">Step Name</div>\n' +
'        </div>\n' +
'        <div class="process-flow__arrow">&#8594;</div>\n' +
'        <!-- repeat step + arrow -->\n' +
'    </div>\n' +
'</div>\n\n' +
'5. PERCENTAGE/NUMBER CALLOUT — Highlight a single standout statistic.\n' +
'<div class="pct-callout">\n' +
'    <div class="pct-callout__number">30<span>%</span></div>\n' +
'    <div class="pct-callout__text"><strong>Bold headline.</strong> Description text explaining the stat.</div>\n' +
'</div>\n\n' +
'6. BLOCKQUOTE — Pull out key insights as styled quotes.\n' +
'<blockquote>\n' +
'    <p>Quote text here.</p>\n' +
'</blockquote>\n\n' +
'PLACEMENT RULES:\n' +
'- Stats Banner: Place after the first 1-2 paragraphs to hook the reader with key metrics\n' +
'- Bar Charts: Use anywhere data involves comparisons or breakdowns\n' +
'- Deliverables Grid: Use when the article lists multiple items, tools, or deliverables\n' +
'- Process Flow: Use when describing sequential steps, phases, or workflows\n' +
'- Percentage Callout: Use for standout individual statistics scattered throughout\n' +
'- Blockquote: Use for key insights, lessons, or powerful statements\n' +
'- Insert at least 2-3 visual components per article, more for longer articles\n' +
'- Don\'t force visuals where they don\'t fit naturally\n\n' +
'OUTPUT FORMAT:\n' +
'You must return a JSON object (no code blocks, no markdown fences) with exactly these three keys:\n' +
'{\n' +
'  "html": "the enhanced article body HTML",\n' +
'  "excerpt": "a compelling 1-2 sentence summary for the blog listing page (max 200 chars)",\n' +
'  "metaDescription": "an SEO-optimized description for search engines (max 160 chars)"\n' +
'}\n\n' +
'HTML RULES:\n' +
'- Keep ALL original text content exactly as-is\n' +
'- Use &amp; for & in HTML content\n' +
'- The html goes inside <div class="container article__container"> so do not include that wrapper\n' +
'- Return valid JSON only — no extra text before or after';

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
        messages: [{ role: 'user', content: 'Enhance this article titled "' + title + '" with visual HTML components wherever relevant:\n\n' + content }]
      })
    });

    var data = await response.json();

    if (data.error) throw new Error(data.error.message);

    var raw = data.content[0].text;
    raw = raw.replace(/^```json?\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Fallback: if Claude didn't return valid JSON, treat the whole response as HTML
      return res.status(200).json({ html: raw, excerpt: '', metaDescription: '' });
    }

    return res.status(200).json({
      html: parsed.html || '',
      excerpt: parsed.excerpt || '',
      metaDescription: parsed.metaDescription || ''
    });
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(500).json({ error: 'Failed to generate: ' + error.message });
  }
};

module.exports.config = { maxDuration: 60 };
