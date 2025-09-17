// ---------- Insert Your Data ---------- //

const BOT_TOKEN = "8077079325:AAGmPIi1Gv-x9i5PsgcUXqVMmsTNqjDzghY"; // Insert your bot token.
const BOT_WEBHOOK = "/endpoint"; // Let it be as it is.
const BOT_SECRET = "My$tr0ngSecre7K3y"; // Insert a powerful secret text.
const BOT_CHANNEL = -1002742792076; // Insert your telegram channel id which the bot is admin in. (Not strictly needed for direct links, but can be used for logging/storage if desired)
// const SIA_NUMBER = 912839; // No longer needed
const BOT_OWNER = "7962617461"; // Not numeric ID, use username for clickable button.
// ----------Ohh Bhai Do Not Modify ---------- // 

const WHITE_METHODS = ["GET", "POST", "HEAD"];
const HEADERS_FILE = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"};
const HEADERS_ERRR = {'Access-Control-Allow-Origin': '*', 'content-type': 'application/json'};
const ERROR_404 = {"ok":false,"error_code":404,"description":"Bad Request: missing /?file= parameter", "credit": "https://t.me/NipunSGeeTH"};
const ERROR_405 = {"ok":false,"error_code":405,"description":"Bad Request: method not allowed"};
const ERROR_406 = {"ok":false,"error_code":406,"description":"Bad Request: file type invalid"};
const ERROR_407 = {"ok":false,"error_code":407,"description":"Bad Request: file hash invalid by atob"};
const ERROR_408 = {"ok":false,"error_code":408,"description":"Bad Request: mode not in [attachment, inline]"};

// ---------- Event Listener ---------- // 

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const encodedFileId = url.searchParams.get('file'); // Now this holds the base64 encoded Telegram file_id
    const mode = url.searchParams.get('mode') || "attachment";
     
    if (url.pathname === BOT_WEBHOOK) {return handleWebhook(event);}
    if (url.pathname === '/registerWebhook') {return registerWebhook(event, url, BOT_WEBHOOK, BOT_SECRET);}
    if (url.pathname === '/unregisterWebhook') {return unregisterWebhook(event);}
    if (url.pathname === '/getMe') {return new Response(JSON.stringify(await getMe()), {headers: HEADERS_ERRR, status: 202});}

    if (!encodedFileId) {return Raise(ERROR_404, 404);}
    if (!["attachment", "inline"].includes(mode)) {return Raise(ERROR_408, 404);}
    if (!WHITE_METHODS.includes(event.request.method)) {return Raise(ERROR_405, 405);}
    
    let file_id;
    try {
        file_id = atob(encodedFileId); // Decode to get the actual Telegram file_id
    } catch {
        return Raise(ERROR_407, 404);
    }

    const fileDetails = await getFile(file_id);
    if (fileDetails.error_code) {
        return await Raise(fileDetails, fileDetails.error_code);
    }

    // Attempt to infer file name and type if not explicitly available from getFile
    // getFile usually provides file_path, but not always original file_name or mime_type directly.
    // We'll try to infer from the file_path extension or use a generic one.
    const file_path_parts = fileDetails.file_path.split('/');
    const original_filename_from_tg = file_path_parts[file_path_parts.length - 1]; // e.g., 'document/file_123.pdf' -> 'file_123.pdf'

    const rdata = await fetchFile(fileDetails.file_path);
    const rname = original_filename_from_tg || "file"; // Use original filename from Telegram or generic
    const rsize = fileDetails.file_size || rdata.byteLength;
    let rtype = "application/octet-stream"; // Default generic type

    // Attempt to infer mime type from filename extension
    const ext = rname.split('.').pop().toLowerCase();
    switch (ext) {
        case 'jpg': case 'jpeg': rtype = 'image/jpeg'; break;
        case 'png': rtype = 'image/png'; break;
        case 'gif': rtype = 'image/gif'; break;
        case 'pdf': rtype = 'application/pdf'; break;
        case 'mp4': rtype = 'video/mp4'; break;
        case 'mp3': rtype = 'audio/mpeg'; break;
        case 'zip': rtype = 'application/zip'; break;
        case 'txt': rtype = 'text/plain'; break;
        // Add more types as needed
    }

    // Note: Telegram's getFile does not directly return mime_type.
    // For more robust type detection, you might need a library or
    // rely on the initial message's mime_type if you stored it.
    // For now, inferring from extension or using octet-stream is a reasonable fallback.

    return new Response(rdata, {
        status: 200, headers: {
            "Content-Disposition": `${mode}; filename=${rname}`,
            "Content-Length": rsize,
            "Content-Type": rtype,
            ...HEADERS_FILE
        }
    });
}

// ---------- Retrieve File - No longer needed in its original form ---------- //
// This function is removed as its logic was problematic for larger files and direct file_id handling.

// ---------- Raise Error ---------- //

