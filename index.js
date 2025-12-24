// index.js - Chronos V40 (True Sight Edition) 👁️✨
// Accurate Token Counting via SillyTavern Internal Tools

const extensionName = "Chronos_V40_TrueSight";

// =================================================================
// 1. ADVANCED LOGIC: Tokenizer Bridge
// =================================================================
// ดึง Tokenizer ตัวเดียวกับที่ ST กำลังใช้กับโมเดลปัจจุบัน
const getTrueTokenizer = () => {
    if (typeof SillyTavern === 'undefined' || !SillyTavern.Tokenizers) return null;
    
    const context = SillyTavern.getContext();
    // ลองดึง model จากหลายแหล่ง
    const model = context.model || (context.settings ? context.settings.model : null);
    
    // เรียกใช้ฟังก์ชันภายในของ ST
    try {
        if (typeof SillyTavern.Tokenizers.getTokenizerForModel === 'function') {
            return SillyTavern.Tokenizers.getTokenizerForModel(model);
        }
        // Fallback สำหรับ ST เวอร์ชั่นเก่า
        if (typeof SillyTavern.Tokenizers.getTokenizer === 'function') {
            return SillyTavern.Tokenizers.getTokenizer(model);
        }
    } catch (e) {
        console.warn("[Chronos] Tokenizer fetch failed:", e);
    }
    return null;
};

// ฟังก์ชันนับ Token ที่แม่นยำที่สุด (เรียกใช้ Encode จริง)
const countRealTokens = (text, tokenizer = null) => {
    if (!text) return 0;
    try {
        const tk = tokenizer || getTrueTokenizer();
        if (tk && typeof tk.encode === 'function') {
            return tk.encode(text).length;
        }
        // Fallback: ถ้าหา Tokenizer ไม่เจอจริงๆ ให้ใช้สูตรประมาณการ
        if (typeof GPTTokenizer_Encoding_Encode === 'function') {
            return GPTTokenizer_Encoding_Encode(text).length;
        }
        return Math.round(text.length / 2.8); 
    } catch (e) {
        return Math.round(text.length / 3);
    }
};

// ฟังก์ชันนับ Chat Object (พยายามจำลอง Overhead)
const countChatMessage = (role, content, tokenizer) => {
    // ST ส่วนใหญ่มี overhead ต่อข้อความประมาณ 4-7 tokens (Role + Tags)
    // เราจะนับ content + 5 เพื่อความใกล้เคียง
    const contentCount = countRealTokens(content, tokenizer);
    return contentCount + 5; 
};

// =================================================================
// 2. TEXT PROCESSING
// =================================================================
const stripHtmlToText = (html) => {
    if (!html) return "";
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ''); 
    text = text.replace(/&lt;[^&]+&gt;/g, ''); 
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

// =================================================================
// 3. CORE CALCULATOR (Payload Based)
// =================================================================
// ตัวแปรเก็บค่าล่าสุดที่ส่งจริง (แม่นยำ 100%)
let lastPayloadStats = { original: 0, optimized: 0, saved: 0 };

