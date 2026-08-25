const BOT_TOKEN = "8691367292:AAG8sKYt1PnnWDLL7PRXfKVWBhze2yzWhyQ";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const ARTIST_LIST = [
  "گوگوش",
  "داریوش اقبالی",
  "ابی",
  "ابراهیم حامدی",
  "معین",
  "هایده",
  "مهستی",
  "ستار",
  "شهرام شب‌پره",
  "لیلا فروهر",
  "شهره صولتی",
  "سیاوش قمیشی",
  "فرامرز اصلانی",
  "عارف",
  "نیکو",
  "افسانه",
  "مانی رهنما",
  "هما میرافشار",
  "شاهین نجفی",
  "کیوسک",
  "امید",
  "سندی",
  "آرمین ۲afm",
  "محسن یگانه",
  "بنیامین بهادری",
  "محسن چاوشی",
  "علی لهراسبی",
  "علی زند وکیلی",
  "رضا صادقی",
  "حجت اشرف‌زاده",
  "سیروان خسروی",
  "الکس جولیگ",
  "Modern Talking",
  "Dalida",
  "Ricky Martin",
  "Alex Opteck",
  "julian jeweli",
];

async function searchJioSaavn(query) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&ctx=android&q=${encodeURIComponent(query)}&p=1&n=10`;
    const response = await fetch(url);
    const data = await response.json();
    return data.results || [];
  } catch (e) {
    console.error("JioSaavn search error:", e);
    return [];
  }
}

async function searchDeezer(query) {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`;
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
  } catch (e) {
    console.error("Deezer search error:", e);
    return [];
  }
}

async function searchiTunes(query) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5&country=US`;
    const response = await fetch(url);
    const data = await response.json();
    return data.results || [];
  } catch (e) {
    console.error("iTunes search error:", e);
    return [];
  }
}

function extractSaavnAudio(song) {
  const vlink = song.vlink || "";
  const mediaPreviewUrl = song.media_preview_url || "";
  const encryptedMediaUrl = song.encrypted_media_url || "";
  const permaUrl = song.perma_url || "";

  if (vlink && vlink.includes(".mp3")) {
    return vlink;
  }

  if (mediaPreviewUrl && mediaPreviewUrl.includes(".mp4")) {
    return mediaPreviewUrl;
  }

  if (encryptedMediaUrl) {
    return null;
  }

  return null;
}

async function searchMusic(query) {
  const queries = [query];

  for (const artist of ARTIST_LIST) {
    if (query.toLowerCase().includes(artist.toLowerCase())) {
      queries.push(`${artist} ${query}`);
      queries.push(`${query} ${artist}`);
    }
  }

  const uniqueQueries = [...new Set(queries)];

  for (const q of uniqueQueries) {
    const saavnResults = await searchJioSaavn(q);
    if (saavnResults.length > 0) {
      return saavnResults.map((song) => ({
        ...song,
        source: "saavn",
        matchedQuery: q,
      }));
    }
  }

  for (const q of uniqueQueries) {
    const deezerResults = await searchDeezer(q);
    if (deezerResults.length > 0) {
      return deezerResults.map((song) => ({
        ...song,
        source: "deezer",
        matchedQuery: q,
      }));
    }
  }

  for (const q of uniqueQueries) {
    const iTunesResults = await searchiTunes(q);
    if (iTunesResults.length > 0) {
      return iTunesResults.map((song) => ({
        ...song,
        source: "itunes",
        matchedQuery: q,
      }));
    }
  }

  return [];
}

async function sendMessage(chatId, text) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("Send message error:", e);
  }
}

async function sendAudio(chatId, audioUrl, title, performer, duration) {
  try {
    await fetch(`${TELEGRAM_API}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        audio: audioUrl,
        title: title || "",
        performer: performer || "",
        duration: duration || 0,
      }),
    });
  } catch (e) {
    console.error("Send audio error:", e);
  }
}

