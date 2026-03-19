// ════════════════════════════════════════
// DATABASE
// ════════════════════════════════════════
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem('sika3_'+k)||'null'); } catch { return null; } },
  set: (k,v) => { try { localStorage.setItem('sika3_'+k, JSON.stringify(v)); } catch{} }
};

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let S = {
  tier: DB.get('tier') || 'free',
  txns: DB.get('txns') || [],
  stock: DB.get('stock') || [],
  customers: DB.get('customers') || [],
  codes: DB.get('codes') || []
};

const OWNER_MOMO = '0202204886';
const OWNER_WA   = '233202204886';
const ADMIN_PIN  = '7777';

// FREE LIMITS — these are the conversion triggers
const LIMITS = { txns: 5, stock: 3, customers: 2 };

let currentType = 'income';
let pendingAiTxn = null;
let lastReceiptTxn = null;
let recognition = null;
let logoTaps = 0, logoTimer = null;
let lastGenEntry = null;
let insightIdx = 0;

// Seed demo data
if (!S.stock.length) {
  S.stock = [
    {id:1,name:'Ankara Fabric',qty:18,max:50,price:45,icon:'🪡',supplier:''},
    {id:2,name:'Sewing Thread',qty:4,max:30,price:8,icon:'🧵',supplier:'0201234567'},
    {id:3,name:'Buttons Pack',qty:75,max:100,price:3,icon:'🔘',supplier:''},
  ];
}
if (!S.customers.length) {
  S.customers = [
    {id:1,name:'Akosua Mensah',phone:'0244123456',credit:0,color:'#F5A623',since:'2024-11-01'},
    {id:2,name:'Kofi Boateng',phone:'0201987654',credit:120,color:'#FF6B9D',since:'2024-09-15'},
  ];
}
save();

function save() {
  DB.set('tier', S.tier);
  DB.set('txns', S.txns);
  DB.set('stock', S.stock);
  DB.set('customers', S.customers);
  DB.set('codes', S.codes);
}

function isPro() { return S.tier === 'pro' || S.tier === 'business'; }

// ════════════════════════════════════════
// RESTRICTION ENGINE
// ════════════════════════════════════════
const PAYWALLS = {
  transactions: {
    icon:'💵', title:'Transaction Limit Reached',
    sub:'Free users can record 5 transactions. Upgrade to Pro for unlimited recording — and speak your sales with AI voice.',
    feats:[
      {i:'💵',t:'Unlimited Transactions',d:'Record every sale and expense, forever'},
      {i:'🎙️',t:'AI Voice Recording',d:'Speak your sales — no typing needed'},
      {i:'🧾',t:'WhatsApp Receipts',d:'Send professional receipts to customers'},
      {i:'📊',t:'Full Reports & Insights',d:'Know your profit every single day'},
    ]
  },
  stock: {
    icon:'📦', title:'Stock Limit Reached',
    sub:'Free users can track 3 stock items. Upgrade to Pro to track unlimited inventory with smart reorder alerts.',
    feats:[
      {i:'📦',t:'Unlimited Stock Items',d:'Track every item in your shop'},
      {i:'⚠️',t:'Smart Reorder Alerts',d:'Never run out of stock again'},
      {i:'📲',t:'WhatsApp Supplier Orders',d:'One tap to contact your supplier'},
      {i:'📈',t:'Stock Analytics',d:'See which items sell fastest'},
    ]
  },
  customers: {
    icon:'👥', title:'Customer Book Full',
    sub:'Free users can store 2 customers. Upgrade to Pro for unlimited customers and AI debt collection.',
    feats:[
      {i:'👥',t:'Unlimited Customers',d:'Store every customer with full history'},
      {i:'💰',t:'AI Debt Reminders',d:'Auto-generate polite WhatsApp messages'},
      {i:'📅',t:'Days Owed Tracking',d:'See how long each debt has been outstanding'},
      {i:'🤖',t:'AI Assistant',d:'Ask about your customers anytime'},
    ]
  },
  voice: {
    icon:'🎙️', title:'AI Voice Recording',
    sub:'Speak your sales in Ghanaian English or Twi — no typing. This is a Pro feature.',
    feats:[
      {i:'🎙️',t:'Ghanaian English & Twi',d:'Understands how you actually speak'},
      {i:'⚡',t:'3 Seconds Per Sale',d:'Faster than any manual entry'},
      {i:'🤖',t:'AI Extracts Details',d:'Amount, customer, method — automatically'},
      {i:'✅',t:'Confirm Before Saving',d:'Review what AI heard before saving'},
    ]
  },
  ai_chat: {
    icon:'🤖', title:'AI Business Assistant',
    sub:'Get instant answers about your profit, stock and customers. This is a Pro feature.',
    feats:[
      {i:'🤖',t:'Ask Anything',d:'"How much did I make today?" — instant answer'},
      {i:'🇬🇭',t:'Speaks Ghanaian English',d:'Understands how you talk'},
      {i:'📊',t:'Uses Your Real Data',d:'Answers based on your actual business'},
      {i:'💡',t:'Growth Advice',d:'Personalised tips for your business'},
    ]
  },
  receipt: {
    icon:'🧾', title:'WhatsApp Receipt Generator',
    sub:'Send professional branded receipts to customers on WhatsApp. This is a Pro feature.',
    feats:[
      {i:'🧾',t:'Branded Receipts',d:'Professional receipt with your business name'},
      {i:'📲',t:'One-Tap WhatsApp',d:'Customer gets receipt instantly'},
      {i:'📣',t:'Free Word-of-Mouth',d:'Every receipt shows Sika AI brand'},
      {i:'🤝',t:'Build Trust',d:'Traders with receipts get repeat customers'},
    ]
  },
  report: {
    icon:'📊', title:'Full Reports & AI Insights',
    sub:'Weekly charts, AI insights and monthly PDF reports are Pro features.',
    feats:[
      {i:'📊',t:'Weekly Sales Chart',d:'See your best and worst days clearly'},
      {i:'🧠',t:'AI Business Insights',d:'Personalised tips based on your data'},
      {i:'📄',t:'Monthly PDF Report',d:'For banks and loan officers'},
      {i:'🏆',t:'Best Day Analysis',d:'Know exactly when to stock up'},
    ]
  }
};