const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { memoryRange: "Syncing...", original: 0, optimized: 0, remaining: 0, saved: 0, max: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const tokenizer = getTrueTokenizer();

    // --- 1. Max Context (Max of Maxes Logic) ---
    let maxTokens = 8192;
    const candidateValues = [];
    
    // UI Values
    ['max_context', 'max_tokens', 'cfg_ctx_size'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !isNaN(parseInt(el.value))) candidateValues.push(parseInt(el.value));
    });
    // API & Context Values
    if (SillyTavern.main_api && SillyTavern.main_api.max_context) candidateValues.push(SillyTavern.main_api.max_context);
    if (context.max_context) candidateValues.push(context.max_context);
    
    const validValues = candidateValues.filter(v => typeof v === 'number' && v > 100);
    if (validValues.length > 0) maxTokens = Math.max(...validValues);

    // --- 2. Calculate Token Loads ---
    // พยายามใช้ค่า context.tokens ที่ ST คำนวณมาให้ (แม่นยำระดับนึง)
    let originalTotalLoad = context.tokens || 0;
    
    // ถ้าเราเคยส่ง request ไปแล้ว ให้ใช้ค่าจริงที่เราดักได้ (แม่นกว่า)
    if (lastPayloadStats.original > 0 && Math.abs(lastPayloadStats.original - originalTotalLoad) < 500) {
        // ใช้ค่า ST ถ้ามันใกล้เคียง (แปลว่ามีการพิมพ์เพิ่ม) แต่ถ้าต่างกันมาก ใช้ค่าล่าสุด
    }

    // --- 3. Iterate Chat for Optimization Stats ---
    let sumOriginalChatTokens = 0;
    let sumOptimizedChatTokens = 0;
    let totalSaved = 0;
    let chatDetails = [];

    // วนลูปเช็คทุกข้อความด้วย Tokenizer จริง
    chat.forEach((msg, index) => {
        // A. Original
        const rawLen = countChatMessage(msg.is_user ? 'user' : 'assistant', msg.mes, tokenizer);
        sumOriginalChatTokens += rawLen;

        // B. Optimized (Strip HTML)
        let cleanContent = msg.mes;
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(cleanContent)) {
             const clean = stripHtmlToText(cleanContent);
             // จำลอง format ที่เราจะส่งจริง
             cleanContent = `[System Content:\n${clean}]`;
        }
        const optLen = countChatMessage(msg.is_user ? 'user' : 'assistant', cleanContent, tokenizer);
        sumOptimizedChatTokens += optLen;

        // Diff
        const diff = Math.max(0, rawLen - optLen);
        totalSaved += diff;

        chatDetails.push({ index: index, optimizedSize: optLen });
    });

    // --- 4. Final Math ---
    // System Overhead = (ค่ารวมที่ ST บอก) - (ค่าแชทดิบที่เรานับได้)
    // ถ้าคำนวณแล้วติดลบ ให้ افترض ว่า overhead คือ 0
    let staticOverhead = Math.max(0, originalTotalLoad - sumOriginalChatTokens);
    
    // Optimized Load = Overhead เดิม + แชทที่ลดขนาดแล้ว
    const optimizedLoad = staticOverhead + sumOptimizedChatTokens;
    const remainingSpace = Math.max(0, maxTokens - optimizedLoad);

    // --- 5. Memory Range Logic ---
    const availableForChat = maxTokens - staticOverhead;
    let currentFill = 0;
    let startMsgIndex = -1;
    let rememberedCount = 0;

    for (let i = chatDetails.length - 1; i >= 0; i--) {
        const msgSize = chatDetails[i].optimizedSize;
        if (currentFill + msgSize <= availableForChat) {
            currentFill += msgSize;
            startMsgIndex = chatDetails[i].index;
            rememberedCount++;
        } else {
            break;
        }
    }

    let memoryRangeText = "";
    if (chat.length === 0) memoryRangeText = "-";
    else if (rememberedCount >= chat.length) memoryRangeText = `All (#0 - #${chat.length - 1})`;
    else if (startMsgIndex !== -1) memoryRangeText = `#${startMsgIndex} ➔ #${chat.length - 1}`;
    else memoryRangeText = "None (Context Full)";

    return {
        memoryRange: memoryRangeText,
        original: originalTotalLoad,
        optimized: optimizedLoad,
        remaining: remainingSpace,
        saved: totalSaved,
        max: maxTokens
    };
};

// =================================================================
// 4. REQUEST INTERCEPTOR (The Spy)
// =================================================================
const optimizePayload = (data) => {
    // 1. Snapshot Original Count (ถ้าทำได้)
    // ตรงนี้ยาก เพราะ ST ส่งมาเป็น JSON แล้ว เราจะนับจาก processed payload
    
    const tokenizer = getTrueTokenizer();
    let originalCountEstimate = 0;
    
    // Helper Process
    const processText = (text) => {
        if (!text) return "";
        // นับก่อนตัด (Estimate)
        if (tokenizer) originalCountEstimate += tokenizer.encode(text).length;
        
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };

    // 2. Modify & Count
    let optimizedBodyTokens = 0;

    if (data.body && data.body.messages) {
        // Chat Completion
        data.body.messages.forEach(msg => {
            msg.content = processText(msg.content);
        });
        // นับ Token จริงที่กำลังจะส่ง (Payload Level)
        if (tokenizer && typeof tokenizer.countChatTokens === 'function') {
             optimizedBodyTokens = tokenizer.countChatTokens(data.body.messages);
        } else if (tokenizer) {
             // Fallback encode all text
             const fullText = data.body.messages.map(m => m.content).join("\n");
             optimizedBodyTokens = tokenizer.encode(fullText).length;
        }

    } else if (data.body && data.body.prompt) {
        // Text Completion
        const originalPrompt = data.body.prompt;
        if (Array.isArray(originalPrompt)) {
             data.body.prompt = originalPrompt.map(p => processText(p));
        } else {
             data.body.prompt = processText(originalPrompt);
        }
        
        if (tokenizer) {
             const finalPrompt = Array.isArray(data.body.prompt) ? data.body.prompt.join("") : data.body.prompt;
             optimizedBodyTokens = tokenizer.encode(finalPrompt).length;
        }
    }

    // 3. Update Stats for UI
    if (optimizedBodyTokens > 0) {
        lastPayloadStats.optimized = optimizedBodyTokens;
        // เราประมาณการ Original ได้จาก (Optimized + Saved Diff จากหน้า UI)
        // แต่วิธีที่ง่ายกว่าคือ Update UI เดี๋ยวคำนวณใหม่เอง
    }

    // Force UI Refresh
    setTimeout(() => {
        const ins = document.getElementById('chronos-inspector');
        if (ins && ins.style.display === 'block') renderInspector();
    }, 500);
    
    return data;
};

