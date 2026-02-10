(function() {
    // ฟังก์ชันสร้าง UI เมื่อ Extension โหลด
    async function initExtension() {
        const container = document.createElement('div');
        container.id = 'sweet-dots-container';
        container.innerHTML = `
            <div class="status-dot dot-1" title="ข้อมูลโลก"></div>
            <div class="status-dot dot-2" title="สภาพตัวละคร"></div>
            <div class="status-dot dot-3" title="บันทึกอื่นๆ"></div>
        `;
        
        // นำไปวางในแถบเครื่องมือของ Silly Tavern
        document.body.appendChild(container);

        // สร้าง Modal พื้นฐานไว้ใน Body
        const modalHtml = `
            <div id="sweet-modal-overlay" class="sweet-overlay">
                <div class="sweet-modal-box">
                    <div class="sweet-modal-header">
                        <span id="sweet-modal-title">ข้อมูล</span>
                        <span id="sweet-modal-close">✖</span>
                    </div>
                    <div id="sweet-modal-content"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // จัดการเหตุการณ์การคลิก
        const overlay = document.getElementById('sweet-modal-overlay');
        const title = document.getElementById('sweet-modal-title');
        const content = document.getElementById('sweet-modal-content');
        const closeBtn = document.getElementById('sweet-modal-close');

        const showModal = (type) => {
            overlay.style.display = 'flex';
            if (type === 1) {
                title.innerText = "🌍 บันทึกการเดินทาง";
                content.innerHTML = `
                    <p><b>วัน/เดือน/ปี:</b> 11 กุมภาพันธ์ 2026</p>
                    <p><b>เวลา:</b> 02:50 น.</p>
                    <p><b>สถานที่:</b> คาเฟ่กระต่าย</p>
                    <p><b>สภาพอากาศ:</b> ท้องฟ้าแจ่มใส</p>
                    <p><b>อุณหภูมิ:</b> 25°C</p>
                    <p><b>ฤดูกาล:</b> ฤดูใบไม้ผลิ</p>
                `;
            } else if (type === 2) {
                title.innerText = "🧸 สภาพร่างกาย";
                content.innerHTML = `
                    <p><b>สภาพตัวละคร:</b> สดชื่น อารมณ์ดี</p>
                    <p><b>การแต่งกาย:</b> ชุดผ้าฝ้ายสีครีม</p>
                    <p><b>อาการบาดเจ็บ:</b> ไม่มี (แข็งแรงดีมาก)</p>
                    <p><b>ความหิว:</b> อิ่มหนำสำราญ (เพิ่งกินสเต็กเนื้อไป)</p>
                `;
            } else if (type === 3) {
                title.innerText = "✨ บันทึกเตือนความจำ";
                content.innerHTML = `
                    <p><b>ภารกิจหลัก:</b> พาเจ้าตัวเล็กไปตรวจสุขภาพ</p>
                    <p><b>ของที่ต้องซื้อ:</b> หญ้าอัลฟัลฟ่า, สตรอว์เบอร์รี่สด</p>
                    <p><b>หมายเหตุ:</b> ระวังอย่ากินกุ้งเด็ดขาด!</p>
                `;
            }
        };

        document.querySelector('.dot-1').onclick = () => showModal(1);
        document.querySelector('.dot-2').onclick = () => showModal(2);
        document.querySelector('.dot-3').onclick = () => showModal(3);
        
        closeBtn.onclick = () => overlay.style.display = 'none';
        overlay.onclick = (e) => { if(e.target === overlay) overlay.style.display = 'none'; };
    }

    initExtension();
})();
