const BOT_TOKEN = "8691367292:AAG8sKYt1PnnWDLL7PRXfKVWBhze2yzWhyQ";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function searchMusic(query) {
  try {
    const url = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&page=1&limit=5`;
    const response = await fetch(url);
    const data = await response.json();
    return data.data?.results || [];
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
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
      "🎵 به ربات جستجوگر موسیقی خوش آمدید!\n\nنام آهنگ، خواننده یا حتی متن شعر را ارسال کنید تا آهنگ کامل را برایتان بفرستم."
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
  const duration = song.duration ? Math.floor(song.duration / 1000) : 0;
  const audioUrl = song.downloadUrl || song.url;

  if (!audioUrl) {
    await sendMessage(chatId, "❌ لینک دانلود برای این آهنگ در دسترس نیست.");
    return;
  }

  const title = song.name || song.title || "Unknown";
  const performer = song.primaryArtists || song.artists?.primary || "Unknown";

  await sendAudio(chatId, audioUrl, title, performer, duration);
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
