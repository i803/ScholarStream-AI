let currentPapers = [];
let msgCount = 0;
const $ = (id) => document.getElementById(id);

// API Keys Setup: Reads custom user overrides from localStorage (if any)
let groqApiKey = localStorage.getItem('groq_api_key') || '';
let openAlexApiKey = localStorage.getItem('openalex_api_key') || '';

// Load stored custom keys into Settings Modal inputs on page load
if ($('groq-key-input')) $('groq-key-input').value = groqApiKey;
if ($('openalex-key-input')) $('openalex-key-input').value = openAlexApiKey;

// 1. Modal Listeners & Backdrop Click-to-Close
$('config-btn').onclick = () => $('config-modal').classList.remove('hidden');
$('close-config').onclick = () => $('config-modal').classList.add('hidden');
$('close-summary').onclick = () => $('summary-modal').classList.add('hidden');

window.addEventListener('click', (e) => {
  if (e.target === $('config-modal')) $('config-modal').classList.add('hidden');
  if (e.target === $('summary-modal')) $('summary-modal').classList.add('hidden');
});

$('save-key-btn').onclick = () => {
  const gKey = $('groq-key-input') ? $('groq-key-input').value.trim() : '';
  const aKey = $('openalex-key-input') ? $('openalex-key-input').value.trim() : '';

  groqApiKey = gKey;
  openAlexApiKey = aKey;

  if (gKey) localStorage.setItem('groq_api_key', groqApiKey);
  else localStorage.removeItem('groq_api_key');

  if (aKey) localStorage.setItem('openalex_api_key', openAlexApiKey);
  else localStorage.removeItem('openalex_api_key');

  $('config-modal').classList.add('hidden');
  alert('API Configuration Saved!');
};

// 2. Markdown Formatter
function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.*$)/gim, '<h4 style="margin:6px 0 2px; color:#1e1b4b;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h4 style="margin:6px 0 2px; color:#1e1b4b;">$1</h4>')
    .replace(/^# (.*$)/gim, '<h4 style="margin:6px 0 2px; color:#1e1b4b;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\s*[-•]\s*(.*$)/gim, '<li style="margin-left:14px;">$1</li>')
    .replace(/\n\n/gim, '<br><br>')
    .replace(/\n/gim, '<br>');
}

// 3. Abstract Reconstructor
function extractAbstract(index) {
  if (!index || typeof index !== 'object') return 'No abstract preview available for this publication.';
  const words = [];
  Object.entries(index).forEach(([w, pos]) => {
    if (Array.isArray(pos)) pos.forEach(p => words[p] = w);
  });
  const text = words.filter(Boolean).join(' ').trim();
  return text.length > 0 ? text : 'No abstract preview available for this publication.';
}