async function sendChatAction(chatId, action = "typing") {
  try {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (e) {
    console.error("Chat action error:", e);
  }
}

async function handleUpdate(update) {
  if (!update.message || !update.message.text) return;

  const chatId = update.message.chat.id;
  const text = update.message.text.trim();

  console.log("Received message:", text, "from chat:", chatId);

  if (text === "/start") {
    await sendMessage(
      chatId,
      "🎵 به ربات جستجوگر موسیقی خوش آمدید!\n\nنام آهنگ، خواننده یا حتی متن شعر را ارسال کنید تا آهنگ را برایتان بفرستم.\n\nمنابع جستجو: JioSaavn, Deezer, iTunes\n\nلیست خوانندگان:\n" + ARTIST_LIST.slice(0, 10).join("\n") + "\n..."
    );
    return;
  }

  if (text === "/artists") {
    await sendMessage(
      chatId,
      "🎤 لیست خوانندگان:\n\n" + ARTIST_LIST.join("\n")
    );
    return;
  }

  await sendChatAction(chatId, "upload_audio");

  const results = await searchMusic(text);

  if (results.length === 0) {
    await sendMessage(chatId, "❌ آهنگ یافت نشد. لطفا عبارت دیگری را امتحان کنید.");
    return;
  }

  const song = results[0];
  let audioUrl = "";
  let title = "";
  let performer = "";
  let duration = 0;
  let isPreview = false;

  if (song.source === "saavn") {
    audioUrl = extractSaavnAudio(song);
    title = song.song || song.title || "Unknown";
    performer = song.primary_artists || song.singers || "Unknown";
    duration = parseInt(song.duration) || 0;
  } else if (song.source === "deezer") {
    audioUrl = song.preview || "";
    title = song.title || "Unknown";
    performer = song.artist?.name || "Unknown";
    duration = song.duration || 0;
    isPreview = true;
  } else if (song.source === "itunes") {
    audioUrl = song.previewUrl || "";
    title = song.trackName || "Unknown";
    performer = song.artistName || "Unknown";
    duration = song.trackTimeMillis ? Math.floor(song.trackTimeMillis / 1000) : 0;
    isPreview = true;
  }

  if (!audioUrl) {
    await sendMessage(
      chatId,
      `🎵 آهنگ پیدا شد: ${title} - ${performer}\n\n⚠️ لینک پخش مستقیم در دسترس نیست.\n🔗 لینک: ${song.perma_url || song.link || ""}`
    );
    return;
  }

  await sendAudio(chatId, audioUrl, title, performer, duration);

  if (isPreview) {
    await sendMessage(
      chatId,
      `⚠️ توجه: این پخش‌کننده فقط پیش‌نمایش ۳۰ ثانیه‌ای است.\nبرای آهنگ کامل لطفاً از منابع دیگر استفاده کنید.`
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "POST") {
      try {
        const update = await request.json();
        console.log("Received update:", JSON.stringify(update).substring(0, 200));

        if (update.message || update.edited_message) {
          ctx.waitUntil(handleUpdate(update));
        }

        if (update.my_chat_member) {
          const newStatus = update.my_chat_member.new_chat_member.status;
          if (newStatus === "member" || newStatus === "administrator") {
            await sendMessage(
              update.my_chat_member.chat.id,
              "سلام! ربات فعال شد. نام آهنگ را ارسال کنید."
            );
          }
        }

        return new Response("OK");
      } catch (e) {
        console.error("Webhook error:", e);
        return new Response("Error", { status: 500 });
      }
    }

    if (url.pathname === "/setup" && request.method === "GET") {
      const webhookUrl = `${url.origin}/webhook`;
      console.log("Setting webhook to:", webhookUrl);
      const response = await fetch(
        `${TELEGRAM_API}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const result = await response.json();
      console.log("Webhook result:", result);
      return new Response(JSON.stringify(result, null, 2));
    }

    if (url.pathname === "/webhook" && request.method === "GET") {
      return new Response("Webhook endpoint is ready");
    }

    if (url.pathname === "/webhook-info" && request.method === "GET") {
      const response = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
      const result = await response.json();
      return new Response(JSON.stringify(result, null, 2));
    }

    if (url.pathname === "/artists" && request.method === "GET") {
      return new Response(JSON.stringify({ artists: ARTIST_LIST }, null, 2));
    }

    return new Response("Music Bot Worker is running");
  },

  async scheduled(event, env, ctx) {
    console.log("Cron trigger: keep-alive ping at", new Date().toISOString());
    try {
      const response = await fetch(`${TELEGRAM_API}/getMe`);
      const result = await response.json();
      console.log("Bot status:", result.ok ? "active" : "error", result.result?.username);
    } catch (e) {
      console.error("Keep-alive error:", e);
    }
  },
};