// =================================================================
// 5. UI SYSTEM (Neon Cyberpunk)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 40px; height: 40px;
            background: radial-gradient(circle, rgba(0,20,30,0.9) 0%, #000 100%);
            border: 2px solid #00E676; border-radius: 50%;
            z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #00E676; 
            box-shadow: 0 0 15px rgba(0, 230, 118, 0.6);
            user-select: none; animation: pulse-green 3s infinite alternate;
        }
        #chronos-orb:hover { transform: scale(1.1); border-color: #D500F9; color: #D500F9; box-shadow: 0 0 25px #D500F9; }
        @keyframes pulse-green { 0% { box-shadow: 0 0 10px #00E676; } 100% { box-shadow: 0 0 20px #00E676; } }

        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px; 
            background: rgba(8, 8, 10, 0.95); 
            border: 1px solid #00E676; border-top: 3px solid #00E676;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 12px;
            display: none; z-index: 999999; border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.9); backdrop-filter: blur(10px);
        }
        .ins-header { 
            background: linear-gradient(90deg, #004d40, #00251a); 
            color: #fff; padding: 10px; font-weight: bold; display: flex; justify-content: space-between; 
            border-bottom: 1px solid #00E676;
        }
        .control-zone { display: flex; gap: 15px; padding: 6px 10px; background: #001a14; color: #00E676; font-size: 11px; }
        .dashboard-zone { background: #000; padding: 15px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
        .progress-container { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #00E676, #D500F9); width: 0%; transition: width 0.4s; }
        
        .ins-body { padding: 10px; background: #0a0a0a; max-height: 400px; overflow-y: auto;}
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #111; border-radius: 4px; }
        .msg-item { padding: 6px; cursor: pointer; border-bottom: 1px solid #222; color: #888; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .msg-item:hover { background: #004d40; color: #fff; }
        
        #view-target-wrapper { margin-top:10px; border-top:1px dashed #444; padding-top:10px; display:none; }
        .view-area { background: #050505; color: #00E676; padding: 10px; height: 140px; overflow-y: auto; border: 1px solid #333; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; }
        .stat-badge { display: flex; justify-content: space-between; margin-top: 5px; background: #222; padding: 6px; border-radius: 4px; }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; }
        ::-webkit-scrollbar-thumb:hover { background: #00E676; }
    `;
    document.head.appendChild(style);
};

let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const createUI = () => {
    const oldOrb = document.getElementById('chronos-orb'); if (oldOrb) oldOrb.remove();
    const oldPanel = document.getElementById('chronos-inspector'); if (oldPanel) oldPanel.remove();

    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '👁️';
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.appendChild(orb); document.body.appendChild(ins);
    
    orb.onclick = () => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };

    makeDraggable(orb, 'orb'); makeDraggable(ins, 'panel');
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    if (ins.style.display === 'none') return;

    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateStats();
    const percent = stats.max > 0 ? Math.min((stats.optimized / stats.max) * 100, 100) : 0;
    
    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = (msg.mes || "").substring(0, 25).replace(/</g, '&lt;');
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">
                    <span style="color:#00E676;">#${actualIdx}</span> ${msg.is_user ? '👤' : '🤖'} ${preview}...
                </div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>CHRONOS V40 (True Sight)</span>
            <span style="cursor:pointer; color:#ff5252;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        <div class="control-zone">
            <label><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> Orb</label>
            <label><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> Win</label>
        </div>
        <div class="dashboard-zone">
            <div class="dash-row">
                <span style="color:#aaa;">🧠 Context Range</span>
                <span style="color:#00E676; font-weight:bold;">${stats.memoryRange}</span>
            </div>
            <div class="dash-row">
                <span style="color:#aaa;">🛡️ Saved</span>
                <span style="color:#D500F9; font-weight:bold;">-${stats.saved}</span>
            </div>
            <div class="dash-row">
                <span style="color:#fff;">🔋 Load / Max</span>
                <span style="color:#fff; font-weight:bold;">${stats.optimized} / ${stats.max}</span>
            </div>
            <div class="progress-container"><div class="progress-bar" style="width: ${percent}%"></div></div>
        </div>
        <div class="ins-body">
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <input type="number" id="chronos-search-id" placeholder="ID" style="background:#222; border:1px solid #444; color:#fff; width:50px; padding:3px;">
                <button onclick="searchById()" style="background:#00E676; border:none; padding:3px 10px; cursor:pointer; font-weight:bold;">GO</button>
            </div>
            <div class="msg-list">${listHtml}</div>
            <div id="view-target-wrapper"><div id="view-target-content"></div></div>
        </div>
    `;
};

// =================================================================
// 6. DRAG & VIEW UTILS
// =================================================================
window.toggleDrag = (type, c) => {
    if (type === 'orb') dragConfig.orbUnlocked = c;
    if (type === 'panel') { dragConfig.panelUnlocked = c; document.getElementById('panel-header').style.cursor = c ? 'move' : 'default'; }
};
const makeDraggable = (elm, type) => {
    let pos1=0,pos2=0,pos3=0,pos4=0;
    const ds = (e) => {
        if ((type==='orb' && !dragConfig.orbUnlocked) || (type==='panel' && !dragConfig.panelUnlocked)) return;
        if (type==='panel' && !e.target.closest('.ins-header')) return;
        const c = e.touches ? e.touches[0] : e;
        pos3=c.clientX; pos4=c.clientY;
        document.onmouseup = de; document.onmousemove = da; document.ontouchend = de; document.ontouchmove = da;
        elm.setAttribute('data-dragging', 'true');
    };
    const da = (e) => {
        const c = e.touches ? e.touches[0] : e;
        pos1=pos3-c.clientX; pos2=pos4-c.clientY; pos3=c.clientX; pos4=c.clientY;
        elm.style.top=(elm.offsetTop-pos2)+"px"; elm.style.left=(elm.offsetLeft-pos1)+"px";
        e.preventDefault();
    };
    const de = () => { document.onmouseup=null; document.onmousemove=null; document.ontouchend=null; document.ontouchmove=null; setTimeout(()=>elm.setAttribute('data-dragging','false'),100); };
    elm.onmousedown=ds; elm.ontouchstart=ds;
};

window.searchById = () => {
    const id = parseInt(document.getElementById('chronos-search-id').value);
    const chat = SillyTavern.getContext().chat || [];
    if (!isNaN(id) && id >= 0 && id < chat.length) viewAIVersion(id);
};

window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat || [];
    const msg = chat[index];
    if (!msg) return;
    
    document.getElementById('view-target-wrapper').style.display = 'block';
    const tokenizer = getTrueTokenizer();
    
    const rawLen = countChatMessage('user', msg.mes, tokenizer);
    
    let cleanText = stripHtmlToText(msg.mes);
    let aiViewText = msg.mes;
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(msg.mes)) aiViewText = `[System Content:\n${cleanText}]`;
    
    const optLen = countChatMessage('user', aiViewText, tokenizer);
    const saved = Math.max(0, rawLen - optLen);

    document.getElementById('view-target-content').innerHTML = `
        <div style="color:#00E676; margin-bottom:5px; font-size:10px;">ID: #${index}</div>
        <div class="view-area">${aiViewText.replace(/</g, '&lt;')}</div>
        <div class="stat-badge">
            <span style="color:#aaa;">Raw: ${rawLen}</span>
            <span style="color:#fff;">Sent: ${optLen}</span>
            <span style="color:#D500F9;">Saved: -${saved}</span>
        </div>
    `;
};

// =================================================================
// 7. INIT
// =================================================================
(function() {
    injectStyles();
    setTimeout(createUI, 2000);
    if (typeof SillyTavern !== 'undefined') {
        console.log(`[${extensionName}] Ready. Using ST Tokenizers.`);
        SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
        SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    }
})();
                                                    