// 4. Search OpenAlex API
$('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = $('search-input').value.trim();
  if (!query) return;

  $('results-list').innerHTML = `<div class="empty-state"><p style="color:var(--primary);font-weight:600;">Querying academic corpus...</p></div>`;

  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=10${openAlexApiKey ? `&api_key=${openAlexApiKey}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    currentPapers = (data.results || []).map(w => ({
      title: w.display_name || w.title || 'Untitled',
      authors: w.authorships?.map(a => a.author.display_name).join(', ') || 'Unknown Authors',
      year: w.publication_year || 'N/A',
      citations: w.cited_by_count ?? 0,
      abstract: extractAbstract(w.abstract_inverted_index),
      url: w.doi || w.landing_page_url || w.id,
      topics: w.concepts?.slice(0, 3).map(c => c.display_name) || ['Computer Science']
    }));

    if (!currentPapers.length) {
      $('results-list').innerHTML = `<div class="empty-state"><h3>No publications found</h3><p>Try searching another topic.</p></div>`;
      return;
    }

    renderPapers(currentPapers);
    drawVisualizations(currentPapers);
    $('results-heading').classList.remove('hidden');
    $('results-counter').innerText = `${currentPapers.length} Papers Loaded`;
    appendChatMessage('ai', `I have retrieved ${currentPapers.length} live papers on "${query}". Click "AI Simplify" or ask me any technical doubt!`);
  } catch (err) {
    $('results-list').innerHTML = `<div class="empty-state"><p style="color:#dc2626;">Error: ${err.message}</p></div>`;
  }
});

function renderPapers(papers) {
  $('results-list').innerHTML = papers.map((p, i) => `
    <div class="paper-item">
      <h3>${escapeHTML(p.title)}</h3>
      <div class="meta-info">
        <span class="meta-pill">📅 ${p.year}</span>
        <span class="meta-pill">🔗 ${p.citations} Citations</span>
        <span class="meta-pill">✍️ ${escapeHTML(p.authors)}</span>
      </div>
      <p class="paper-abstract-preview">${escapeHTML(p.abstract.slice(0, 220))}...</p>
      <div class="paper-actions">
        <button class="btn-secondary" onclick="openSummarizer(${i})">✨ AI Simplify Abstract</button>
        <button class="btn-secondary" onclick="askAiAboutPaper(${i})">💬 Ask Doubt</button>
        <a href="${p.url}" target="_blank" style="text-decoration:none;"><button class="btn-secondary">🔗 Open Paper</button></a>
      </div>
    </div>
  `).join('');
}

// 5. Groq Cloud AI Caller (Uses Vercel /api/groq backend endpoint with client fallback)
async function callGroq(systemPrompt, userPrompt) {
  const models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'qwen/qwen3.6-27b'
  ];

  let lastError = null;

  for (const model of models) {
    try {
      // If the user specified a custom client key, call Groq directly; otherwise call the Vercel serverless function
      const endpoint = groqApiKey ? 'https://api.groq.com/openai/v1/chat/completions' : '/api/groq';
      const headers = { 'Content-Type': 'application/json' };
      if (groqApiKey) {
        headers['Authorization'] = `Bearer ${groqApiKey.trim()}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 650
        })
      });

      const data = await res.json();

      if (res.ok && data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }

      if (data.error) {
        lastError = data.error.message || data.error;
        if (data.error.code === 'invalid_api_key' || res.status === 401) {
          throw new Error('Invalid Groq API Key. Please verify your environment variables or custom key.');
        }
      }
    } catch (err) {
      lastError = err.message;
      if (err.message.includes('Invalid Groq API Key')) throw err;
    }
  }

  throw new Error(lastError || "Failed to reach Groq API. Check your Vercel environment variables or internet connection.");
}

// 6. Live AI Abstract Simplifier
async function openSummarizer(i) {
  const p = currentPapers[i];
  $('modal-paper-title').innerText = p.title;
  $('modal-original-abstract').innerText = p.abstract;
  $('modal-simplified-summary').innerHTML = '<em>Generating dynamic AI simplification via Groq...</em>';
  $('summary-modal').classList.remove('hidden');

  try {
    const sysPrompt = "You are an expert academic research simplifier for engineering students. Output 3 clear, structured bullet points: 1) Problem Statement, 2) Methodology Overview, and 3) Key Findings/Impact. Avoid markdown tables.";
    const userPrompt = `Title: ${p.title}\nAbstract: ${p.abstract}\nTopics: ${p.topics.join(', ')}`;

    const result = await callGroq(sysPrompt, userPrompt);
    $('modal-simplified-summary').innerHTML = formatMarkdown(result);
  } catch (err) {
    $('modal-simplified-summary').innerHTML = `<span style="color:#dc2626; font-weight:bold;">⚠️ AI Generation Failed:</span><br>${err.message}<br><br><small>Add your key in <strong>API Settings</strong> or configure <code>GROQ_API_KEY</code> on Vercel.</small>`;
  }
}

