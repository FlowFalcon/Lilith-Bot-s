const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ⚠️ API KEY GEMINI
const GEMINI_API_KEY = config.geminikey;

// PENYIMPANAN SESSION (MEMORY)
// Format: Map<SenderID, Array<{role: string, parts: [{text: string}] }>>
const userSessions = new Map();

let handler = async (m, { conn, text, args, usedPrefix, command }) => {
    // 1. FITUR RESET SESSION
    if (args[0] === '--clear' || args[0] === '-c') {
        userSessions.delete(m.sender);
        return m.reply("🗑️ *Memory/Session chat berhasil dihapus!* AI sekarang sudah lupa konteks sebelumnya.");
    }

    if (!text) return m.reply(`*AI Developer Mode (Session On)*\n\nContoh penggunaan:\n1. *${usedPrefix + command} buatkan fitur tebak lagu*\n2. *${usedPrefix + command} kurang lengkap, tolong tambahkan fitur skor* (Mode ngobrol)\n\nKetik *${usedPrefix + command} --clear* untuk menghapus ingatan AI.`);

    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("ISI_API_KEY")) {
        return m.reply("❌ API Key Gemini belum diisi di config.js");
    }

    // VARIABEL UNTUK PESAN LOADING (BIAR BISA DI-EDIT)
    let loadingMsg = null;

    // FUNGSI UPDATE STATUS (EDIT PESAN)
    const updateStatus = async (statusText) => {
        if (!loadingMsg) {
            // Kirim pesan pertama kali
            loadingMsg = await conn.sendMessage(m.chat, { text: statusText }, { quoted: m });
        } else {
            // Edit pesan yang sudah ada
            await conn.sendMessage(m.chat, { text: statusText, edit: loadingMsg.key });
        }
    };

    try {
        await updateStatus("🔍 *Scanning project structure...*");
        
        // 1. SCAN PROJECT
        const allFiles = scanProject(process.cwd());
        
        // 2. AI MEMILIH FILE (Context Retrieval)
        // Kita hanya melakukan ini jika ini percakapan baru atau user eksplisit meminta fitur baru.
        // Tapi untuk aman, kita lakukan setiap saat agar konteks selalu fresh.
        await updateStatus("🧠 *AI sedang menganalisis file relevan...*");
        const relevantFiles = await identifyRelevantFiles(text, allFiles);
        
        // 3. BACA FILE
        await updateStatus(`📖 *Membaca ${relevantFiles.length} file context...*`);
        const fileContexts = readFiles(relevantFiles);

        // 4. SUSUN HISTORY CHAT (SESSION)
        let history = userSessions.get(m.sender) || [];
        
        // Batasi history biar gak terlalu panjang (Max 10 pertukaran terakhir)
        if (history.length > 20) history = history.slice(-20);

        // Tambahkan System Instruction + Context di setiap request (agar AI selalu ingat struktur project)
        let quotedCode = m.quoted ? `\n\n--- QUOTED CODE ---\n${m.quoted.text}\n-------------------` : "";
        
        const systemPrompt = `
You are the Lead Developer of this specific Bot Project.
Current Context Files:
${fileContexts}

INSTRUCTIONS:
1. Continue the conversation or perform the coding task requested by the user.
2. Use the provided PROJECT CONTEXT to ensure variable names/libraries match.
3. If writing code, provide ONLY the raw code (CommonJS) without markdown codeblocks (\`\`\`) if possible, or minimal explanation.
4. If the user asks to "continue", output the rest of the code from the previous turn.
5. You can remember previous messages in this conversation.
`;

        // Susun Payload untuk Gemini
        // Format: [User (System+Context+Query), Model, User, Model...]
        // Karena Gemini via API Key kadang strict soal role "system", kita taruh context di pesan user terakhir atau pertama.
        
        const messages = [
            {
                role: "user",
                parts: [{ text: systemPrompt + `\n\nUSER REQUEST:\n"${text}"${quotedCode}` }]
            }
        ];

        // Masukkan history sebelumnya (kecuali prompt system/context yang lama, biar gak duplikat)
        // Kita hanya ambil history percakapan murni
        if (history.length > 0) {
            // Sisipkan history di antara system prompt (implisit) dan query baru
            // Tapi cara paling aman di API sederhana adalah append history
            // Strategy: Kita kirim history sebagai context tambahan jika mau, 
            // TAPI cara terbaik Gemini API adalah mengirim array contents lengkap.
            
            // Re-construct message array:
            // 1. Prompt Awal (dengan context file terbaru)
            // 2. History Chat
            // 3. Prompt Akhir (Pertanyaan User) -> Sudah digabung di atas untuk simplifikasi 'stateless' context refresh, 
            // TAPI untuk session 'chat', kita harus kirim history.
            
            // Let's refine the strategy:
            // Message 0: System Prompt (Static rules) + Context Files
            // Message 1..N: History
            // Message N+1: Current User Query
            
            const contents = [
                { role: "user", parts: [{ text: systemPrompt }] }, // Context selalu update
                ...history, 
                { role: "user", parts: [{ text: text + quotedCode }] }
            ];
            
            // Kirim request
            await updateStatus("⚡ *Sedang mengetik...*");
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                { contents: contents },
                { timeout: 120000 }
            );

            const aiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponse) throw new Error("Empty response from AI");

            // Simpan ke session
            history.push({ role: "user", parts: [{ text: text + quotedCode }] });
            history.push({ role: "model", parts: [{ text: aiResponse }] });
            userSessions.set(m.sender, history);

            // Final Edit dengan Hasil
            await updateStatus(aiResponse.replace(/```javascript/g, '').replace(/```/g, '').trim());
            
        } else {
            // First time chat
            await updateStatus("⚡ *Sedang mengetik...*");
             const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    contents: messages
                },
                { timeout: 120000 }
            );
            
            const aiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponse) throw new Error("Empty response from AI");

            // Simpan Session Baru
            history.push({ role: "user", parts: [{ text: text + quotedCode }] });
            history.push({ role: "model", parts: [{ text: aiResponse }] });
            userSessions.set(m.sender, history);

            await updateStatus(aiResponse.replace(/```javascript/g, '').replace(/```/g, '').trim());
        }

    } catch (e) {
        console.error(e);
        let errMsg = e.response?.data?.error?.message || e.message;
        await updateStatus(`❌ *Error:*\n${errMsg}`);
    }
};