function showPaywall(type) {
  const c = PAYWALLS[type] || PAYWALLS.transactions;
  document.getElementById('pw-icon').textContent = c.icon;
  document.getElementById('pw-title').textContent = c.title;
  document.getElementById('pw-sub').textContent = c.sub;
  document.getElementById('pw-feats').innerHTML = c.feats.map(f =>
    `<div class="pw-feat"><div class="pw-feat-ic">${f.i}</div><div class="pw-feat-tx"><strong>${f.t}</strong><span>${f.d}</span></div></div>`
  ).join('');
  document.getElementById('paywall').classList.add('show');
}

function closePaywall() { document.getElementById('paywall').classList.remove('show'); }

function checkLimit(type) {
  if (isPro()) return true;
  if (type === 'txns' && S.txns.length >= LIMITS.txns) {
    closeModal('mo-sale'); closeModal('mo-expense');
    showPaywall('transactions'); return false;
  }
  if (type === 'stock' && S.stock.length >= LIMITS.stock) {
    closeModal('mo-stock'); showPaywall('stock'); return false;
  }
  if (type === 'customers' && S.customers.length >= LIMITS.customers) {
    closeModal('mo-cust'); showPaywall('customers'); return false;
  }
  // Warn on last slot
  if (type === 'txns' && S.txns.length === LIMITS.txns - 1) {
    toast('⚠️ Last free transaction! Upgrade for unlimited.','w');
  }
  return true;
}

function updateLimitBanner() {
  const b = document.getElementById('limit-banner');
  b.classList.toggle('hidden', isPro() || S.txns.length < LIMITS.txns);
}

function updateUpgradeUI() {
  const badge = document.getElementById('tier-badge');
  const proBtn = document.getElementById('pro-btn');
  const freeBtn = document.getElementById('free-btn');
  const aiSub = document.getElementById('ai-qa-sub');
  if (isPro()) {
    badge.textContent = S.tier === 'business' ? 'BUSINESS 🏢' : 'PRO 💎';
    badge.className = 'tier-pill t-pro';
    if (proBtn) { proBtn.textContent = '✓ Your Active Plan'; proBtn.className = 'plan-btn active-plan'; proBtn.onclick = null; }
    if (freeBtn) freeBtn.textContent = 'Downgrade to Free';
    if (aiSub) aiSub.textContent = 'Your AI assistant';
  } else {
    badge.textContent = 'FREE';
    badge.className = 'tier-pill t-free';
    if (aiSub) aiSub.textContent = 'Pro feature 🔒';
  }
}

// ════════════════════════════════════════
// PIN
// ════════════════════════════════════════
let pinVal = '';
function pk(k) {
  if (pinVal.length >= 4) return;
  pinVal += k; updPD();
  if (pinVal.length === 4) {
    setTimeout(() => {
      if (pinVal === '1234') { enterApp(); }
      else {
        document.getElementById('pin-err').textContent = 'Wrong PIN. Try again.';
        pinVal = ''; updPD();
        setTimeout(() => document.getElementById('pin-err').textContent = '', 1500);
      }
    }, 200);
  }
}
function pdel() { pinVal = pinVal.slice(0,-1); updPD(); document.getElementById('pin-err').textContent = ''; }
function updPD() { for(let i=0;i<4;i++) document.getElementById('pd'+i).classList.toggle('on', i<pinVal.length); }

// ════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════
function startApp() { showOnly('screen-pin'); }
function enterApp() {
  document.getElementById('bnav').style.display = 'flex';
  document.getElementById('voice-fab').style.display = 'flex';
  go('screen-home');
}
function showOnly(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
const NAV = ['screen-home','screen-sales','screen-stock','screen-report','screen-customers'];

function go(id) {
  // Gate Pro screens
  if (id === 'screen-ai' && !isPro()) { showPaywall('ai_chat'); return; }
  showOnly(id);
  const idx = NAV.indexOf(id);
  document.querySelectorAll('.ni').forEach((n,i) => n.classList.toggle('active', i===idx));
  document.getElementById('voice-fab').style.display = ['screen-home','screen-sales'].includes(id) ? 'flex' : 'none';
  refresh(id);
}
function navTo(id) { go(id); }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function cmo(e,id) { if(e.target.classList.contains('mo')) closeModal(id); }
function setType(t) {
  currentType = t;
  document.getElementById('t-inc').className = 'tb_ '+(t==='income'?'si':'');
  document.getElementById('t-exp').className = 'tb_ '+(t==='expense'?'se':'');
}

// ════════════════════════════════════════
// VOICE AI
// ════════════════════════════════════════
function handleVoiceTap() {
  if (!isPro()) { showPaywall('voice'); return; }
  startVoice();
}

function startVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { toast('Use Chrome browser for voice recording','w'); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-GH'; recognition.continuous = false; recognition.interimResults = false;
  document.getElementById('listen-ov').classList.add('show');
  document.getElementById('listen-txt').textContent = 'Listening... speak now';
  recognition.onresult = async e => {
    const t = e.results[0][0].transcript;
    document.getElementById('listen-txt').textContent = `"${t}"`;
    setTimeout(() => { document.getElementById('listen-ov').classList.remove('show'); processVoice(t); }, 600);
  };
  recognition.onerror = e => {
    document.getElementById('listen-ov').classList.remove('show');
    if (e.error==='not-allowed') toast('Microphone permission denied','e');
    else toast('Voice error. Try again.','e');
  };
  recognition.onend = () => document.getElementById('listen-ov').classList.remove('show');
  recognition.start();
}
function stopVoice() { if(recognition) recognition.stop(); document.getElementById('listen-ov').classList.remove('show'); }

async function processVoice(transcript) {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 300,
        system: `Extract transaction from Ghanaian trader voice input. Handle English/Twi/Pidgin mix. Return ONLY JSON: {"type":"income"or"expense","amount":number,"description":"string","customer":"string","method":"MoMo"or"Cash","action":"record_transaction"or"query"}`,
        messages: [{role:'user',content:transcript}]
      })
    });
    const data = await resp.json();
    const parsed = JSON.parse((data.content?.[0]?.text||'{}').replace(/```json|```/g,'').trim());
    if (parsed.action === 'record_transaction') { pendingAiTxn = parsed; showAiConfirm(parsed, transcript); }
    else { go('screen-ai'); setTimeout(() => askAI(transcript), 400); }
  } catch {
    const fb = fallbackParse(transcript);
    if (fb) { pendingAiTxn = fb; showAiConfirm(fb, transcript); }
    else toast('Could not understand. Try again.','w');
  }
}