async function Raise(json_error, status_code) {
    return new Response(JSON.stringify(json_error), { headers: HEADERS_ERRR, status: status_code });
}

// ---------- UUID Generator - No longer needed for file paths ---------- //
// async function UUID() {
//     return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
//         var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
//         return v.toString(16);
//     });
// }

// ---------- Telegram Webhook ---------- // 

async function handleWebhook(event) {
    if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== BOT_SECRET) {
        return new Response('Unauthorized', { status: 403 });
    }
    const update = await event.request.json();
    event.waitUntil(onUpdate(event, update));
    return new Response('Ok');
}

async function registerWebhook(event, requestUrl, suffix, secret) {
    const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
    const response = await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }));
    return new Response(JSON.stringify(await response.json()), {headers: HEADERS_ERRR});
}

async function unregisterWebhook(event) { 
    const response = await fetch(apiUrl('setWebhook', { url: '' }));
    return new Response(JSON.stringify(await response.json()), {headers: HEADERS_ERRR});
}

// ---------- Telegram API ---------- //

async function getMe() {
    const response = await fetch(apiUrl('getMe'));
    if (response.status == 200) {return (await response.json()).result;}
    else {return await response.json();}
}

async function sendMessage(chat_id, reply_id, text) {
    const response = await fetch(apiUrl('sendMessage', {chat_id: chat_id, reply_to_message_id: reply_id, parse_mode: 'markdown', text}));
    if (response.status == 200) {return (await response.json()).result;}
    else {return await response.json();}
}

// New function to send messages with buttons
async function sendMessageWithButtons(chat_id, reply_id, text, reply_markup) {
    const response = await fetch(apiUrl('sendMessage', {
        chat_id: chat_id,
        reply_to_message_id: reply_id,
        parse_mode: 'markdown',
        text,
        reply_markup: JSON.stringify(reply_markup) // convert to JSON
    }));
    
    if (response.status == 200) {
        return (await response.json()).result;
    } else {
        return await response.json();
    }
}

async function sendDocument(chat_id, file_id) {
    const response = await fetch(apiUrl('sendDocument', {chat_id: chat_id, document: file_id}));
    if (response.status == 200) {return (await response.json()).result;}
    else {return await response.json();}
}

async function sendPhoto(chat_id, file_id) {
    const response = await fetch(apiUrl('sendPhoto', {chat_id: chat_id, photo: file_id}));
    if (response.status == 200) {return (await response.json()).result;}
    else {return await response.json();}
}

// editMessage function for caption change is not directly used for file retrieval anymore
// It remains here if you need to edit captions of messages in the channel.
async function editMessageCaption(channel_id, message_id, caption_text) {
    const response = await fetch(apiUrl('editMessageCaption', {chat_id: channel_id, message_id: message_id, caption: caption_text}));
    if (response.status == 200) {return (await response.json()).result;}
    else {return await response.json();}
}


async function getFile(file_id) {
    const response = await fetch(apiUrl('getFile', {file_id: file_id}));
    if (response.status == 200) {return (await response.json()).result;}
    else {return await response.json();}
}

async function fetchFile(file_path) {
    const file = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file_path}`);
    return await file.arrayBuffer();
}

function apiUrl(methodName, params = null) {
    let query = '';
    if (params) {query = '?' + new URLSearchParams(params).toString();}
    return `https://api.telegram.org/bot${BOT_TOKEN}/${methodName}${query}`;
}

// ---------- Main Message Handler ---------- //

async function onUpdate(event, update) {
    if (update.message) {await onMessage(event, update.message);}
}

