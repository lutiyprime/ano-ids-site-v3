// Обработчик формы «Обсудить задачу» (src/pages/contacts.html): присылает заявку в Telegram.
// Serverless-функция Vercel, адрес /api/lead. Нужны переменные окружения проекта Vercel:
//   TELEGRAM_BOT_TOKEN — токен бота от @BotFather;
//   TELEGRAM_CHAT_ID   — id чата, куда слать заявки (личный чат или группа, бот должен быть её участником).
// Без них функция отвечает 503, а форма сообщает, что отправить не удалось.
// Форма шлёт JSON (assets/js/site.js); без JavaScript — обычный POST, тогда в ответ редирект на contacts.html.

const LIMITS = { name: 120, org: 200, contact: 160, task: 4000 };
const CONTACT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$|^\+?[\d\s()-]{10,}$/;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function parse(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch (e) { return Object.fromEntries(new URLSearchParams(body)); }
  }
  return body;
}

function validate(d) {
  const lead = {};
  for (const k of Object.keys(LIMITS)) lead[k] = str(d[k]).slice(0, LIMITS[k]);
  if (!lead.name || !lead.task || !CONTACT_RE.test(lead.contact)) return null;
  if (str(d.consent) !== 'yes') return null;
  return lead;
}

function message(lead) {
  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' });
  return [
    '<b>Заявка с сайта ИДС</b>',
    '',
    `<b>Имя:</b> ${esc(lead.name)}`,
    lead.org ? `<b>Организация:</b> ${esc(lead.org)}` : '',
    `<b>Контакт:</b> ${esc(lead.contact)}`,
    '',
    '<b>Задача:</b>',
    esc(lead.task),
    '',
    `<i>${time} МСК · согласие на обработку ПДн получено</i>`
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

export default async function handler(req, res) {
  const wantsJson = /json/.test(req.headers.accept || '') || /json/.test(req.headers['content-type'] || '');
  const reply = (status, ok, error) => {
    if (wantsJson) return res.status(status).json(ok ? { ok: true } : { ok: false, error });
    res.setHeader('Location', ok ? '/contacts.html?sent=1#form' : '/contacts.html?error=1#form');
    return res.status(303).end();
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  const data = parse(req.body);
  // Ловушка для ботов: поле website скрыто от людей. Боту отвечаем «успешно», но ничего не отправляем
  if (str(data.website)) return reply(200, true);

  const lead = validate(data);
  if (!lead) return reply(400, false, 'invalid');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return reply(503, false, 'not_configured');

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: message(lead), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) {
      console.error('telegram', r.status, (await r.text()).slice(0, 300));
      return reply(502, false, 'delivery');
    }
  } catch (e) {
    console.error('telegram', e.message);
    return reply(502, false, 'delivery');
  }
  return reply(200, true);
}
