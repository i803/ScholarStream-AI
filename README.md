# ScholarStream AI 📚🤖

An accessible, client-side research paper discovery and AI summarization workbench designed for engineering students and researchers. ScholarStream AI connects directly to OpenAlex to retrieve global open-access academic literature, uses Groq Cloud LLMs for structured abstract synthesis and interactive question answering, and provides zero-dependency HTML5 Canvas telemetry for publication trends.

---

## 🌟 Key Features

* **Global Academic Discovery**: Search and query across 250M+ open-access publications in real time using the OpenAlex REST API.
* **In-Memory Inverted Index Decoder**: Asynchronously parses token-mapped inverted indices from OpenAlex into clean, human-readable abstracts.
* **Structured AI Simplification**: Condenses complex research abstracts into clear 3-point structured takeaways (*Problem Statement*, *Methodology Overview*, and *Key Findings/Impact*).
* **Context-Grounded AI Research Copilot**: A sticky sidebar research assistant that ingests retrieved papers into its prompt context to answer technical doubts, explain mathematical paradigms, and compare methodologies.
* **HTML5 Canvas Visualizations**: Native, responsive 2D canvas charts displaying temporal publication volume trends and domain taxonomy distributions without external chart libraries.
* **Secure Client-Side Key Management**: Browser-level `localStorage` persistence for Groq API keys with masked inputs and backdrop click-to-close modal support.
* **Fully Responsive UI**: Mobile-optimized fluid grid and flexbox layout adapted for desktops, tablets, and smartphones.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5 (Semantic elements & Canvas 2D API), CSS3 (CSS Grid, Flexbox, Custom Design Tokens), Vanilla JavaScript (ES6+ Fetch, DOM manipulation)
* **Literature Corpus Provider**: [OpenAlex REST API](https://openalex.org/)[cite: 1]
* **AI Inference Engine**: [Groq Cloud](https://console.groq.com/) (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-20b`)
* **Typography & Design**: Plus Jakarta Sans, SVG vector icons

---

## 📁 Repository Structure

```text
ScholarStream-AI/
├── index.html       # Application DOM, search interface, telemetry canvas, and modals
├── style.css        # Responsive stylesheet, CSS variables, mobile breakpoints, and theme
├── app.js           # OpenAlex API pipeline, Groq LLM integration, canvas charts, and chat engine
└── README.md        # Project documentation and setup instructions
