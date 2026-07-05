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

// ---------- ভাষা ডিকশনারি (ইংরেজি + বাংলা) ----------
const LANG = {
  en: {
    start: `🎯 **Welcome to Forex News Bot!**

You are subscribed by default. You will get High Impact news alerts.

📌 **Commands:**
/subscribe — Turn on notifications
/unsubscribe — Turn off notifications
/language — Change language (English/Bengali)
/status — Check your status
/next — View upcoming news
/help — Help`,
    pre_notify: `🔔 **Upcoming News Alert** 🔔
━━━━━━━━━━━━━━━━━━━━━━
📅 **{title}** ({country})
⏰ **Time:** {time} (BD Time)
📊 **Impact:** {emoji} {impact}
━━━━━━━━━━━━━━━━━━━━━━
📈 **Forecast:** {forecast}
📉 **Previous:** {previous}
━━━━━━━━━━━━━━━━━━━━━━
⏳ **Releasing in {minutes} minutes!**
💡 **Tip:** Higher Actual than Forecast usually strengthens the currency.`,
    result_notify: `✅ **News Released!** ✅
━━━━━━━━━━━━━━━━━━━━━━
📅 **{title}** ({country})
⏰ **Time:** {time} (BD Time)
📊 **Impact:** {emoji} {impact}
━━━━━━━━━━━━━━━━━━━━━━
📈 **Actual:** {actual} ⬅️ Result!
📊 **Forecast:** {forecast}
📉 **Previous:** {previous}
━━━━━━━━━━━━━━━━━━━━━━
📊 **Analysis:**
{analysis}
━━━━━━━━━━━━━━━━━━━━━━`,
    analysis_high: '📈 **Actual > Forecast** — This currency may **strengthen**!',
    analysis_low: '📉 **Actual < Forecast** — This currency may **weaken**!',
    analysis_equal: '⚖️ Actual and Forecast are almost equal. Market may remain neutral.',
    analysis_wait: '⏳ Waiting for result...',
    analysis_error: '⚠️ Could not parse data.',
    subscribed: '✅ Notifications **enabled**!',
    unsubscribed: '🔕 Notifications **disabled**. Use /subscribe to re-enable.',
    lang_changed: '🌐 Language changed to English!',
    no_news: '📭 No High/Medium impact news in the next 24 hours.',
    help_text: '📚 **Help Guide:**\n\nThis bot provides Forex news alerts.\n🔹 /start — Start the bot\n🔹 /subscribe — Turn on alerts\n🔹 /unsubscribe — Turn off alerts\n🔹 /language — Change language\n🔹 /status — Your status\n🔹 /next — Upcoming news\n🔹 /help — This message',
    status_text: '📊 **Your Status:**\nNotifications: {status}\nLanguage: {lang}',
    lang_prompt: '🌐 Please select your language:'
  },
  bn: {
    start: `🎯 **Forex News Bot-এ স্বাগতম!**

আপনি ডিফল্টভাবে সাবস্ক্রাইবড আছেন। High Impact নিউজের আপডেট পাবেন।

📌 **কমান্ডসমূহ:**
/subscribe — নোটিফিকেশন চালু করুন
/unsubscribe — নোটিফিকেশন বন্ধ করুন
/language — ভাষা পরিবর্তন করুন (ইংরেজি/বাংলা)
/status — আপনার স্ট্যাটাস দেখুন
/next — আসন্ন নিউজ দেখুন
/help — সাহায্য`,
    pre_notify: `🔔 **আসন্ন নিউজ সতর্কতা** 🔔
━━━━━━━━━━━━━━━━━━━━━━
📅 **{title}** ({country})
⏰ **সময়:** {time} (বাংলাদেশ সময়)
📊 **ইমপ্যাক্ট:** {emoji} {impact}
━━━━━━━━━━━━━━━━━━━━━━
📈 **Forecast:** {forecast}
📉 **Previous:** {previous}
━━━━━━━━━━━━━━━━━━━━━━
⏳ **রিলিজ হতে {minutes} মিনিট বাকি!**
💡 **টিপ:** Forecast এর চেয়ে Actual বেশি আসলে কারেন্সি শক্তিশালী হয়।`,
    result_notify: `✅ **নিউজ রিলিজ হয়েছে!** ✅
━━━━━━━━━━━━━━━━━━━━━━
📅 **{title}** ({country})
⏰ **সময়:** {time} (বাংলাদেশ সময়)
📊 **ইমপ্যাক্ট:** {emoji} {impact}
━━━━━━━━━━━━━━━━━━━━━━
📈 **Actual:** {actual} ⬅️ রেজাল্ট!
📊 **Forecast:** {forecast}
📉 **Previous:** {previous}
━━━━━━━━━━━━━━━━━━━━━━
📊 **বিশ্লেষণ:**
{analysis}
━━━━━━━━━━━━━━━━━━━━━━`,
    analysis_high: '📈 **Actual > Forecast** — এই কারেন্সি **শক্তিশালী** হতে পারে!',
    analysis_low: '📉 **Actual < Forecast** — এই কারেন্সি **দুর্বল** হতে পারে!',
    analysis_equal: '⚖️ Actual এবং Forecast প্রায় সমান। বাজার নিরপেক্ষ থাকতে পারে।',
    analysis_wait: '⏳ রেজাল্ট আসার অপেক্ষায়...',
    analysis_error: '⚠️ ডেটা পার্স করতে পারিনি।',
    subscribed: '✅ নোটিফিকেশন **চালু** করা হয়েছে!',
    unsubscribed: '🔕 নোটিফিকেশন **বন্ধ** করা হয়েছে। পুনরায় চালু করতে /subscribe দিন।',
    lang_changed: '🌐 ভাষা বাংলায় পরিবর্তন করা হয়েছে!',
    no_news: '📭 আগামী ২৪ ঘন্টায় কোনো High/Medium ইমপ্যাক্ট নিউজ নেই।',
    help_text: '📚 **সাহায্য গাইড:**\n\nএই বট Forex নিউজ সম্পর্কে সতর্কতা দেয়।\n🔹 /start — বট চালু করুন\n🔹 /subscribe — নোটিফিকেশন চালু\n🔹 /unsubscribe — নোটিফিকেশন বন্ধ\n🔹 /language — ভাষা পরিবর্তন\n🔹 /status — আপনার স্ট্যাটাস\n🔹 /next — আসন্ন নিউজ দেখুন\n🔹 /help — এই মেসেজ',
    status_text: '📊 **আপনার স্ট্যাটাস:**\nনোটিফিকেশন: {status}\nভাষা: {lang}',
    lang_prompt: '🌐 আপনার ভাষা নির্বাচন করুন:'
  }
};