function fallbackParse(t) {
  const am = t.match(/(\d+(?:\.\d{1,2})?)/);
  if (!am) return null;
  return { type:/expense|bought|paid|spent/i.test(t)?'expense':'income', amount:parseFloat(am[1]), description:t.slice(0,50), customer:'', method:/momo|mobile/i.test(t)?'MoMo':'Cash', action:'record_transaction' };
}

function showAiConfirm(p, orig) {
  document.getElementById('ai-confirm-content').innerHTML = `
    <div style="background:var(--s2);border-radius:var(--rs);padding:15px;margin-bottom:14px;">
      <div style="font-size:9px;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">I understood this as:</div>
      <div class="sum-row"><span class="sum-l">Type</span><span class="sum-v" style="color:${p.type==='income'?'var(--green)':'var(--red)'}">${p.type==='income'?'💵 Income':'🧾 Expense'}</span></div>
      <div class="sum-row"><span class="sum-l">Amount</span><span class="sum-v">GHS ${(p.amount||0).toFixed(2)}</span></div>
      <div class="sum-row"><span class="sum-l">Description</span><span style="font-size:12px;color:var(--txt)">${p.description||'—'}</span></div>
      ${p.customer?`<div class="sum-row"><span class="sum-l">Customer</span><span style="font-size:12px">${p.customer}</span></div>`:''}
      <div class="sum-row"><span class="sum-l">Method</span><span style="font-size:12px">${p.method==='MoMo'?'📱 MoMo':'💵 Cash'}</span></div>
    </div>
    <div style="font-size:11px;color:var(--muted);">You said: <em>"${orig}"</em></div>`;
  openModal('mo-aiconfirm');
}

function confirmAiTxn() {
  if (!pendingAiTxn) return;
  const t = {id:Date.now(),desc:pendingAiTxn.description||'Voice sale',amt:pendingAiTxn.amount||0,cust:pendingAiTxn.customer||'',method:pendingAiTxn.method||'Cash',type:pendingAiTxn.type||'income',time:new Date().toISOString(),ai:true};
  S.txns.unshift(t); save(); closeModal('mo-aiconfirm'); pendingAiTxn = null;
  refresh('screen-home'); toast('✓ AI recorded transaction!');
  if (t.type === 'income') { lastReceiptTxn = t; setTimeout(() => openReceiptModal(t), 500); }
}

// ════════════════════════════════════════
// AI CHAT
// ════════════════════════════════════════
async function sendAiMsg() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim(); if (!msg) return;
  input.value = '';
  appendMsg(msg, 'user');
  appendMsg('...', 'bot', 'thinking');
  await askAI(msg);
}

async function askAI(question) {
  const thinking = document.querySelector('.ai-msg.thinking');
  const today = S.txns.filter(t => new Date(t.time).toDateString() === new Date().toDateString());
  const inc = today.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt,0);
  const exp = today.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt,0);
  const debtors = S.customers.filter(c=>c.credit>0);
  const lowStock = S.stock.filter(s=>(s.qty/s.max)<0.25);
  const ctx = `Business: today sales=GHS ${inc.toFixed(2)}, expenses=GHS ${exp.toFixed(2)}, profit=GHS ${(inc-exp).toFixed(2)}, ${today.length} transactions. Customers: ${S.customers.map(c=>`${c.name}(owes GHS ${c.credit})`).join(',')}. Low stock: ${lowStock.map(s=>s.name).join(',') || 'none'}. Stock: ${S.stock.map(s=>`${s.name}:${s.qty}units`).join(',')}. Total transactions: ${S.txns.length}.`;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 250,
        system: `You are Sika AI, a friendly business assistant for a Ghanaian trader. Answer in warm Ghanaian English. Be concise (2-3 sentences). Use this data: ${ctx}. Never mention Claude.`,
        messages: [{role:'user',content:question}]
      })
    });
    const data = await resp.json();
    if (thinking) thinking.remove();
    appendMsg(data.content?.[0]?.text || "I couldn't process that right now.", 'bot');
  } catch {
    if (thinking) thinking.remove();
    appendMsg(localAnswer(question, inc, exp, debtors, lowStock), 'bot');
  }
}

function localAnswer(q, inc, exp, debtors, lowStock) {
  if (/today|profit|how much/i.test(q)) return `Today you made GHS ${inc.toFixed(2)} in sales and spent GHS ${exp.toFixed(2)}. Your net profit is GHS ${(inc-exp).toFixed(2)}. ${inc>exp?'Profitable day! Keep it up 💪':'Focus on reducing expenses.'}`;
  if (/owe|debt|credit/i.test(q)) return debtors.length ? `${debtors.length} customer${debtors.length!==1?'s':''} owe you: ${debtors.map(c=>`${c.name} (GHS ${c.credit})`).join(', ')}.` : 'Great news — no outstanding debts! All customers are clear. ✅';
  if (/stock|reorder/i.test(q)) return lowStock.length ? `Reorder urgently: ${lowStock.map(s=>s.name).join(', ')}. These are below 25%.` : 'All stock levels are healthy. 📦';
  if (/grow|advice|tip/i.test(q)) return `Focus on your best-selling items and keep them stocked. Use WhatsApp receipts — customers who get receipts come back more. Track every expense, even small ones.`;
  return `I can check today's profit, see who owes you money, check your stock levels, and give growth tips. What do you need?`;
}

