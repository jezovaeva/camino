document.addEventListener('DOMContentLoaded', () => {
    // --- OCHRANA VERZE APLIKACE ---
    const VERZE_APLIKACE = "1.2"; 

    let globalniRozpocet = 0;
    let globalniPocetDniRozpocet = 0;
    let globalniPocetDniItinerar = 0;
    let globalniKurzEura = 25.0; 
    let celkemUtraceno = 0;

    // --- 1. FUNKCE PRO UKLÁDÁNÍ A NAČÍTÁNÍ Z PAMĚTI ---
    function ulozVse() {
        document.querySelectorAll('input').forEach(input => {
            if (input.type === 'checkbox') {
                if (input.checked) input.setAttribute('checked', 'checked');
                else input.removeAttribute('checked');
            } else {
                input.setAttribute('value', input.value);
            }
        });
        document.querySelectorAll('select').forEach(sel => {
            sel.querySelectorAll('option').forEach(opt => {
                if (opt.value === sel.value) opt.setAttribute('selected', 'selected');
                else opt.removeAttribute('selected');
            });
        });

        const appData = {
            verze: VERZE_APLIKACE,
            rozpocet: globalniRozpocet,
            dnyRozpocet: globalniPocetDniRozpocet,
            dnyItinerar: globalniPocetDniItinerar,
            kurz: globalniKurzEura,
            utraceno: celkemUtraceno,
            uvod: document.getElementById('sekce-uvod').innerHTML,
            finance: document.getElementById('sekce-finance').innerHTML,
            tabs: document.getElementById('day-tabs').innerHTML,
            itinerar: document.getElementById('itinerary-list').innerHTML,
            seznamy: document.getElementById('lists-container').innerHTML,
            odkazy: document.getElementById('links-list') ? document.getElementById('links-list').innerHTML : ''
        };
        localStorage.setItem('caminoData', JSON.stringify(appData));
    }

    function nactiVse() {
        const ulozene = localStorage.getItem('caminoData');
        if (ulozene) {
            const appData = JSON.parse(ulozene);
            
            if (appData.verze !== VERZE_APLIKACE) {
                localStorage.removeItem('caminoData');
                alert("Nová verze aplikace (Eura u ubytování)! Paměť byla resetována pro správnou strukturu.");
                window.location.reload();
                return;
            }

            globalniRozpocet = appData.rozpocet;
            globalniPocetDniRozpocet = appData.dnyRozpocet;
            globalniPocetDniItinerar = appData.dnyItinerar;
            globalniKurzEura = appData.kurz || 25.0;
            celkemUtraceno = appData.utraceno;

            document.getElementById('sekce-uvod').innerHTML = appData.uvod;
            document.getElementById('sekce-finance').innerHTML = appData.finance;
            document.getElementById('day-tabs').innerHTML = appData.tabs;
            document.getElementById('itinerary-list').innerHTML = appData.itinerar;
            document.getElementById('lists-container').innerHTML = appData.seznamy;
            if (appData.odkazy && document.getElementById('links-list')) {
                document.getElementById('links-list').innerHTML = appData.odkazy;
            }

            ozivitAplikaci();
            prepniSekci('sekce-finance'); 
            aktualizovatFinance();
        } else {
            ozivitAplikaci(); 
        }
    }

    function prepniSekci(targetId) {
        document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(targetId)?.classList.add('active');
        document.querySelector(`[data-target="${targetId}"]`)?.classList.add('active');
        const mainNav = document.getElementById('main-nav');
        if (mainNav) {
            if (targetId === 'sekce-uvod') mainNav.classList.add('hidden');
            else mainNav.classList.remove('hidden');
        }
    }

    function prepocitatDny() {
        const start = document.getElementById('trip-start')?.value;
        const end = document.getElementById('trip-end')?.value;
        if (start && end) {
            const d1 = new Date(start);
            const d2 = new Date(end);
            const dny = ((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)) + 1;
            if (dny > 0) document.getElementById('trip-budget-days').value = dny;
        }
    }

    // --- MAGIE: ZACHOVÁNÍ DAT V ITINERÁŘI ---
    function ziskatDataItinerare() {
        let data = [];
        document.querySelectorAll('.day-detail').forEach(day => {
            data.push({
                start: day.querySelector('input[placeholder="Start"]')?.value || '',
                cil: day.querySelector('input[placeholder="Cíl"]')?.value || '',
                km: day.querySelector('.km-input')?.value || '',
                hotel: day.querySelector('input[placeholder="Hotel"]')?.value || '',
                cena: day.querySelector('.hotel-price')?.value || '',
                menaCeny: day.querySelector('.hotel-currency')?.value || 'CZK',
                cas: day.querySelector('input[type="time"]')?.value || '',
                adresa: day.querySelector('.adresa-input')?.value || '',
                kolo: day.querySelectorAll('input[placeholder="Kód od dveří..."]')[0]?.value || '',
                poznamka: day.querySelectorAll('input[placeholder="Zajímavosti cestou..."]')[0]?.value || ''
            });
        });
        return data;
    }

    function nacistDataItinerare(data) {
        document.querySelectorAll('.day-detail').forEach((day, index) => {
            if(data[index]) {
                const d = data[index];
                if(day.querySelector('input[placeholder="Start"]')) day.querySelector('input[placeholder="Start"]').value = d.start;
                if(day.querySelector('input[placeholder="Cíl"]')) day.querySelector('input[placeholder="Cíl"]').value = d.cil;
                if(day.querySelector('.km-input')) day.querySelector('.km-input').value = d.km;
                if(day.querySelector('input[placeholder="Hotel"]')) day.querySelector('input[placeholder="Hotel"]').value = d.hotel;
                if(day.querySelector('.hotel-price')) day.querySelector('.hotel-price').value = d.cena;
                if(day.querySelector('.hotel-currency')) day.querySelector('.hotel-currency').value = d.menaCeny || 'CZK';
                if(day.querySelector('input[type="time"]')) day.querySelector('input[type="time"]').value = d.cas;
                if(day.querySelector('.adresa-input')) day.querySelector('.adresa-input').value = d.adresa;
                if(day.querySelectorAll('input[placeholder="Kód od dveří..."]')[0]) day.querySelectorAll('input[placeholder="Kód od dveří..."]')[0].value = d.kolo;
                if(day.querySelectorAll('input[placeholder="Zajímavosti cestou..."]')[0]) day.querySelectorAll('input[placeholder="Zajímavosti cestou..."]')[0].value = d.poznamka;
            }
        });
    }

    // --- FINANČNÍ MATEMATIKA A PIE CHART ---
    function aktualizovatFinance() {
        let nakladyUbytovani = 0;
        document.querySelectorAll('.day-detail').forEach(day => {
            const val = Number(day.querySelector('.hotel-price')?.value || 0);
            const curr = day.querySelector('.hotel-currency')?.value || 'CZK';
            if (val > 0) {
                nakladyUbytovani += (curr === 'EUR') ? Math.round(val * globalniKurzEura) : val;
            }
        });

        let cistyRozpocet = globalniRozpocet - nakladyUbytovani;
        let zbyva = cistyRozpocet - celkemUtraceno;
        let puvodniNaDen = globalniPocetDniRozpocet > 0 ? (cistyRozpocet / globalniPocetDniRozpocet) : 0; 
        let naDen = globalniPocetDniRozpocet > 0 ? (zbyva / globalniPocetDniRozpocet) : 0; 

        document.getElementById('zbyva-ubytovani').innerText = nakladyUbytovani + " Kč";
        document.getElementById('zbyva-celkem').innerText = zbyva + " Kč";
        document.getElementById('zbyva-na-den').innerText = Math.round(naDen) + " Kč";

        let dnyUplynulo = 1; 
        const startInput = document.getElementById('trip-start');
        if (startInput && startInput.value) {
            const startDate = new Date(startInput.value);
            startDate.setHours(0,0,0,0);
            const dnes = new Date();
            dnes.setHours(0,0,0,0);
            const rozdilDni = Math.floor((dnes.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
            if (rozdilDni > 0) dnyUplynulo = Math.min(rozdilDni, globalniPocetDniRozpocet);
        }

        let ocekavanaUtrata = dnyUplynulo * puvodniNaDen;
        let bilance = ocekavanaUtrata - celkemUtraceno;

        const bilanceEl = document.getElementById('bilance-text');
        if (bilance > 0) {
            bilanceEl.innerText = `+ ${Math.round(bilance)} Kč 🎉`;
            bilanceEl.style.color = "#16a34a";
        } else if (bilance < 0) {
            bilanceEl.innerText = `${Math.round(bilance)} Kč ⚠️`;
            bilanceEl.style.color = "#dc2626";
        } else {
            bilanceEl.innerText = `0 Kč (Přesně) 👍`;
            bilanceEl.style.color = "var(--text-muted)";
        }

        let katUbytovani = 0, katJidlo = 0, katDoprava = 0, katOstatni = 0;
        
        document.querySelectorAll('#expense-list li').forEach(li => {
            const spanKat = li.querySelector('span[style*="background"]');
            const spanCastka = li.querySelector('.history-amount-czk');
            if (spanKat && spanCastka) {
                const kat = spanKat.innerText.trim();
                const castka = Number(spanCastka.getAttribute('data-amount')) || 0; 
                
                if (kat === 'Ubytování') katUbytovani += castka;
                else if (kat === 'Jídlo a pití' || kat === 'Jídlo') katJidlo += castka;
                else if (kat === 'Doprava') katDoprava += castka;
                else if (kat === 'Ostatní') katOstatni += castka;
            }
        });

        katUbytovani += nakladyUbytovani;
        const sumaVseho = katUbytovani + katJidlo + katDoprava + katOstatni;
        const graphCard = document.getElementById('graph-card');

        if (sumaVseho > 0 && graphCard) {
            graphCard.style.display = 'block';
            const pUby = Math.round((katUbytovani / sumaVseho) * 100);
            const pJid = Math.round((katJidlo / sumaVseho) * 100);
            const pDop = Math.round((katDoprava / sumaVseho) * 100);
            const pOst = 100 - (pUby + pJid + pDop);

            document.getElementById('pct-ubytovani').innerText = pUby + "%";
            document.getElementById('pct-jidlo').innerText = pJid + "%";
            document.getElementById('pct-doprava').innerText = pDop + "%";
            document.getElementById('pct-ostatni').innerText = (pOst < 0 ? 0 : pOst) + "%";

            const degUby = (katUbytovani / sumaVseho) * 360;
            const degJid = (katJidlo / sumaVseho) * 360;
            const degDop = (katDoprava / sumaVseho) * 360;

            const chart = document.getElementById('pie-chart');
            if (chart) {
                chart.style.background = `conic-gradient(#0284c7 0deg ${degUby}deg, #f59e0b ${degUby}deg ${degUby + degJid}deg, #10b981 ${degUby + degJid}deg ${degUby + degJid + degDop}deg, #6366f1 ${degUby + degJid + degDop}deg 360deg)`;
            }

            if (dnyUplynulo > 0) {
                const prumerNaDen = Math.round(celkemUtraceno / dnyUplynulo);
                document.getElementById('prumer-vydaj-text').innerText = `Průměrná denní útrata (bez ubytování): ${prumerNaDen} Kč / den`;
            }
        } else if (graphCard) {
            graphCard.style.display = 'none';
        }
    }

    function aktualizovatKilometry() {
        let celkemKm = 0;
        document.querySelectorAll('.km-input').forEach(input => {
            const val = Number(input.value);
            if (!isNaN(val) && val > 0) celkemKm += val;
        });
        document.getElementById('celkem-km').innerText = celkemKm + " km";
    }

    function ozivitAplikaci() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.onclick = () => { prepniSekci(btn.getAttribute('data-target')); ulozVse(); };
        });

        const startInp = document.getElementById('trip-start');
        const endInp = document.getElementById('trip-end');
        if (startInp) startInp.onchange = prepocitatDny;
        if (endInp) endInp.onchange = prepocitatDny;

        const saveBtn = document.getElementById('save-trip-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const nazev = document.getElementById('trip-name').value;
                const rozpocet = document.getElementById('trip-budget').value;
                const datumOd = document.getElementById('trip-start').value;
                const datumDo = document.getElementById('trip-end').value;
                const manualDny = document.getElementById('trip-budget-days').value;
                const kurz = document.getElementById('trip-exchange-rate').value;

                if (!nazev || !rozpocet || !datumOd || !datumDo) return alert('Vyplňte název, rozpočet a obě data.');
                const pocetDni = ((new Date(datumDo).getTime() - new Date(datumOd).getTime()) / (1000 * 3600 * 24)) + 1;
                if (pocetDni <= 0) return alert('Návrat musí být po odjezdu!');

                let pocetRozpocet = manualDny ? Number(manualDny) : pocetDni;
                if (pocetRozpocet <= 0 || isNaN(pocetRozpocet)) pocetRozpocet = pocetDni;

                let staraData = ziskatDataItinerare();

                document.getElementById('display-trip-name').innerText = nazev;
                globalniRozpocet = Number(rozpocet);
                globalniPocetDniItinerar = pocetDni;
                globalniPocetDniRozpocet = pocetRozpocet;
                globalniKurzEura = Number(kurz) || 25.0;

                vygenerovatItinerar(datumOd, pocetDni);
                nacistDataItinerare(staraData); 
                
                aktualizovatFinance();
                prepniSekci('sekce-finance');
                ulozVse();
            };
        }

        const resetBtn = document.getElementById('reset-app-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('Opravdu chceš smazat úplně všechna data cesty? Tento krok nelze vzít zpět!')) {
                    localStorage.removeItem('caminoData');
                    window.location.reload();
                }
            };
        }

        const addExpBtn = document.getElementById('add-expense-btn');
        if (addExpBtn) {
            addExpBtn.onclick = () => {
                const nazev = document.getElementById('expense-name').value;
                const zadanaCastka = Number(document.getElementById('expense-amount').value);
                const kategorie = document.getElementById('expense-category').value;
                const mena = document.getElementById('expense-currency').value;

                if (!nazev || zadanaCastka <= 0) return alert('Zadejte výdaj a částku.');

                let finalniCastkaCZK = zadanaCastka;
                let textZobrazeni = `-${zadanaCastka} Kč`;

                if (mena === 'EUR') {
                    finalniCastkaCZK = Math.round(zadanaCastka * globalniKurzEura);
                    textZobrazeni = `-${finalniCastkaCZK} Kč <div style="font-size: 11px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">(${zadanaCastka} €)</div>`;
                }

                celkemUtraceno += finalniCastkaCZK;
                
                const ted = new Date();
                const novaPolozka = document.createElement('li');
                novaPolozka.innerHTML = `
                    <div style="flex-grow: 1;">
                        <strong style="font-size:15px;">${nazev}</strong> <span style="font-size:11px; background:var(--accent-light); color:var(--accent); padding:2px 6px; border-radius:4px; font-weight:600;">${kategorie}</span><br>
                        <small style="color:var(--text-muted); font-size:12px;">${ted.toLocaleDateString('cs-CZ')} v ${String(ted.getHours()).padStart(2, '0')}:${String(ted.getMinutes()).padStart(2, '0')}</small>
                    </div>
                    <div style="display:flex; align-items:center; gap: 12px;">
                        <span class="history-amount-czk" data-amount="${finalniCastkaCZK}" style="font-weight:700; color:var(--text-main); font-size:16px; text-align: right;">${textZobrazeni}</span>
                        <button class="delete-expense-btn">🗑️</button>
                    </div>
                `;
                document.getElementById('expense-list').prepend(novaPolozka);
                document.getElementById('expense-name').value = "";
                document.getElementById('expense-amount').value = "";
                
                aktualizovatFinance();
                ulozVse();
            };
        }

        const expenseList = document.getElementById('expense-list');
        if (expenseList) {
            const novyList = expenseList.cloneNode(true);
            expenseList.replaceWith(novyList);
            novyList.addEventListener('click', (e) => {
                const btn = e.target.closest('.delete-expense-btn');
                if (btn) {
                    const li = btn.closest('li');
                    const castkaSpan = li.querySelector('.history-amount-czk');
                    const castka = Number(castkaSpan.getAttribute('data-amount')) || 0;
                    
                    if(confirm('Opravdu smazat tento výdaj? Peníze se vrátí do rozpočtu.')) {
                        celkemUtraceno -= castka;
                        li.remove();
                        aktualizovatFinance();
                        ulozVse();
                    }
                }
            });
        }

        const addLinkBtn = document.getElementById('add-link-btn');
        if (addLinkBtn) {
            addLinkBtn.onclick = () => {
                const name = document.getElementById('link-name').value;
                let url = document.getElementById('link-url').value;

                if (!name || !url) return alert('Zadejte název i webový odkaz.');
                if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

                const li = document.createElement('li');
                li.innerHTML = `
                    <div style="flex-grow: 1;"><strong style="font-size:15px; color:var(--text-main);">${name}</strong></div>
                    <a href="${url}" target="_blank" class="action-btn-square" style="text-decoration:none; display:flex; align-items:center; justify-content:center; font-size:20px; width:45px; height:45px; margin-left: 10px;">🚀</a>
                `;
                document.getElementById('links-list').prepend(li);
                document.getElementById('link-name').value = "";
                document.getElementById('link-url').value = "";
                ulozVse();
            };
        }

        document.querySelectorAll('.day-tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.day-tab-btn, .day-detail').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`day-detail-${btn.dataset.dayIndex}`)?.classList.add('active');
                ulozVse();
            };
        });

        document.querySelectorAll('.edit-toggle-btn').forEach(btn => {
            btn.onclick = () => {
                const isEditing = btn.classList.toggle('editing');
                btn.innerText = isEditing ? '💾 Hotovo' : '✏️ Upravit';
                const dayDiv = btn.closest('.day-detail');
                dayDiv.querySelectorAll('input, select.hotel-currency').forEach(inp => {
                    if (isEditing) {
                        inp.classList.remove('locked');
                    } else {
                        inp.classList.add('locked');
                    }
                });
                aktualizovatFinance();
                ulozVse();
            };
        });

        document.querySelectorAll('.mapa-btn').forEach(btn => {
            btn.onclick = () => {
                const adresa = btn.previousElementSibling.value;
                if (adresa) window.open(`https://www.google.com/maps/search/?api=1&query=$${encodeURIComponent(adresa)}`, '_blank');
            };
        });

        document.querySelectorAll('.km-input').forEach(i => i.oninput = () => { aktualizovatKilometry(); ulozVse(); });
        document.querySelectorAll('.hotel-price').forEach(i => i.oninput = () => { aktualizovatFinance(); ulozVse(); });
        document.querySelectorAll('.hotel-currency').forEach(i => i.onchange = () => { aktualizovatFinance(); ulozVse(); });
        
        document.querySelectorAll('#itinerary-list input[type="text"], #itinerary-list input[type="time"]').forEach(i => {
            i.onchange = ulozVse; i.oninput = ulozVse; 
        });

        const addListBtn = document.getElementById('add-list-btn');
        if (addListBtn) {
            addListBtn.onclick = () => {
                const nazev = document.getElementById('new-list-name').value;
                if (!nazev) return;
                const karta = document.createElement('div');
                karta.className = 'checklist-card';
                karta.innerHTML = `<h2 style="margin-bottom:12px; font-size:16px;">${nazev}</h2><div class="todo-items-list" style="margin-bottom:15px;"></div><div style="display:flex; gap:8px;"><input type="text" class="item-input" placeholder="Přidat věc..." style="margin-bottom:0;"><button class="action-btn-square add-item-btn" style="background:var(--text-main);">+</button></div>`;
                document.getElementById('lists-container').appendChild(karta);
                document.getElementById('new-list-name').value = "";
                ozivitAplikaci(); 
                ulozVse();
            };
        }

        document.querySelectorAll('.checklist-card').forEach(card => {
            const addBtn = card.querySelector('.add-item-btn');
            const list = card.querySelector('.todo-items-list');
            const inp = card.querySelector('.item-input');

            if (addBtn) {
                const novyBtn = addBtn.cloneNode(true);
                addBtn.replaceWith(novyBtn);
                novyBtn.onclick = () => {
                    if (!inp.value) return;
                    const item = document.createElement('div');
                    item.className = 'todo-item';
                    item.innerHTML = `<input type="checkbox"><span style="font-size:15px;">${inp.value}</span>`;
                    list.appendChild(item);
                    inp.value = "";
                    ozivitAplikaci(); 
                    ulozVse();
                };
            }

            card.querySelectorAll('.todo-item').forEach(item => {
                const novyItem = item.cloneNode(true); 
                item.replaceWith(novyItem);
                
                const novyCb = novyItem.querySelector('input[type="checkbox"]');
                novyItem.onclick = (e) => {
                    if (e.target !== novyCb) {
                        novyItem.classList.toggle('done');
                        novyCb.checked = novyItem.classList.contains('done');
                        ulozVse();
                    }
                };
                novyCb.onchange = () => {
                    if (novyCb.checked) novyItem.classList.add('done');
                    else novyItem.classList.remove('done');
                    ulozVse();
                };
            });
        });

        const exportBtn = document.getElementById('export-pdf-btn');
        if (exportBtn) {
            exportBtn.onclick = () => {
                const tripName = document.getElementById('display-trip-name').innerText;
                const totalKm = document.getElementById('celkem-km').innerText;
                const utraceno = celkemUtraceno;
                let daysHtml = '';

                document.querySelectorAll('.day-detail').forEach((day) => {
                    const title = day.querySelector('h2').innerText;
                    const odkud = day.querySelector('input[placeholder="Start"]').value || 'Nezadáno';
                    const kam = day.querySelector('input[placeholder="Cíl"]').value || 'Nezadáno';
                    const km = day.querySelector('.km-input').value || '0';
                    const hotel = day.querySelector('input[placeholder="Hotel"]').value || 'Nezadáno';
                    
                    const cenaVal = day.querySelector('.hotel-price').value || '0';
                    const mena = day.querySelector('.hotel-currency').value === 'EUR' ? '€' : 'Kč';
                    let cenaText = cenaVal + ' ' + mena;
                    if (mena === '€' && cenaVal !== '0') cenaText += ` (${Math.round(cenaVal * globalniKurzEura)} Kč)`;

                    const notes = day.querySelectorAll('input[placeholder="Zajímavosti cestou..."]')[0].value || '-';

                    daysHtml += `
                        <div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">
                            <h3 style="color: #0284c7; margin-bottom: 8px;">${title}</h3>
                            <p><strong>Trasa:</strong> ${odkud} ➔ ${kam} (${km} km)</p>
                            <p><strong>Ubytování:</strong> ${hotel} (Cena: ${cenaText})</p>
                            <p><strong>Zážitky a poznámky:</strong> ${notes}</p>
                        </div>
                    `;
                });

                let expensesHtml = '<ul>';
                document.querySelectorAll('#expense-list li').forEach(li => {
                    const cloneLi = li.cloneNode(true);
                    if(cloneLi.querySelector('.delete-expense-btn')) cloneLi.querySelector('.delete-expense-btn').remove();
                    const cistyText = cloneLi.innerText.replace(/\n/g, ' | ');
                    expensesHtml += `<li>${cistyText}</li>`;
                });
                expensesHtml += '</ul>';

                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                    <head>
                        <title>Deník cesty: ${tripName}</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                            h1 { color: #0284c7; border-bottom: 3px solid #e0f2fe; padding-bottom: 10px; }
                            h2 { margin-top: 40px; color: #0f172a; }
                            p { margin: 5px 0; }
                            ul { line-height: 1.8; }
                        </style>
                    </head>
                    <body>
                        <h1>${tripName} 🥾</h1>
                        <p><strong>Celkem ušlapáno:</strong> ${totalKm}</p>
                        <p><strong>Kapesné utraceno za cestu:</strong> ${utraceno} Kč</p>
                        <h2>Můj Itinerář a Deník</h2>
                        ${daysHtml}
                        <h2>Historie výdajů</h2>
                        ${expensesHtml.length > 9 ? expensesHtml : '<p>Žádné výdaje nebyly zapsány.</p>'}
                    </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => { printWindow.print(); }, 500);
            };
        }
    }

    function vygenerovatItinerar(startDatumStr, pocetDni) {
        const tabsContainer = document.getElementById('day-tabs');
        const listContainer = document.getElementById('itinerary-list');
        tabsContainer.innerHTML = ""; listContainer.innerHTML = ""; 

        const fThereNo = document.getElementById('flight-there-no')?.value || '';
        const fThereRoute = document.getElementById('flight-there-route')?.value || '';
        const fThereTime = document.getElementById('flight-there-time')?.value || '';
        const fThereArr = document.getElementById('flight-there-arrival')?.value || '';
        const fTherePnr = document.getElementById('flight-there-pnr')?.value || '';
        const fThereTicket = document.getElementById('flight-there-ticket')?.value || '';

        const fBackNo = document.getElementById('flight-back-no')?.value || '';
        const fBackRoute = document.getElementById('flight-back-route')?.value || '';
        const fBackTime = document.getElementById('flight-back-time')?.value || '';
        const fBackArr = document.getElementById('flight-back-arrival')?.value || '';
        const fBackPnr = document.getElementById('flight-back-pnr')?.value || '';
        const fBackTicket = document.getElementById('flight-back-ticket')?.value || '';

        for (let i = 0; i < pocetDni; i++) {
            const datum = new Date(startDatumStr);
            datum.setDate(datum.getDate() + i);
            const datumText = datum.toLocaleDateString('cs-CZ');

            const tabBtn = document.createElement('button');
            tabBtn.className = 'day-tab-btn' + (i === 0 ? ' active' : '');
            tabBtn.innerText = `Den ${i + 1}`;
            tabBtn.dataset.dayIndex = i;
            tabsContainer.appendChild(tabBtn);

            let letyHtml = "";
            if (i === 0 && (fThereNo || fThereRoute || fThereTime)) {
                let odkaz = fThereTicket ? `<a href="${fThereTicket.startsWith('http') ? fThereTicket : 'https://'+fThereTicket}" class="ticket-link" target="_blank">🔗 Letenka</a>` : '';
                letyHtml += `<div class="flight-badge-card"><h3 style="color:var(--accent); margin-bottom:5px;">🛫 Odlet tam</h3><div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">${fThereNo || 'Let'}</span><span style="font-weight:600;">${fThereTime || '--:--'} ➔ ${fThereArr || '--:--'}</span></div><p style="font-size:13px; color:var(--text-muted); margin-top:4px;">Trasa: ${fThereRoute || '-'} | PNR: <strong style="color:var(--text-main);">${fTherePnr || '-'}</strong></p>${odkaz}</div>`;
            }
            if (i === (pocetDni - 1) && (fBackNo || fBackRoute || fBackTime)) {
                let odkaz = fBackTicket ? `<a href="${fBackTicket.startsWith('http') ? fBackTicket : 'https://'+fBackTicket}" class="ticket-link" target="_blank">🔗 Letenka</a>` : '';
                letyHtml += `<div class="flight-badge-card back"><h3 style="color:var(--accent-yellow-dark); margin-bottom:5px;">🛬 Let zpět</h3><div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">${fBackNo || 'Let'}</span><span style="font-weight:600;">${fBackTime || '--:--'} ➔ ${fBackArr || '--:--'}</span></div><p style="font-size:13px; color:var(--text-muted); margin-top:4px;">Trasa: ${fBackRoute || '-'} | PNR: <strong style="color:var(--text-main);">${fBackPnr || '-'}</strong></p>${odkaz}</div>`;
            }

            const dayDetail = document.createElement('div');
            dayDetail.className = 'day-detail' + (i === 0 ? ' active' : '');
            dayDetail.id = `day-detail-${i}`;

            dayDetail.innerHTML = `
                <div class="card" style="text-align: left;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px;">
                        <h2 style="margin: 0;">Den ${i + 1} <span style="font-size: 13px; color: var(--text-muted); font-weight: normal;">${datumText}</span></h2>
                        <button class="edit-toggle-btn">✏️ Upravit</button>
                    </div>
                    ${letyHtml}
                    <h3>Trasa a Vzdálenost</h3>
                    <div class="form-row"><div class="form-group"><label>Odkud jdu</label><input type="text" placeholder="Start" class="locked"></div><div class="form-group"><label>Kam jdu</label><input type="text" placeholder="Cíl" class="locked"></div></div>
                    <div class="form-row"><div class="form-group"><label>Dnešní porce (km)</label><input type="number" class="km-input locked" placeholder="Např. 25"></div><div class="form-group"></div></div>
                    
                    <h3 style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--border-color);">🏨 Ubytování</h3>
                    <div class="form-row">
                        <div class="form-group"><label>Název / Kontakt</label><input type="text" placeholder="Hotel" class="locked"></div>
                        <div class="form-group">
                            <label>Cena za noc</label>
                            <div style="display: flex; gap: 4px;">
                                <input type="number" placeholder="Částka" class="hotel-price locked" style="margin-bottom: 0;">
                                <select class="hotel-currency locked" style="margin-bottom: 0; width: 70px; padding: 14px 5px; text-align: center;">
                                    <option value="CZK">Kč</option>
                                    <option value="EUR">€</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="form-row"><div class="form-group"><label>Do kdy dorazit</label><input type="time" class="locked"></div><div class="form-group"><label>Adresa</label><div class="address-box"><input type="text" class="adresa-input locked" placeholder="Město"><button class="mapa-btn">🗺️</button></div></div></div>
                    <div class="form-row"><div class="form-group"><label>Poznámka</label><input type="text" placeholder="Kód od dveří..." class="locked"></div></div>
                    
                    <h3 style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--border-color);">📝 Plán / Poznámky</h3>
                    <div class="form-row"><div class="form-group"><input type="text" placeholder="Zajímavosti cestou..." class="locked"></div></div>
                </div>
            `;
            listContainer.appendChild(dayDetail);
        }
        ozivitAplikaci(); 
    }

    nactiVse();
});