// ---------- হেল্পার ফাংশন ----------
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

function getAnalysis(actual, forecast, lang = 'en') {
  if (actual === null || forecast === null || actual === '' || forecast === '') {
    return LANG[lang].analysis_wait;
  }
  const a = parseFloat(actual);
  const f = parseFloat(forecast);
  if (isNaN(a) || isNaN(f)) return LANG[lang].analysis_error;
  const diff = a - f;
  if (Math.abs(diff) < 0.001) return LANG[lang].analysis_equal;
  if (diff > 0) return LANG[lang].analysis_high;
  return LANG[lang].analysis_low;
}

// ---------- টেক্সট রেন্ডার ----------
async function getText(chatId, key, variables = {}) {
  const user = await getQuery('SELECT language FROM users WHERE chat_id = ?', [String(chatId)]);
  const lang = (user && user.language) || 'en';
  let text = LANG[lang][key] || LANG['en'][key] || key;
  for (const [k, v] of Object.entries(variables)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

// ---------- নিউজ ফেচ ও প্রসেসিং ----------
async function fetchAndProcessNews() {
  try {
    const response = await fetch(NEWS_API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const events = await response.json();
    const now = Date.now();

    for (const event of events) {
      if (event.impact !== 'High' && event.impact !== 'Medium') continue;
      const eventTime = new Date(event.date).getTime();
      const timeDiff = eventTime - now;
      const eventId = event.id || `${event.title}_${event.date}`;

      if (timeDiff > 0 && timeDiff <= NOTIFY_BEFORE_MINUTES * 60 * 1000) {
        const alreadyNotified = await getQuery(
          'SELECT * FROM notifications WHERE event_id = ? AND type = ?',
          [eventId + '_pre', 'pre']
        );
        if (!alreadyNotified) {
          await sendPreNotification(event);
          await runQuery('INSERT INTO notifications (event_id, type) VALUES (?, ?)', [eventId + '_pre', 'pre']);
        }
      }

      if (event.actual !== null && event.actual !== '') {
        const alreadyNotified = await getQuery(
          'SELECT * FROM notifications WHERE event_id = ? AND type = ?',
          [eventId + '_result', 'result']
        );
        if (!alreadyNotified) {
          await sendResultNotification(event);
          await runQuery('INSERT INTO notifications (event_id, type) VALUES (?, ?)', [eventId + '_result', 'result']);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error fetching news:', error.message);
  }
}

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
  const users = await allQuery('SELECT chat_id FROM users');
  for (const user of users) {
    const msg = await getText(user.chat_id, 'pre_notify', {
      title: event.title,
      country: event.country,
      time: formatBDTime(event.date),
      emoji: getImpactEmoji(event.impact),
      impact: event.impact,
      forecast: event.forecast || 'N/A',
      previous: event.previous || 'N/A',
      minutes: NOTIFY_BEFORE_MINUTES
    });
    try {
      await bot.telegram.sendMessage(user.chat_id, msg, { parse_mode: 'Markdown' });
    } catch (err) {}
  }
}

async function sendResultNotification(event) {
  const users = await allQuery('SELECT chat_id FROM users');
  for (const user of users) {
    const lang = (user.language) || 'en';
    const analysis = getAnalysis(event.actual, event.forecast, lang);
    const msg = await getText(user.chat_id, 'result_notify', {
      title: event.title,
      country: event.country,
      time: formatBDTime(event.date),
      emoji: getImpactEmoji(event.impact),
      impact: event.impact,
      actual: event.actual,
      forecast: event.forecast || 'N/A',
      previous: event.previous || 'N/A',
      analysis: analysis
    });
    try {
      await bot.telegram.sendMessage(user.chat_id, msg, { parse_mode: 'Markdown' });
    } catch (err) {}
  }
}

// ---------- বট কমান্ড ----------
bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user = await getQuery('SELECT * FROM users WHERE chat_id = ?', [chatId]);
  if (!user) {
    await runQuery('INSERT INTO users (chat_id) VALUES (?)', [chatId]);
    const msg = await getText(chatId, 'start');
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } else {
    const msg = await getText(chatId, 'start');
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }
});

bot.command('subscribe', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await runQuery('UPDATE users SET is_subscribed = 1 WHERE chat_id = ?', [chatId]);
  const msg = await getText(chatId, 'subscribed');
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('unsubscribe', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await runQuery('UPDATE users SET is_subscribed = 0 WHERE chat_id = ?', [chatId]);
  const msg = await getText(chatId, 'unsubscribed');
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('language', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const msg = await getText(chatId, 'lang_prompt');
  await ctx.reply(msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🇬🇧 English', callback_data: 'lang_en' },
          { text: '🇧🇩 বাংলা', callback_data: 'lang_bn' }
        ]
      ]
    }
  });
});