function appendMsg(text, type, cls='') {
  const chat = document.getElementById('ai-chat');
  const div = document.createElement('div');
  div.className = `ai-msg ${type} ${cls}`.trim();
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ════════════════════════════════════════
// AI HOME INSIGHT
// ════════════════════════════════════════
const insightFns = [
  () => { const t=S.txns.filter(x=>new Date(x.time).toDateString()===new Date().toDateString()); const inc=t.filter(x=>x.type==='income').reduce((s,x)=>s+x.amt,0); return t.length?`You've made GHS ${inc.toFixed(2)} today from ${t.length} transaction${t.length!==1?'s':''}. ${inc>50?'Strong day! 💪':'Every sale counts — keep going.'}`:'No sales recorded yet today. Tap Add Sale or speak 🎙️ to start.'; },
  () => { const d=S.customers.filter(c=>c.credit>0); return d.length?`💰 ${d.length} customer${d.length!==1?'s':''} owe you GHS ${d.reduce((s,c)=>s+c.credit,0).toFixed(2)}. Send a WhatsApp reminder today.`:'✅ All customers are clear. No outstanding debts.'; },
  () => { const l=S.stock.filter(s=>(s.qty/s.max)<0.25); return l.length?`⚠️ Low stock: ${l.map(s=>s.name).join(', ')}. Reorder before you run out.`:'📦 All stock levels are healthy.'; },
  () => `📊 You have ${S.txns.length} transaction${S.txns.length!==1?'s':''} recorded. Consistent tracking is how profitable businesses are built.`,
];

function refreshInsight() {
  document.getElementById('ai-insight-txt').textContent = insightFns[insightIdx % insightFns.length]();
  insightIdx++;
}

// ════════════════════════════════════════
// TRANSACTIONS
// ════════════════════════════════════════
function addTxn() {
  if (!checkLimit('txns')) return;
  const desc = document.getElementById('s-desc').value.trim();
  const amt = parseFloat(document.getElementById('s-amt').value);
  const cust = document.getElementById('s-cust').value.trim();
  const method = document.getElementById('s-method').value;
  if (!desc || !amt || amt<=0) { toast('Fill in all fields!','e'); return; }
  const t = {id:Date.now(),desc,amt,cust,method,type:currentType,time:new Date().toISOString()};
  S.txns.unshift(t); save(); closeModal('mo-sale'); clearF(['s-desc','s-amt','s-cust']);
  refresh('screen-home'); toast('✓ Transaction saved!');
  if (currentType==='income' && isPro()) { lastReceiptTxn=t; setTimeout(()=>openReceiptModal(t),400); }
}

function addExpense() {
  if (!checkLimit('txns')) return;
  const desc = document.getElementById('e-desc').value.trim();
  const amt = parseFloat(document.getElementById('e-amt').value);
  const method = document.getElementById('e-method').value;
  if (!desc || !amt || amt<=0) { toast('Fill in all fields!','e'); return; }
  S.txns.unshift({id:Date.now(),desc,amt,cust:'',method,type:'expense',time:new Date().toISOString()});
  save(); closeModal('mo-expense'); clearF(['e-desc','e-amt']); refresh('screen-home'); toast('✓ Expense saved!');
}

// ════════════════════════════════════════
// STOCK
// ════════════════════════════════════════
function addStock() {
  if (!checkLimit('stock')) return;
  const n=document.getElementById('sk-n').value.trim(), q=parseInt(document.getElementById('sk-q').value), p=parseFloat(document.getElementById('sk-p').value)||0, sup=document.getElementById('sk-sup').value.trim(), ic=document.getElementById('sk-ic').value||'📦';
  if (!n||!q) { toast('Fill name & quantity!','e'); return; }
  S.stock.unshift({id:Date.now(),name:n,qty:q,max:q,price:p,icon:ic,supplier:sup});
  save(); closeModal('mo-stock'); clearF(['sk-n','sk-q','sk-p','sk-sup','sk-ic']); renderStock(); toast('✓ Stock item added!');
}

// ════════════════════════════════════════
// CUSTOMERS
// ════════════════════════════════════════
function addCustomer() {
  if (!checkLimit('customers')) return;
  const n=document.getElementById('cn').value.trim(), p=document.getElementById('cp').value.trim(), c=parseFloat(document.getElementById('cc').value)||0;
  if (!n) { toast('Enter customer name!','e'); return; }
  const colors=['#F5A623','#FF6B9D','#7DD3FC','#86EFAC','#C084FC'];
  S.customers.unshift({id:Date.now(),name:n,phone:p,credit:c,color:colors[Math.floor(Math.random()*colors.length)],since:new Date().toISOString().split('T')[0]});
  save(); closeModal('mo-cust'); clearF(['cn','cp','cc']); renderCustomers(); toast('✓ Customer added!');
}

function sendDebtReminder(cust) {
  if (!isPro()) { showPaywall('ai_chat'); return; }
  const msg = encodeURIComponent(`Hello ${cust.name}! 👋\n\nFriendly reminder: you have an outstanding balance of *GHS ${cust.credit.toFixed(2)}* at our shop.\n\nKindly settle when convenient. Thank you! 🙏\n_Sent via Sika AI_`);
  window.open(`https://wa.me/${(cust.phone||'').replace(/^0/,'233')}?text=${msg}`,'_blank');
}

// ════════════════════════════════════════
// RECEIPT
// ════════════════════════════════════════
function openReceiptModal(t) {
  if (!isPro()) { showPaywall('receipt'); return; }
  const d=new Date(t.time), ds=d.toLocaleDateString('en-GH',{day:'numeric',month:'short',year:'numeric'}), ts=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  document.getElementById('receipt-content').innerHTML = `
    <div class="receipt">
      <div class="rcpt-head"><div class="rcpt-brand">Sika</div><div class="rcpt-tag">Official Receipt · AI Business Platform</div></div>
      <div class="rcpt-row"><span>Date</span><span>${ds}</span></div>
      <div class="rcpt-row"><span>Time</span><span>${ts}</span></div>
      <div class="rcpt-row"><span>Item</span><span>${t.desc}</span></div>
      ${t.cust?`<div class="rcpt-row"><span>Customer</span><span>${t.cust}</span></div>`:''}
      <div class="rcpt-row"><span>Method</span><span>${t.method}</span></div>
      <div class="rcpt-row tot"><span>TOTAL PAID</span><span>GHS ${t.amt.toFixed(2)}</span></div>
      <div class="rcpt-footer"><strong>Thank you for your business! 🙏</strong>Generated by Sika AI · Know Your Money · 0202204886</div>
    </div>`;
  openModal('mo-receipt');
}

function sendWhatsApp() {
  if (!lastReceiptTxn) return;
  const t=lastReceiptTxn, d=new Date(t.time), ds=d.toLocaleDateString('en-GH',{day:'numeric',month:'short',year:'numeric'});
  const msg=encodeURIComponent(`🧾 *RECEIPT — SIKA AI*\n━━━━━━━━━━━━\n📅 ${ds}\n📝 ${t.desc}\n${t.cust?`👤 ${t.cust}\n`:''}💳 ${t.method}\n━━━━━━━━━━━━\n💰 *GHS ${t.amt.toFixed(2)}*\n━━━━━━━━━━━━\n_Thank you! 🙏_\n_Powered by Sika AI_`);
  window.open(`https://wa.me/?text=${msg}`,'_blank');
  toast('Receipt ready to send!');
}

// ════════════════════════════════════════
// REPORT
// ════════════════════════════════════════
function handlePdfClick() {
  if (!isPro()) { showPaywall('report'); return; }
  generatePDF();
}

function generatePDF() {
  const now=new Date(), month=now.toLocaleDateString('en-GH',{month:'long',year:'numeric'});
  const inc=S.txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt,0);
  const exp=S.txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt,0);
  const profit=inc-exp;
  const html=`<!DOCTYPE html><html><head><style>body{font-family:Georgia,serif;max-width:600px;margin:40px auto;padding:40px;color:#111;}h1{font-size:36px;color:#C4821A;letter-spacing:2px;margin-bottom:4px;font-style:italic;}sub{font-size:13px;color:#888;font-style:normal;}.badge{background:#f0e8ff;color:#6b46c1;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;display:inline-block;margin:6px 0 24px;}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee;font-size:14px;}.row.total{font-weight:700;font-size:18px;border-top:2px solid #C4821A;border-bottom:none;margin-top:8px;}.pos{color:#00a07a;}.neg{color:#cc0000;}.footer{margin-top:40px;text-align:center;color:#aaa;font-size:10px;border-top:1px solid #eee;padding-top:20px;}</style></head><body>
  <h1>Sika<sub> AI</sub></h1><div class="badge">🤖 AI-Powered Report</div>
  <h2 style="font-size:16px;color:#888;font-weight:400;margin-bottom:20px;">Monthly Report — ${month}</h2>
  <div class="row"><span>Total Sales Revenue</span><span class="pos">GHS ${inc.toFixed(2)}</span></div>
  <div class="row"><span>Total Business Expenses</span><span class="neg">GHS ${exp.toFixed(2)}</span></div>
  <div class="row total"><span>Net Profit</span><span class="${profit>=0?'pos':'neg'}">GHS ${profit.toFixed(2)}</span></div>
  <div class="row"><span>Total Transactions Recorded</span><span>${S.txns.length}</span></div>
  <div class="row"><span>AI-Recorded Transactions</span><span>${S.txns.filter(t=>t.ai).length}</span></div>
  <div class="row"><span>Customers Tracked</span><span>${S.customers.length}</span></div>
  <div class="row"><span>Outstanding Customer Credit</span><span class="neg">GHS ${S.customers.reduce((s,c)=>s+c.credit,0).toFixed(2)}</span></div>
  <div class="row"><span>Stock Items Monitored</span><span>${S.stock.length}</span></div>
  <div class="footer">Generated by Sika AI · Ghana's Business Intelligence Platform<br>Contact: 0202204886 · Report: ${now.toLocaleDateString('en-GH')}</div>
  </body></html>`;
  const blob=new Blob([html],{type:'text/html'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`Sika-AI-Report-${month.replace(' ','-')}.html`; a.click();
  URL.revokeObjectURL(url); toast('📄 Report downloaded!');
}

// ════════════════════════════════════════
// MOMO PAYMENT & ACTIVATION
// ════════════════════════════════════════
function sendPaymentWA(plan, amount) {
  const msg = encodeURIComponent(`Hello! I just sent GHS ${amount} to *${OWNER_MOMO}* for *Sika AI ${plan}*.\n\nReference: SIKA ${plan.toUpperCase()}\n\nPlease send my activation code. Thank you! 🙏`);
  window.open(`https://wa.me/${OWNER_WA}?text=${msg}`,'_blank');
  toast('Opening WhatsApp...','w');
}

function activateCode(code, modalId) {
  code = (code||'').trim().toUpperCase();
  if (!code || code.length < 6) { toast('Enter a valid activation code!','e'); return; }
  const entry = S.codes.find(c => c.code === code && !c.used);
  if (entry) {
    entry.used = true;
    entry.usedDate = new Date().toLocaleDateString('en-GH');
    S.tier = entry.plan;
    save();
    if (modalId) closeModal(modalId);
    document.getElementById('activate-code').value = '';
    updateUpgradeUI();
    go('screen-home');
    toast(`🎉 ${entry.plan==='pro'?'Pro':'Business'} activated! Welcome!`);
  } else if (S.codes.find(c => c.code === code && c.used)) {
    toast('This code has already been used.','e');
  } else {
    toast('Invalid code. Please check and try again.','e');
  }
}

// ════════════════════════════════════════
// ADMIN PANEL
// ════════════════════════════════════════
let adminAttempts = 0;
function openAdmin() {
  const pin = prompt('Enter admin PIN:');
  if (pin === ADMIN_PIN) { adminAttempts=0; go('screen-admin'); renderAdmin(); }
  else { adminAttempts++; toast(adminAttempts>=3?'Too many attempts.':'Wrong PIN.','e'); }
}

function generateCode() {
  const name=document.getElementById('g-name').value.trim();
  const phone=document.getElementById('g-phone').value.trim();
  const plan=document.getElementById('g-plan').value;
  const paid=document.getElementById('g-paid').value;
  if (!name) { toast('Enter customer name!','e'); return; }
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='SIKA-';
  for(let i=0;i<4;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  const entry={code,name,phone,plan,paid,date:new Date().toLocaleDateString('en-GH'),used:false,amount:plan==='pro'?40:80};
  S.codes.unshift(entry); save(); lastGenEntry=entry;
  document.getElementById('gen-code-display').textContent=code;
  document.getElementById('gen-result').style.display='block';
  clearF(['g-name','g-phone']); renderAdmin(); toast('✓ Code generated!');
}

function sendCodeWA() {
  if (!lastGenEntry) return;
  const e=lastGenEntry;
  const msg=encodeURIComponent(`Hello ${e.name}! 👋\n\nYour *Sika AI ${e.plan==='pro'?'Pro':'Business'}* activation code is:\n\n*${e.code}*\n\nOpen Sika AI → Upgrade → Enter this code to activate instantly.\n\nThank you for upgrading! 🎉\n_Sika AI — Know Your Money_`);
  window.open(`https://wa.me/${e.phone.replace(/^0/,'233')}?text=${msg}`,'_blank');
  toast('Sending code to customer!');
}

function copyGenCode() {
  const code=document.getElementById('gen-code-display').textContent;
  copyText(code,'Code copied!');
}

function renderAdmin() {
  const paid=S.codes.filter(c=>c.paid==='paid');
  const used=S.codes.filter(c=>c.used);
  const pend=S.codes.filter(c=>!c.used&&c.paid==='pending');
  document.getElementById('a-users').textContent=used.length;
  document.getElementById('a-rev').textContent=`GHS ${paid.reduce((s,c)=>s+c.amount,0)}`;
  document.getElementById('a-codes').textContent=S.codes.length;
  document.getElementById('a-pending').textContent=pend.length;
  const momoInput=document.getElementById('momo-num-input');
  if(momoInput) momoInput.placeholder=OWNER_MOMO;
  const el=document.getElementById('codes-list');
  if(!S.codes.length){el.innerHTML='<div style="color:var(--dim);font-size:12px;text-align:center;padding:20px;">No codes yet. Generate your first one above.</div>';return;}
  el.innerHTML=S.codes.map(c=>`
    <div style="background:var(--s1);border:1px solid ${c.used?'rgba(0,229,160,.2)':c.paid==='pending'?'rgba(255,77,109,.2)':'var(--border)'};border-radius:var(--rs);padding:12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
        <div style="font-family:var(--fd);font-size:18px;font-style:italic;color:var(--gold);letter-spacing:2px;">${c.code}</div>
        <div style="font-size:9px;padding:2px 8px;border-radius:20px;font-weight:700;background:${c.used?'rgba(0,229,160,.12)':c.paid==='paid'?'rgba(245,166,35,.12)':'rgba(255,77,109,.12)'};color:${c.used?'var(--green)':c.paid==='paid'?'var(--gold)':'var(--red)'};">${c.used?'USED':c.paid==='paid'?'PAID':'PENDING'}</div>
      </div>
      <div style="font-size:12px;font-weight:600;">${c.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px;">${c.phone||'No phone'} · ${c.plan==='pro'?'Pro GHS 40':'Biz GHS 80'} · ${c.date}</div>
      ${!c.used&&c.phone?`<button style="margin-top:8px;background:var(--s3);border:none;border-radius:7px;padding:6px 12px;color:var(--gold);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--f);" onclick="resendCode('${c.code}','${c.name}','${c.phone}','${c.plan}')">📲 Resend</button>`:''}
    </div>`).join('');
}

function resendCode(code, name, phone, plan) {
  const msg=encodeURIComponent(`Hello ${name}! 👋\n\nYour *Sika AI ${plan==='pro'?'Pro':'Business'}* code:\n\n*${code}*\n\nEnter in Sika AI → Upgrade to activate. 🎉\n_Sika AI_`);
  window.open(`https://wa.me/${phone.replace(/^0/,'233')}?text=${msg}`,'_blank');
}

function saveMomoNum() {
  const v=document.getElementById('momo-num-input').value.trim();
  if(v) toast('MoMo number saved! Update in code for permanent change.','w');
}

// ════════════════════════════════════════
// RENDERS
// ════════════════════════════════════════
function refresh(id) {
  renderHome();
  if(id==='screen-sales') renderAllTxns();
  if(id==='screen-stock') renderStock();
  if(id==='screen-report') renderReport();
  if(id==='screen-customers') renderCustomers();
  if(id==='screen-admin') renderAdmin();
}

const todayStr = () => new Date().toDateString();

function renderHome() {
  updateUpgradeUI(); updateLimitBanner(); refreshInsight();
  const today=S.txns.filter(t=>new Date(t.time).toDateString()===todayStr());
  const inc=today.filter(t=>t.type==='income').reduce((s,t)=>s+t.amt,0);
  const exp=today.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amt,0);
  const net=inc-exp;
  document.getElementById('h-profit').textContent=net.toFixed(2);
  document.getElementById('h-profit').style.color=net>=0?'var(--txt)':'var(--red)';
  document.getElementById('h-sub').textContent=`${today.length} transaction${today.length!==1?'s':''} today`;
  document.getElementById('h-in').textContent=`GHS ${inc.toFixed(0)} in`;
  document.getElementById('h-out').textContent=`GHS ${exp.toFixed(0)} out`;
  document.getElementById('summary-content').innerHTML=`
    <div class="sum-row"><span class="sum-l">Total Sales</span><span class="sum-v pos">GHS ${inc.toFixed(2)}</span></div>
    <div class="sum-row"><span class="sum-l">Total Expenses</span><span class="sum-v neg">GHS ${exp.toFixed(2)}</span></div>
    <div class="sum-row"><span class="sum-l">Net Profit</span><span class="sum-v ${net>=0?'pos':'neg'}">GHS ${net.toFixed(2)}</span></div>
    <div class="sum-row"><span class="sum-l">Transactions Today</span><span class="sum-v">${today.length}</span></div>
    <div class="sum-row"><span class="sum-l">MoMo Payments</span><span class="sum-v">${today.filter(t=>t.method==='MoMo').length}</span></div>
    <div class="sum-row"><span class="sum-l">AI Recorded</span><span class="sum-v" style="color:var(--purple)">${today.filter(t=>t.ai).length}</span></div>`;
  const el=document.getElementById('h-txns');
  const recent=S.txns.slice(0,5);
  el.innerHTML=recent.length?recent.map(txnCard).join(''):emptyEl('📋','No transactions yet.<br>Tap <strong>Add Sale</strong> to start.');
}

function txnCard(t) {
  const isIn=t.type==='income';
  const init=t.desc.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const time=new Date(t.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const aiTag=t.ai?'<span class="tag tai">AI</span> ':'';
  const mTag=`<span class="tag ${t.method==='MoMo'?'tm':'tc'}">${t.method}</span>`;
  const rcptBtn=isIn&&isPro()?`<span style="font-size:14px;cursor:pointer;margin-right:2px;" onclick="event.stopPropagation();lastReceiptTxn=S.txns.find(x=>x.id==${t.id});openReceiptModal(lastReceiptTxn)">🧾</span>`:'';
  return `<div class="txi">
    <div class="txa ${isIn?'avg':'avr'}">${init}</div>
    <div class="txinfo"><div class="txn-name">${t.desc}</div><div class="txm">${aiTag}${mTag}${t.cust?`<span>· ${t.cust}</span>`:''}</div></div>
    <div class="txamt">${rcptBtn}<div class="txv ${isIn?'inc':'exp-c'}">${isIn?'+':'-'}GHS ${t.amt.toFixed(2)}</div><div class="txtime">${time}</div></div>
  </div>`;
}

function renderAllTxns() {
  document.getElementById('all-txns').innerHTML=S.txns.length?S.txns.map(txnCard).join(''):emptyEl('💸','No transactions yet.');
}

function renderStock() {
  const el=document.getElementById('sk-list');
  if(!S.stock.length){el.innerHTML=emptyEl('📦','No stock items.<br>Tap <strong>+ Add</strong> to start.');return;}
  // Show lock for free users after limit
  const showLock=!isPro()&&S.stock.length>=LIMITS.stock;
  el.innerHTML=S.stock.map(s=>{
    const pct=Math.min(100,(s.qty/(s.max||1))*100),isLow=pct<25,isMid=pct<55;
    const fc=isLow?'fr-b':isMid?'fy':'fg';
    const supBtn=s.supplier&&isPro()?`<div class="sk-sup" onclick="contactSup('${s.supplier}','${s.name}')">📲 WhatsApp supplier</div>`:'';
    return`<div class="ski">
      <div class="sk-ic">${s.icon||'📦'}</div>
      <div class="sk-info">
        <div class="sk-name">${s.name}${isLow?' ⚠️':''}</div>
        <div class="sk-price">GHS ${s.price.toFixed(2)} / unit</div>
        <div class="sk-bar"><div class="sk-fill ${fc}" style="width:${pct}%"></div></div>
        ${supBtn}
      </div>
      <div class="sk-qty"><div class="sk-qn ${isLow?'sk-low':''}">${s.qty}</div><div class="sk-ql">units</div></div>
    </div>`;
  }).join('')+(showLock?`<div onclick="showPaywall('stock')" style="background:var(--s2);border:2px dashed rgba(245,166,35,.3);border-radius:var(--rs);padding:16px;text-align:center;cursor:pointer;"><div style="font-size:20px;margin-bottom:4px;">🔒</div><div style="font-size:12px;color:var(--gold);font-weight:700;">Upgrade to add more stock items</div><div style="font-size:11px;color:var(--muted);margin-top:3px;">Free limit: 3 items</div></div>`:'');
}

function contactSup(phone,item) {
  window.open(`https://wa.me/${phone.replace(/^0/,'233')}?text=${encodeURIComponent(`Hello! I need to reorder *${item}* please. Confirm availability and price. Thank you! 🙏`)}`,'_blank');
}

function renderReport() {
  const now=new Date();
  const days=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-(6-i));return d;});
  const dStrs=days.map(d=>d.toDateString());
  const tots=dStrs.map(ds=>S.txns.filter(t=>t.type==='income'&&new Date(t.time).toDateString()===ds).reduce((s,t)=>s+t.amt,0));
  const wInc=S.txns.filter(t=>t.type==='income'&&dStrs.includes(new Date(t.time).toDateString())).reduce((s,t)=>s+t.amt,0);
  const wExp=S.txns.filter(t=>t.type==='expense'&&dStrs.includes(new Date(t.time).toDateString())).reduce((s,t)=>s+t.amt,0);
  const wCount=S.txns.filter(t=>dStrs.includes(new Date(t.time).toDateString())).length;
  const profit=wInc-wExp;
  const bestIdx=tots.indexOf(Math.max(...tots));
  const dayN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  document.getElementById('r-sales').textContent=`GHS ${wInc.toFixed(2)}`;
  document.getElementById('r-exp').textContent=`GHS ${wExp.toFixed(2)}`;
  document.getElementById('r-profit').textContent=`GHS ${profit.toFixed(2)}`;
  document.getElementById('r-profit').className='rc-v '+(profit>=0?'pos':'neg');
  document.getElementById('r-ps').textContent=profit>=0?'↑ Profitable week':'↓ Review your expenses';
  document.getElementById('r-count').textContent=wCount;
  document.getElementById('r-best').textContent=tots[bestIdx]>0?dayN[days[bestIdx].getDay()]:'—';
  const maxV=Math.max(...tots,1);
  document.getElementById('r-chart').innerHTML=days.map((d,i)=>{
    const h=Math.round((tots[i]/maxV)*60),isT=d.toDateString()===todayStr();
    return`<div class="cc"><div class="cb-w"><div class="cb ${isT?'act':''}" style="height:${h||3}px"></div></div><div class="cd">${dayN[d.getDay()][0]}</div></div>`;
  }).join('');
  // Insights — locked for free users
  if (!isPro()) {
    document.getElementById('insights-content').innerHTML=`<div onclick="showPaywall('report')" style="text-align:center;cursor:pointer;padding:16px 0;"><div style="font-size:28px;margin-bottom:8px;">🔒</div><div style="font-size:13px;color:var(--gold);font-weight:700;">Unlock AI Business Insights</div><div style="font-size:11px;color:var(--muted);margin-top:4px;">Upgrade to Pro to see personalised insights</div></div>`;
    return;
  }
  const lowStock=S.stock.filter(s=>(s.qty/s.max)<0.25);
  const debtors=S.customers.filter(c=>c.credit>0);
  const ins=[];
  if(tots[bestIdx]>0) ins.push({i:'📈',t:`Best sales day: ${dayN[days[bestIdx].getDay()]}`,s:'Consider stocking up the day before.'});
  if(lowStock.length) ins.push({i:'⚠️',t:'Low stock alert',s:`${lowStock.map(s=>s.name).join(', ')} need restocking.`});
  if(debtors.length) ins.push({i:'💰',t:`GHS ${debtors.reduce((s,c)=>s+c.credit,0).toFixed(2)} in outstanding credit`,s:`${debtors.length} customer${debtors.length!==1?'s':''} owe you money.`});
  if(S.txns.filter(t=>t.ai).length>0) ins.push({i:'🤖',t:`${S.txns.filter(t=>t.ai).length} AI-recorded transactions`,s:'Voice recording is saving you time every day.'});
  document.getElementById('insights-content').innerHTML=ins.length?ins.map(x=>`<div class="insight"><div class="ins-ic">${x.i}</div><div class="ins-tx"><strong>${x.t}</strong><span>${x.s}</span></div></div>`).join(''):'<div style="color:var(--dim);font-size:12px;">Add more transactions to see AI insights.</div>';
}

