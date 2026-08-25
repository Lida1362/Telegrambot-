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
    return (data.results || []).map((song) => ({
      ...song,
      source: "saavn",
    }));
  } catch (e) {
    console.error("JioSaavn search error:", e);
    return [];
  }
}

async function searchDeezer(query) {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`;
    const response = await fetch(url);
    const data = await response.json();
    return (data.data || []).map((song) => ({
      ...song,
      source: "deezer",
    }));
  } catch (e) {
    console.error("Deezer search error:", e);
    return [];
  }
}

async function searchiTunes(query) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10&country=US`;
    const response = await fetch(url);
    const data = await response.json();
    return (data.results || []).map((song) => ({
      ...song,
      source: "itunes",
    }));
  } catch (e) {
    console.error("iTunes search error:", e);
    return [];
  }
}

async function searchYouTube(query) {
  try {
    const instances = [
      "https://vid.puffyan.us",
      "https://inv.nadeko.net",
      "https://invidious.lunar.icu",
    ];

    for (const instance of instances) {
      try {
        const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const response = await fetch(url);
        
        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const videos = (data || []).filter((item) => item.type === "video");
        
        return videos.slice(0, 10).map((video) => ({
          title: video.title || "",
          source: "youtube",
          url: video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : video.url || "",
          link: video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : video.url || "",
          duration: video.lengthSeconds || 0,
          author: video.author || "",
        }));
      } catch (e) {
        console.error(`YouTube instance ${instance} failed:`, e);
        continue;
      }
    }

    return [];
  } catch (e) {
    console.error("YouTube search error:", e);
    return [];
  }
}

function extractSaavnAudio(song) {
  const vlink = song.vlink || "";
  const mediaPreviewUrl = song.media_preview_url || "";

  if (vlink && vlink.includes(".mp3")) {
    return vlink;
  }

  if (mediaPreviewUrl && mediaPreviewUrl.includes(".mp4")) {
    return mediaPreviewUrl;
  }

  return null;
}

function scoreResult(song, query) {
  const queryLower = query.toLowerCase();
  let score = 0;

  const title = (song.song || song.title || song.title_short || song.title || "").toLowerCase();
  const artist = (song.primary_artists || song.singers || song.artist?.name || song.user?.username || song.author || "").toLowerCase();

  if (title.includes(queryLower)) {
    score += 10;
    if (title === queryLower) {
      score += 20;
    }
  }

  if (artist.includes(queryLower)) {
    score += 8;
  }

  if (song.source === "saavn") {
    score += 5;
  }

  if (song.source === "youtube") {
    score += 12;
  }

  if (song.preview || song.downloadUrl || song.vlink || song.uri || song.url) {
    score += 10;
  }

  return score;
}

async function searchAllSources(query) {
  console.log("Searching all sources for:", query);
  
  const results = await Promise.allSettled([
    searchJioSaavn(query),
    searchDeezer(query),
    searchYouTube(query),
    searchiTunes(query),
  ]);

  const allResults = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      console.error(`Source ${index} failed:`, result.reason);
      return [];
    }
  });

  console.log("Total results from all sources:", allResults.length);

  const scored = allResults.map((song) => ({
    ...song,
    score: scoreResult(song, query),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored;
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
      "🎵 به ربات جستجوگر موسیقی خوش آمدید!\n\nنام آهنگ، خواننده یا حتی متن شعر را ارسال کنید تا آهنگ را برایتان بفرستم.\n\nمنابع جستجو: JioSaavn, YouTube, Deezer, iTunes"
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

  const results = await searchAllSources(text);

  if (results.length === 0) {
    await sendMessage(chatId, "❌ آهنگ یافت نشد. لطفا عبارت دیگری را امتحان کنید.");
    return;
  }

  const topResults = results.slice(0, 5);
  let sentCount = 0;

  for (const song of topResults) {
    let audioUrl = "";
    let title = "";
    let performer = "";
    let duration = 0;
    let isPreview = false;
    let link = "";

    if (song.source === "saavn") {
      audioUrl = extractSaavnAudio(song);
      title = song.song || song.title || "Unknown";
      performer = song.primary_artists || song.singers || "Unknown";
      duration = parseInt(song.duration) || 0;
      link = song.perma_url || "";
    } else if (song.source === "youtube") {
      audioUrl = "";
      title = song.title || "Unknown";
      performer = song.author || "YouTube";
      link = song.link || song.url || "";
      duration = song.duration || 0;
    } else if (song.source === "deezer") {
      audioUrl = song.preview || "";
      title = song.title || "Unknown";
      performer = song.artist?.name || "Unknown";
      duration = song.duration || 0;
      isPreview = true;
      link = song.link || "";
    } else if (song.source === "itunes") {
      audioUrl = song.previewUrl || "";
      title = song.trackName || "Unknown";
      performer = song.artistName || "Unknown";
      duration = song.trackTimeMillis ? Math.floor(song.trackTimeMillis / 1000) : 0;
      isPreview = true;
      link = song.trackViewUrl || "";
    }

    if (song.source === "youtube" && link) {
      await sendMessage(
        chatId,
        `🎬 ${title}\n👤 ${performer}\n🔗 ${link}`
      );
      sentCount++;
      continue;
    }

    if (!audioUrl && !link) {
      continue;
    }

    if (audioUrl) {
      await sendAudio(chatId, audioUrl, title, performer, duration);
      sentCount++;
    }

    if (isPreview && audioUrl) {
      await sendMessage(
        chatId,
        `⚠️ توجه: این پخش‌کننده فقط پیش‌نمایش ۳۰ ثانیه‌ای است.\nمنبع: ${song.source}`
      );
    }

    if (!audioUrl && link) {
      await sendMessage(
        chatId,
        `🎵 آهنگ پیدا شد: ${title} - ${performer}\n\n⚠️ لینک پخش مستقیم در دسترس نیست.\n🔗 لینک: ${link}\nمنبع: ${song.source}`
      );
      sentCount++;
    }
  }

  if (sentCount === 0) {
    await sendMessage(chatId, "❌ هیچ نتیجه قابل پخش یافت نشد.");
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