async function onMessage(event, message) {
    let fID; let fName; let fType; let fSize;
    let url = new URL(event.request.url);
    let bot = await getMe();
    const firstName = message.from.first_name;
    
    // Ignore messages from channels (unless you specifically want to handle them)
    // The previous check message.chat.id.toString().includes("-100") is fine for this.
    if (message.chat.id.toString().startsWith("-100")) {
        return;
    }

    if (message.text && message.text.startsWith("/start ")) {
        const encodedFileId = message.text.split("/start ")[1];
        let file_id_from_start;
        try { 
            file_id_from_start = atob(encodedFileId); 
        } catch { 
            return await sendMessage(message.chat.id, message.message_id, ERROR_407.description); 
        }
        
        // When a user clicks /start with a file_id, we just send them the file back.
        // We don't need to save it again or query `editMessage`.
        // We need to determine the file type to send it correctly.
        const fileDetails = await getFile(file_id_from_start);
        if (fileDetails.error_code) {
             return sendMessage(message.chat.id, message.message_id, `Error retrieving file: ${fileDetails.description}`);
        }

        // Infer file type from file_path to send with appropriate method
        const file_path_extension = fileDetails.file_path.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'gif'].includes(file_path_extension)) {
            return await sendPhoto(message.chat.id, file_id_from_start);
        } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(file_path_extension)) {
            return await sendMessage(message.chat.id, message.message_id, "Video files are usually sent as documents for large sizes. Please use the download link.");
            // Or if you want to send as video: return await sendVideo(message.chat.id, file_id_from_start);
            // You might need a sendVideo function if you want to support it.
        } else if (['mp3', 'wav', 'ogg'].includes(file_path_extension)) {
            return await sendMessage(message.chat.id, message.message_id, "Audio files are usually sent as documents for large sizes. Please use the download link.");
            // Or if you want to send as audio: return await sendAudio(message.chat.id, file_id_from_start);
            // You might need a sendAudio function if you want to support it.
        }
        else {
            // Default to sending as a document for any other file type
            return await sendDocument(message.chat.id, file_id_from_start);
        }
    }


    if (message.text === "/start") {
        const ownerButton = {
            inline_keyboard: [
                [{ text: "📞 Contact Owner", url: `https://t.me/${BOT_OWNER}` }]
            ]
        };
    
        const welcomeText = `👋 Hi *${firstName}*, I'm *Zara* from 🇱🇰.\n\nI'm a *file to link generator bot*.\n\n📤 Send me any file, and I'll send you a *download link*.\n\nType /help for more details.\n\n🧑‍💼 Contact owner below if you need help.`;
    
        return sendMessageWithButtons(message.chat.id, message.message_id, welcomeText, ownerButton);
    }

    if (message.text === "/help") {
        const helpText = `📖 *How Zara Works*\n\n` +
        `📤 *Send me any file* (video, audio, image, document — anything up to *2GB*)\n\n` + // Updated to 2GB
        `📥 I’ll give you:\n` +
        `🔗 A *direct download link*\n` +
        `📺 A *stream link* (for files < 20MB, larger files will download)\n` + // Clarified streaming
        `📬 A *Telegram link* you can share\n\n` +
        `💡 *No need for your friends to have Telegram!* Just send them the link — they can download or stream the file in their browser, like any normal website.\n\n` +
        `🌐 *Works like magic*: Upload here ➜ Get a link ➜ Share anywhere.\n\n` +
        `⚠️ Note: Files above ~20MB might not stream directly in browser, but will be downloaded. Telegram Bot API limits direct upload to 50MB, but direct links from existing file_ids support up to 2GB.\n\n` + // Clarified limits
        `Need help? Type /start again or tap “Contact Owner” to reach me.`;
    
        return sendMessage(message.chat.id,message.message_id, helpText);
    }
    
    // Extract file details from the message directly
    if (message.document) {
        fID = message.document.file_id;
        fName = message.document.file_name || "document";
        fType = message.document.mime_type || "application/octet-stream";
        fSize = message.document.file_size;
    } else if (message.audio) {
        fID = message.audio.file_id;
        fName = message.audio.file_name || "audio";
        fType = message.audio.mime_type || "audio/mpeg";
        fSize = message.audio.file_size;
    } else if (message.video) {
        fID = message.video.file_id;
        fName = message.video.file_name || "video";
        fType = message.video.mime_type || "video/mp4";
        fSize = message.video.file_size;
    } else if (message.photo) {
        // Photos come in different sizes, take the largest one
        const largestPhoto = message.photo.reduce((prev, current) => (prev.file_size > current.file_size) ? prev : current);
        fID = largestPhoto.file_id;
        fName = largestPhoto.file_unique_id + '.jpg'; // Telegram doesn't provide original photo filename
        fType = "image/jpeg";
        fSize = largestPhoto.file_size;
    } else {
        return sendMessage(message.chat.id, message.message_id, "⚡️ Send me any file/video/gif/audio (up to 2GB)");
    }

    // Now, we have the fID (Telegram's file_id), fName, fType, and fSize directly from the message.
    // We don't need to re-save to BOT_CHANNEL or use `editMessage` to get these details again.
    // The `file_id` itself is enough to generate the links.

    // Base64 encode the Telegram file_id
    const final_hash = btoa(fID).replace(/=/g, "");
    
    const final_link = `${url.origin}/?file=${final_hash}`;
    const final_stre = `${url.origin}/?file=${final_hash}&mode=inline`;
    const final_tele = `https://t.me/${bot.username}/?start=${final_hash}`;

    // Create the inline keyboard
    const inlineKeyboard = {
        inline_keyboard: [
            [
                { text: "Telegram Link", url: final_tele },
                { text: "Download Link", url: final_link }
            ],
            [
                { text: "Stream Link", url: final_stre }
            ]
        ]
    };

    // Construct the message text
    let final_text = `*📁 File Name:* \`${fName}\`\n*⚙️ File Size:* \`${formatBytes(fSize)}\`\n*⚙️ File Hash:* \`${final_hash}\`\n`;

    // Send the message with the inline keyboard
    return sendMessageWithButtons(message.chat.id, message.message_id, final_text, inlineKeyboard);
}


// Helper function to format file size
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