function renderCustomers() {
  const el=document.getElementById('c-list');
  if(!S.customers.length){el.innerHTML=emptyEl('👥','No customers yet. Tap <strong>+ Add</strong>.');return;}
  const showLock=!isPro()&&S.customers.length>=LIMITS.customers;
  el.innerHTML=S.customers.map(c=>{
    const init=c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const badge=c.credit>0?`<div class="badge bcr">GHS ${c.credit.toFixed(0)}</div>`:`<div class="badge bok">✓ Clear</div>`;
    const days=Math.floor((Date.now()-new Date(c.since||Date.now()))/86400000);
    const wa=c.credit>0?`<span style="font-size:20px;cursor:pointer;margin-left:6px;" onclick="sendDebtReminder(S.customers.find(x=>x.id==${c.id}))">💬</span>`:'';
    return`<div class="ci">
      <div class="ca" style="background:${c.color}18;color:${c.color}">${init}</div>
      <div class="ci-info"><div class="ci-name">${c.name}</div><div class="ci-ph">${c.phone||'No phone'}</div>${c.credit>0?`<div class="ci-days">Owing ${days} day${days!==1?'s':''}</div>`:''}</div>
      ${badge}${wa}
    </div>`;
  }).join('')+(showLock?`<div onclick="showPaywall('customers')" style="background:var(--s2);border:2px dashed rgba(245,166,35,.3);border-radius:var(--rs);padding:16px;text-align:center;cursor:pointer;"><div style="font-size:20px;margin-bottom:4px;">🔒</div><div style="font-size:12px;color:var(--gold);font-weight:700;">Upgrade to add more customers</div><div style="font-size:11px;color:var(--muted);margin-top:3px;">Free limit: 2 customers</div></div>`:'');
}

// ════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════
function clearF(ids) { ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';}); }
function emptyEl(icon,text) { return `<div class="empty"><div class="ei">${icon}</div><p>${text}</p></div>`; }

function toast(msg, type='') {
  const el=document.getElementById('toast-el');
  el.textContent=msg; el.className='toast'+(type?' '+type:'');
  el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2800);
}

function copyText(text, msg) {
  if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>toast(msg||'Copied!'));}
  else{toast(text,'w');}
}

// Secret admin — tap logo 5 times
document.getElementById('logo-tap-zone').addEventListener('click', () => {
  logoTaps++; clearTimeout(logoTimer);
  logoTimer = setTimeout(()=>logoTaps=0, 2000);
  if(logoTaps>=5){logoTaps=0;openAdmin();}
});

// PWA Service Worker
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

// PWA Install
let deferredInstall=null;
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault(); deferredInstall=e;
});

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
renderHome();
renderStock();
renderCustomers();
updateUpgradeUI();