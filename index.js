require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { getQuery, runQuery, allQuery } = require('./database');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');

const bot = new Telegraf(BOT_TOKEN);

// ---------- কনফিগারেশন ----------
const NEWS_API_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const CHECK_INTERVAL = 15000; // ১৫ সেকেন্ড
const NOTIFY_BEFORE_MINUTES = 5; // ৫ মিনিট আগে

// ---------- ইউটিলিটি ফাংশন ----------
function formatBDTime(dateString) {
  const date = new Date(dateString);
  const bdTime = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  return bdTime.toLocaleString('bn-BD', { 
    hour: '2-digit', 
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getImpactEmoji(impact) {
  if (impact === 'High') return '🔴';
  if (impact === 'Medium') return '🟡';
  return '🟢';
}

function getAnalysis(actual, forecast) {
  if (actual === null || forecast === null || actual === '' || forecast === '') {
    return '⏳ রেজাল্ট আসার অপেক্ষায়...';
  }
  const a = parseFloat(actual);
  const f = parseFloat(forecast);
  if (isNaN(a) || isNaN(f)) return '⚠️ ডেটা পার্স করতে পারিনি।';
  const diff = a - f;
  if (Math.abs(diff) < 0.001) return '⚖️ Actual এবং Forecast প্রায় সমান। বাজার নিরপেক্ষ থাকতে পারে।';
  if (diff > 0) return '📈 **Actual > Forecast** — এই কারেন্সি **শক্তিশালী** হওয়ার সম্ভাবনা!';
  return '📉 **Actual < Forecast** — এই কারেন্সি **দুর্বল** হওয়ার সম্ভাবনা!';
}

// ---------- নিউজ ফেচ ও প্রসেসিং ----------
async function fetchAndProcessNews() {
  try {
    const response = await fetch(NEWS_API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const events = await response.json();

    const now = Date.now();

    for (const event of events) {
      // শুধু High এবং Medium ইমপ্যাক্ট ফিল্টার
      if (event.impact !== 'High' && event.impact !== 'Medium') continue;

      const eventTime = new Date(event.date).getTime();
      const timeDiff = eventTime - now;
      const eventId = event.id || `${event.title}_${event.date}`;

      // ---- ৫ মিনিট আগে সতর্কতা ----
      if (timeDiff > 0 && timeDiff <= NOTIFY_BEFORE_MINUTES * 60 * 1000) {
        const alreadyNotified = await getQuery(
          'SELECT * FROM notifications WHERE event_id = ? AND type = ?',
          [eventId + '_pre', 'pre']
        );
        if (!alreadyNotified) {
          await sendPreNotification(event);
          await runQuery(
            'INSERT INTO notifications (event_id, type) VALUES (?, ?)',
            [eventId + '_pre', 'pre']
          );
        }
      }

      // ---- রেজাল্ট পাওয়া গেলে ----
      if (event.actual !== null && event.actual !== '') {
        const alreadyNotified = await getQuery(
          'SELECT * FROM notifications WHERE event_id = ? AND type = ?',
          [eventId + '_result', 'result']
        );
        if (!alreadyNotified) {
          await sendResultNotification(event);
          await runQuery(
            'INSERT INTO notifications (event_id, type) VALUES (?, ?)',
            [eventId + '_result', 'result']
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ Error fetching news:', error.message);
  }
}

// ---------- নোটিফিকেশন ফাংশন ----------
async function sendToAllSubscribers(message, parseMode = 'Markdown') {
  const users = await allQuery('SELECT chat_id FROM users WHERE is_subscribed = 1');
  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.chat_id, message, { parse_mode: parseMode });
    } catch (err) {
      console.error(`Failed to send to ${user.chat_id}:`, err.message);
    }
  }
}

async function sendPreNotification(event) {
  const message = `
🔔 **আসন্ন নিউজ সতর্কতা** 🔔
━━━━━━━━━━━━━━━━━━━━━━
📅 **${event.title}** (${event.country})
⏰ **সময়:** ${formatBDTime(event.date)} (বাংলাদেশ সময়)
📊 **ইমপ্যাক্ট:** ${getImpactEmoji(event.impact)} ${event.impact}
━━━━━━━━━━━━━━━━━━━━━━
📈 **Forecast:** ${event.forecast || 'নির্ধারিত নয়'}
📉 **Previous:** ${event.previous || 'নির্ধারিত নয়'}
━━━━━━━━━━━━━━━━━━━━━━
⏳ **রিলিজ হতে ${NOTIFY_BEFORE_MINUTES} মিনিট বাকি!**

💡 **টিপ:** Forecast এর চেয়ে Actual বেশি আসলে কারেন্সি শক্তিশালী হয়।
  `;
  await sendToAllSubscribers(message);
}

async function sendResultNotification(event) {
  const analysis = getAnalysis(event.actual, event.forecast);
  const message = `
✅ **নিউজ রিলিজ হয়েছে!** ✅
━━━━━━━━━━━━━━━━━━━━━━
📅 **${event.title}** (${event.country})
⏰ **সময়:** ${formatBDTime(event.date)} (বাংলাদেশ সময়)
📊 **ইমপ্যাক্ট:** ${getImpactEmoji(event.impact)} ${event.impact}
━━━━━━━━━━━━━━━━━━━━━━
📈 **Actual:** ${event.actual} ⬅️ রেজাল্ট!
📊 **Forecast:** ${event.forecast || 'নির্ধারিত নয়'}
📉 **Previous:** ${event.previous || 'নির্ধারিত নয়'}
━━━━━━━━━━━━━━━━━━━━━━
📊 **বিশ্লেষণ:**
${analysis}
━━━━━━━━━━━━━━━━━━━━━━
  `;
  await sendToAllSubscribers(message);
}

// ---------- বট কমান্ড ----------
bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user = await getQuery('SELECT * FROM users WHERE chat_id = ?', [chatId]);
  if (!user) {
    await runQuery('INSERT INTO users (chat_id) VALUES (?)', [chatId]);
    await ctx.reply(
      '🎯 **Forex News Bot-এ স্বাগতম!**\n\n' +
      'আপনি ডিফল্টভাবে সাবস্ক্রাইবড আছেন। High Impact নিউজের আপডেট পাবেন।\n\n' +
      '📌 **কমান্ডসমূহ:**\n' +
      '/subscribe — নোটিফিকেশন চালু করুন\n' +
      '/unsubscribe — নোটিফিকেশন বন্ধ করুন\n' +
      '/status — আপনার স্ট্যাটাস দেখুন\n' +
      '/next — আসন্ন নিউজ দেখুন\n' +
      '/help — সাহায্য',
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('👋 স্বাগতম! আপনি ইতিমধ্যে রেজিস্টার্ড।', mainMenu());
  }
});

bot.command('subscribe', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await runQuery('UPDATE users SET is_subscribed = 1 WHERE chat_id = ?', [chatId]);
  await ctx.reply('✅ নোটিফিকেশন **চালু** করা হয়েছে!', { parse_mode: 'Markdown' });
});

bot.command('unsubscribe', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await runQuery('UPDATE users SET is_subscribed = 0 WHERE chat_id = ?', [chatId]);
  await ctx.reply('🔕 নোটিফিকেশন **বন্ধ** করা হয়েছে। পুনরায় চালু করতে /subscribe দিন।', { parse_mode: 'Markdown' });
});

bot.command('status', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user = await getQuery('SELECT * FROM users WHERE chat_id = ?', [chatId]);
  if (!user) return ctx.reply('আপনি রেজিস্টার্ড নন। /start দিন।');
  const status = user.is_subscribed ? '✅ চালু' : '🔕 বন্ধ';
  const filter = user.impact_filter || 'HIGH';
  await ctx.reply(
    `📊 **আপনার স্ট্যাটাস:**\n` +
    `নোটিফিকেশন: ${status}\n` +
    `ইমপ্যাক্ট ফিল্টার: ${filter}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('next', async (ctx) => {
  try {
    const response = await fetch(NEWS_API_URL);
    const events = await response.json();
    const now = Date.now();
    const upcoming = events
      .filter(e => {
        if (e.impact !== 'High' && e.impact !== 'Medium') return false;
        return new Date(e.date).getTime() > now;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    if (upcoming.length === 0) {
      return ctx.reply('📭 আগামী ২৪ ঘন্টায় কোনো High/Medium ইমপ্যাক্ট নিউজ নেই।');
    }

    let msg = '📰 **আসন্ন নিউজসমূহ:**\n━━━━━━━━━━━━━━━━━━━━━━\n';
    upcoming.forEach(e => {
      msg += `📅 **${e.title}** (${e.country})\n`;
      msg += `⏰ ${formatBDTime(e.date)} | ${getImpactEmoji(e.impact)} ${e.impact}\n`;
      msg += `📊 Forecast: ${e.forecast || 'N/A'}\n`;
      msg += '━━━━━━━━━━━━━━━━━━━━━━\n';
    });
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply('⚠️ নিউজ ফেচ করতে সমস্যা হয়েছে! আবার চেষ্টা করুন।');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '📚 **সাহায্য গাইড:**\n\n' +
    'এই বট আপনাকে Forex নিউজ সম্পর্কে আগাম সতর্কতা এবং রেজাল্ট দেয়।\n\n' +
    '🔹 /start — বট চালু করুন\n' +
    '🔹 /subscribe — নোটিফিকেশন চালু\n' +
    '🔹 /unsubscribe — নোটিফিকেশন বন্ধ\n' +
    '🔹 /status — আপনার স্ট্যাটাস\n' +
    '🔹 /next — আসন্ন নিউজ দেখুন\n' +
    '🔹 /help — এই মেসেজ\n\n' +
    '💡 **টিপ:** শুধু High এবং Medium ইমপ্যাক্টের নিউজ দেখানো হয়।',
    { parse_mode: 'Markdown' }
  );
});

// ---------- ইনলাইন কীবোর্ড ----------
function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📰 আসন্ন নিউজ', 'next_news')],
    [Markup.button.callback('🔔 সাবস্ক্রাইব', 'subscribe_cb'), Markup.button.callback('🔕 আনসাবস্ক্রাইব', 'unsubscribe_cb')],
    [Markup.button.callback('📊 স্ট্যাটাস', 'status_cb')],
  ]);
}

bot.action('next_news', async (ctx) => {
  await ctx.answerCbQuery();
  // ডুপ্লিকেট কোড এড়াতে /next কল করা
  try {
    const response = await fetch(NEWS_API_URL);
    const events = await response.json();
    const now = Date.now();
    const upcoming = events
      .filter(e => {
        if (e.impact !== 'High' && e.impact !== 'Medium') return false;
        return new Date(e.date).getTime() > now;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    if (upcoming.length === 0) {
      return ctx.editMessageText('📭 আগামী ২৪ ঘন্টায় কোনো High/Medium ইমপ্যাক্ট নিউজ নেই।');
    }

    let msg = '📰 **আসন্ন নিউজসমূহ:**\n━━━━━━━━━━━━━━━━━━━━━━\n';
    upcoming.forEach(e => {
      msg += `📅 **${e.title}** (${e.country})\n`;
      msg += `⏰ ${formatBDTime(e.date)} | ${getImpactEmoji(e.impact)} ${e.impact}\n`;
      msg += `📊 Forecast: ${e.forecast || 'N/A'}\n`;
      msg += '━━━━━━━━━━━━━━━━━━━━━━\n';
    });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply('⚠️ নিউজ ফেচ করতে সমস্যা হয়েছে!');
  }
});

bot.action('subscribe_cb', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await runQuery('UPDATE users SET is_subscribed = 1 WHERE chat_id = ?', [chatId]);
  await ctx.answerCbQuery('✅ সাবস্ক্রাইব করা হয়েছে!');
  await ctx.editMessageText('✅ নোটিফিকেশন চালু করা হয়েছে!', mainMenu());
});

bot.action('unsubscribe_cb', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await runQuery('UPDATE users SET is_subscribed = 0 WHERE chat_id = ?', [chatId]);
  await ctx.answerCbQuery('🔕 আনসাবস্ক্রাইব করা হয়েছে!');
  await ctx.editMessageText('🔕 নোটিফিকেশন বন্ধ করা হয়েছে।', mainMenu());
});

bot.action('status_cb', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user = await getQuery('SELECT * FROM users WHERE chat_id = ?', [chatId]);
  if (!user) return ctx.reply('আপনি রেজিস্টার্ড নন। /start দিন।');
  const status = user.is_subscribed ? '✅ চালু' : '🔕 বন্ধ';
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `📊 **আপনার স্ট্যাটাস:**\nনোটিফিকেশন: ${status}`,
    { parse_mode: 'Markdown' }
  );
});

// ---------- রেন্ডারের জন্য HTTP সার্ভার (পোর্ট খোলা) ----------
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('✅ Forex News Bot is running!');
});

app.listen(PORT, () => {
  console.log(`✅ HTTP Server running on port ${PORT}`);
});

// ---------- বট লঞ্চ ও নিউজ চেকার ----------
bot.launch().then(() => {
  console.log('🚀 Bot started successfully!');
  fetchAndProcessNews(); // প্রথমবার সাথে সাথে চেক
  setInterval(fetchAndProcessNews, CHECK_INTERVAL);
});

// গ্রেসফুল শাটডাউন
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});
