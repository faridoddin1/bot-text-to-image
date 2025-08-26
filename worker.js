export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Invalid method', { status: 405 });
    }

    const telegramToken = env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
      return new Response('Bot token not configured', { status: 500 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    if (!update.message || !update.message.text) {
      return new Response('No message text', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const userText = update.message.text;

    if (userText === '/start') {
      await sendMessage(chatId, 'Welcome! Send /generate followed by your prompt to create an image.', telegramToken);
      return new Response('OK', { status: 200 });
    }

    if (userText.startsWith('/generate ')) {
      const prompt = userText.slice(10).trim();
      if (!prompt) {
        await sendMessage(chatId, 'Please provide a prompt after /generate', telegramToken);
        return new Response('Prompt missing', { status: 200 });
      }

      try {
        const inputs = { prompt: prompt, steps: 4 };
        const aiResponse = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', inputs);
        if (!aiResponse.image) {
          throw new Error('No image returned from model');
        }

        // Convert base64 to Uint8Array (binary data)
        const imageUint8Array = Uint8Array.from(atob(aiResponse.image), c => c.charCodeAt(0));

        // Helper function to build multipart/form-data body
        function buildMultipartBody(fieldName, fileName) {
          const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
          let body = '';
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n`;
          body += `Content-Type: image/png\r\n\r\n`;

          const encoder = new TextEncoder();
          const prefix = encoder.encode(body);
          const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);

          const combined = new Uint8Array(prefix.length + imageUint8Array.length + suffix.length);
          combined.set(prefix, 0);
          combined.set(imageUint8Array, prefix.length);
          combined.set(suffix, prefix.length + imageUint8Array.length);

          return { combined, boundary };
        }

        // Send as photo
        const { combined: photoBody, boundary: photoBoundary } = buildMultipartBody('photo', 'image.png');
        const photoResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendPhoto`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${photoBoundary}`,
          },
          body: photoBody,
        });
        if (!photoResponse.ok) {
          throw new Error('Failed to send photo');
        }

        // Send as document (file)
        const { combined: docBody, boundary: docBoundary } = buildMultipartBody('document', 'image.png');
        const docResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${docBoundary}`,
          },
          body: docBody,
        });
        if (!docResponse.ok) {
          throw new Error('Failed to send document');
        }

        return new Response('Images sent as photo and file', { status: 200 });
      } catch (error) {
        await sendMessage(chatId, `Error generating image: ${error.message}`, telegramToken);
        return new Response('Error', { status: 200 });
      }
    }

    await sendMessage(chatId, "I don't recognize that command. Use /start or /generate.", telegramToken);
    return new Response('OK', { status: 200 });
  },
};

async function sendMessage(chatId, text, token) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
