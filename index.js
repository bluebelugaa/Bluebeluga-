import { eventSource, event_types } from '../../../../script.js';

(function() {
    // --- 1. ส่วนคำสั่งลับสำหรับ AI ---
    const SYSTEM_INSTRUCTION = `
[SYSTEM NOTE: ทุกครั้งที่ตอบบทสนทนา คุณต้องสรุปข้อมูลสถานะปัจจุบันไว้ที่ท้ายข้อความเสมอ โดยใช้รูปแบบปิดท้ายดังนี้ (ห้ามพิมพ์อย่างอื่นนอกเหนือจากโครงสร้างนี้ในวงเล็บ):
[RP_DATA: world{วัน เดือน ปี|เวลา|สถานที่|สภาพอากาศ|อุณหภูมิ|ฤดูกาล} body{สภาพร่างกาย|เสื้อผ้า|อาการบาดเจ็บ} plan{ภารกิจหลัก|ตารางเวลา/แผนการ|หมายเหตุ}]
ให้ข้อมูลสอดคล้องกับเนื้อหาโรลเพลย์ล่าสุดเสมอ]`;

    // Hook เพื่อแอบใส่คำสั่งไปใน Prompt ก่อนส่งหา AI
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (payload) => {
        // แทรกคำสั่งเข้าไปเป็นข้อความล่าสุดของระบบ
        payload.prompt.push({
            role: 'system',
            content: SYSTEM_INSTRUCTION
        });
    });

    // --- 2. ส่วนการแสดงผล UI ---
    function extractRPData(text) {
        const regex = /\[RP_DATA:\s*world\{(.*?)\}\s*body\{(.*?)\}\s*plan\{(.*?)\}\s*\]/s;
        const match = text.match(regex);
        if (match) {
            return {
                world: match[1].split('|'),
                body: match[2].split('|'),
                plan: match[3].split('|')
            };
        }
        return null;
    }

    function injectDots(messageElement) {
        // หาตำแหน่งวันที่ (ที่อยู่บนขวาของข้อความ)
        const mesHeader = messageElement.querySelector('.mes_header');
        const dateElement = messageElement.querySelector('.mes_date');
        
        if (!mesHeader || messageElement.querySelector('.sweet-dots-wrapper')) return;

        const rawText = messageElement.querySelector('.mes_text').innerText;
        const data = extractRPData(rawText);

        if (!data) return;

        // ลบข้อความ Tag ออกจากหน้าแชทไม่ให้รกตา
        const textContent = messageElement.querySelector('.mes_text');
        textContent.innerHTML = textContent.innerHTML.replace(/\[RP_DATA:.*?\]/sg, '');

        // สร้างปุ่มวงกลม
        const wrapper = document.createElement('div');
        wrapper.className = 'sweet-dots-wrapper';
        wrapper.innerHTML = `
            <div class="s-dot d-world" title="World Info"></div>
            <div class="s-dot d-body" title="Character Status"></div>
            <div class="s-dot d-plan" title="Missions/Plans"></div>
        `;

        // นำไปวางแทนที่หรือข้างๆ วันที่
        if (dateElement) dateElement.style.display = 'none';
        mesHeader.appendChild(wrapper);

        // คลิกแล้วเด้ง Modal
        wrapper.querySelector('.d-world').onclick = () => showPop('🌍 โลกและสภาพอากาศ', data.world);
        wrapper.querySelector('.d-body').onclick = () => showPop('🧸 ร่างกายและการแต่งกาย', data.body);
        wrapper.querySelector('.d-plan').onclick = () => showPop('📅 ภารกิจและแผนการ', data.plan);
    }

    function showPop(title, items) {
        const modal = document.getElementById('rp-modal');
        const content = document.getElementById('rp-modal-content');
        document.getElementById('rp-modal-title').innerText = title;
        content.innerHTML = items.map(item => `<li>${item.trim()}</li>`).join('');
        modal.style.display = 'flex';
    }

    // ติดตามข้อความที่เกิดขึ้นใหม่
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
        const mesElement = document.querySelector(`[mesid="${mesId}"]`);
        if (mesElement) injectDots(mesElement);
    });

    // สร้าง Modal พื้นฐาน
    function init() {
        if (document.getElementById('rp-modal')) return;
        const modalHtml = `
            <div id="rp-modal" class="rp-overlay" onclick="this.style.display='none'">
                <div class="rp-box" onclick="event.stopPropagation()">
                    <div class="rp-header"><span id="rp-modal-title"></span></div>
                    <ul id="rp-modal-content" class="rp-list"></ul>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    init();
})();