bot.command('status', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user = await getQuery('SELECT * FROM users WHERE chat_id = ?', [chatId]);
  if (!user) return ctx.reply('Please /start first.');
  const status = user.is_subscribed ? '✅ Active' : '🔕 Disabled';
  const lang = user.language === 'bn' ? 'বাংলা' : 'English';
  const msg = await getText(chatId, 'status_text', { status, lang });
  await ctx.reply(msg, { parse_mode: 'Markdown' });
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
      const msg = await getText(ctx.chat.id, 'no_news');
      return ctx.reply(msg);
    }

    let msg = '📰 **Upcoming News:**\n━━━━━━━━━━━━━━━━━━━━━━\n';
    for (const e of upcoming) {
      msg += `📅 **${e.title}** (${e.country})\n`;
      msg += `⏰ ${formatBDTime(e.date)} | ${getImpactEmoji(e.impact)} ${e.impact}\n`;
      msg += `📊 Forecast: ${e.forecast || 'N/A'}\n`;
      msg += '━━━━━━━━━━━━━━━━━━━━━━\n';
    }
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply('⚠️ Could not fetch news. Try again.');
  }
});

bot.command('help', async (ctx) => {
  const msg = await getText(ctx.chat.id, 'help_text');
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ---------- ইনলাইন কীবোর্ড অ্যাকশন ----------
bot.action('lang_en', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await runQuery('UPDATE users SET language = ? WHERE chat_id = ?', ['en', chatId]);
  await ctx.answerCbQuery('Language set to English');
  await ctx.editMessageText('🌐 Language changed to English!');
});

bot.action('lang_bn', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await runQuery('UPDATE users SET language = ? WHERE chat_id = ?', ['bn', chatId]);
  await ctx.answerCbQuery('ভাষা বাংলায় সেট করা হয়েছে');
  await ctx.editMessageText('🌐 ভাষা বাংলায় পরিবর্তন করা হয়েছে!');
});

// ---------- রেন্ডারের জন্য HTTP সার্ভার ----------
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('✅ Forex News Bot is running!');
});

app.listen(PORT, () => {
  console.log(`✅ HTTP Server running on port ${PORT}`);
});

// ---------- বট লঞ্চ ----------
bot.launch().then(() => {
  console.log('🚀 Bot started successfully!');
  fetchAndProcessNews();
  setInterval(fetchAndProcessNews, CHECK_INTERVAL);
});

process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
