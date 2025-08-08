const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Solar Calculator
app.get('/calculate', (req, res) => {
  const roofSize = parseFloat(req.query.roof_size);
  const currentBill = parseFloat(req.query.current_bill);

  if (!roofSize || roofSize <= 0 || !currentBill || currentBill <= 0) {
    return res.status(400).json({ error: 'Invalid roof size or bill amount' });
  }

  const panelCapacity = 0.25; // kW
  const panelArea = 4; // m²
  const realisticPanelCount = Math.floor(roofSize / panelArea);
  const monthlyEnergyOutput = realisticPanelCount * panelCapacity * 30 * 4;
  const panelCost = realisticPanelCount * 600;
  const installationCost = 2000;
  const totalCost = panelCost + installationCost;
  const monthlySavings = Math.min(currentBill, monthlyEnergyOutput * 0.2);
  const estimatedPayback = (totalCost / monthlySavings).toFixed(1);

  res.json({
    roof_size_sqm: roofSize,
    realistic_panel_count: realisticPanelCount,
    monthly_energy_output_kWh: monthlyEnergyOutput,
    panel_cost_usd: panelCost,
    installation_cost_usd: installationCost,
    total_cost_usd: totalCost,
    monthly_savings_usd: monthlySavings,
    estimated_payback_period_years: estimatedPayback
  });
});

// Assistant logic
const sessions = {};
function newSession() {
  const id = uuidv4();
  sessions[id] = { id, state: 'awaiting_intent', temp: {}, history: [] };
  return sessions[id];
}

app.get('/session', (req, res) => {
  const s = newSession();
  const greeting = `Hi — I'm Smith's Solar Sales Assistant. Type 'estimate' to start.`;
  s.history.push({ from: 'assistant', text: greeting });
  res.json({ sessionId: s.id, message: greeting });
});

app.post('/api/message', (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) return res.status(400).json({ error: 'Missing sessionId or message' });

  const session = sessions[sessionId];
  if (!session) return res.status(400).json({ error: 'Invalid sessionId' });

  const text = message.trim().toLowerCase();
  if (session.state === 'awaiting_intent') {
    if (text.includes('estimate')) {
      session.state = 'awaiting_roof';
      return res.json({ reply: "Please enter the customer's roof size in m².", state: session.state });
    }
    return res.json({ reply: "Say 'estimate' to start.", state: session.state });
  }

  if (session.state === 'awaiting_roof') {
    const n = parseFloat(message);
    if (!n || n <= 0) return res.json({ reply: "Enter a valid roof size." });
    session.temp.roof_size = n;
    session.state = 'awaiting_bill';
    return res.json({ reply: "Now enter their monthly electricity bill in USD.", state: session.state });
  }

  if (session.state === 'awaiting_bill') {
    const n = parseFloat(message);
    if (!n || n <= 0) return res.json({ reply: "Enter a valid bill amount." });
    session.temp.current_bill = n;

    // Calculate
    const panelCapacity = 0.25;
    const panelArea = 4;
    const count = Math.floor(session.temp.roof_size / panelArea);
    const output = count * panelCapacity * 30 * 4;
    const panelCost = count * 600;
    const installCost = 2000;
    const totalCost = panelCost + installCost;
    const savings = Math.min(n, output * 0.2);
    const payback = (totalCost / savings).toFixed(1);

    const reply = `
✅ Solar Estimate for ${session.temp.roof_size} m²
• Panels: ${count}
• Output: ${output.toFixed(1)} kWh/month
• Savings: $${savings.toFixed(2)}
• Total Cost: $${totalCost}
• Payback: ~${payback} years

📌 CRM: Update status to 'Quotation Sent' and set follow-up in 3–5 days.
`.trim();

    session.state = 'done';
    return res.json({ reply, state: session.state });
  }

  res.json({ reply: "Say 'estimate' to start again." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Assistant running at http://localhost:${PORT}`));