// --- HELPER FUNCTIONS (SAMA SEPERTI SEBELUMNYA) ---

function scanProject(dir, fileList = [], relativePath = '') {
    const files = fs.readdirSync(dir);
    const ignoreList = ['node_modules', '.git', 'sessions', 'session', 'tmp', 'temp', 'package-lock.json', 'yarn.lock'];

    files.forEach(file => {
        if (ignoreList.includes(file)) return;
        const fullPath = path.join(dir, file);
        const relPath = path.join(relativePath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanProject(fullPath, fileList, relPath);
        } else {
            if (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.md')) {
                fileList.push(relPath);
            }
        }
    });
    return fileList;
}

async function identifyRelevantFiles(query, fileList) {
    // Prompt ringan untuk memilih file (tanpa session user, murni logic selector)
    const prompt = `
PROJECT FILES:
${fileList.join('\n')}
QUERY: "${query}"
TASK: Return JSON Array of 5-10 most relevant file paths to answer the query. Always include config.js/package.json.
Example: ["package.json", "config.js", "plugins/menu.js"]
`;
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] }
        );
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        return ['package.json', 'config.js']; // Fallback
    }
}

function readFiles(filePaths) {
    let content = "";
    const rootDir = process.cwd();
    filePaths.forEach(filePath => {
        try {
            const fullPath = path.join(rootDir, filePath);
            if (fs.existsSync(fullPath)) {
                const data = fs.readFileSync(fullPath, 'utf8');
                const truncatedData = data.length > 8000 ? data.substring(0, 8000) + "\n...[TRUNCATED]" : data;
                content += `\n--- FILE: ${filePath} ---\n${truncatedData}\n`;
            }
        } catch (e) {}
    });
    return content;
}

handler.help = ["aidev"];
handler.tags = ["owner"];
handler.command = ["aidev", "buatin"];
handler.isOwner = true;

module.exports = handler;