// 7. Live AI Research Assistant Chatbot
$('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('chat-input').value.trim();
  if (!q) return;

  appendChatMessage('user', q);
  $('chat-input').value = '';

  const botId = appendChatMessage('ai', 'Analyzing research corpus...');

  try {
    const paperContext = currentPapers.slice(0, 4).map((p, i) => `[Paper ${i+1}] Title: ${p.title}\nAbstract: ${p.abstract}\nTopics: ${p.topics.join(', ')}`).join('\n\n');

    const sysPrompt = "You are ScholarAI, an intelligent research copilot for undergraduate students. Provide a clear, concise, and structured answer (under 180 words) using bullet points and bold highlights. DO NOT output complex markdown tables. Keep formatting clean for a sidebar chat window.";
    const userPrompt = `Retrieved Academic Papers Context:\n${paperContext || 'No papers loaded currently.'}\n\nStudent Question: "${q}"`;

    const answer = await callGroq(sysPrompt, userPrompt);
    updateChatMessage(botId, answer);
  } catch (err) {
    updateChatMessage(botId, `⚠️ AI Error: ${err.message}\n\nPlease check your Groq API key.`);
  }
});

function askAiAboutPaper(i) {
  const paper = currentPapers[i];
  $('chat-input').value = `Explain the methodology and practical significance of: "${paper.title}"`;
  $('chat-form').dispatchEvent(new Event('submit'));
  if (window.innerWidth <= 900) {
    document.querySelector('.sidebar-pane').scrollIntoView({ behavior: 'smooth' });
  }
}

function appendChatMessage(sender, text) {
  const id = `msg-${Date.now()}-${++msgCount}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = `msg ${sender}-msg`;
  div.innerHTML = sender === 'ai' 
    ? `<div class="msg-header">ScholarAI Copilot</div><div>${formatMarkdown(text)}</div>` 
    : escapeHTML(text);
  $('chat-box').appendChild(div);
  $('chat-box').scrollTop = $('chat-box').scrollHeight;
  return id;
}

function updateChatMessage(id, text) {
  const el = $(id);
  if (el) {
    el.innerHTML = `<div class="msg-header">ScholarAI Copilot</div><div>${formatMarkdown(text)}</div>`;
    $('chat-box').scrollTop = $('chat-box').scrollHeight;
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// 8. Visualizations
function drawVisualizations(papers) {
  $('visualizations').classList.remove('hidden');
  const years = {}, topics = {};
  papers.forEach(p => {
    years[p.year] = (years[p.year] || 0) + 1;
    p.topics.forEach(t => topics[t] = (topics[t] || 0) + 1);
  });
  drawChart('trendChart', years);
  drawChart('clusterChart', topics);
}

function drawChart(id, dataMap) {
  const canvas = $(id);
  if (!canvas) return;
  canvas.width = canvas.parentElement.clientWidth || 300;
  canvas.height = 180;

  const ctx = canvas.getContext('2d');
  const keys = Object.keys(dataMap), vals = Object.values(dataMap);
  if (keys.length === 0) return;

  const max = Math.max(...vals, 1);
  const pad = 24, chartH = canvas.height - pad * 2;

  const availableW = canvas.width - pad * 2;
  const rawBarW = (availableW - (keys.length - 1) * 8) / keys.length;
  const barW = Math.min(50, Math.max(12, rawBarW));
  const spacing = (availableW - barW * keys.length) / Math.max(1, keys.length - 1);

  keys.forEach((k, i) => {
    const barH = (vals[i] / max) * (chartH - 20);
    const x = pad + i * (barW + (keys.length === 1 ? 0 : spacing));
    const y = canvas.height - pad - barH;

    ctx.fillStyle = '#4338ca';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(vals[i], x + barW / 2, y - 4);
    ctx.fillStyle = '#64748b';
    ctx.fillText(k.toString().substring(0, 5), x + barW / 2, canvas.height - 6);
  });
}

window.addEventListener('resize', () => currentPapers.length && drawVisualizations(currentPapers));