let db = JSON.parse(localStorage.getItem('flashcards_db_v2')) || { folders: [] };
let currentImageBase64 = null;

// Variables Mode Révision
let reviewQueue = [];
let currentQueueIndex = 0;
let cardsReviewedCount = 0;
let touchStartX = 0;

// --- NAVIGATION ---
function switchTab(tabId, element) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Mettre à jour les données affichées selon l'onglet
    if (tabId === 'tab-accueil' || tabId === 'tab-creer') updateDropdowns();
    if (tabId === 'tab-dossiers') renderFoldersList();
}

// --- GESTION DOSSIERS ---
function createFolder() {
    const name = prompt("Nom du nouveau dossier :");
    if (name && name.trim() !== "") {
        db.folders.push({ id: Date.now(), name: name.trim(), cards: [], expanded: false });
        saveDB();
        renderFoldersList();
    }
}

function renderFoldersList() {
    const container = document.getElementById('folders-container');
    container.innerHTML = '';
    
    if (db.folders.length === 0) {
        container.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center;">Aucun dossier créé.</div>';
        return;
    }

    db.folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        
        // En-tête du dossier
        const header = document.createElement('div');
        header.className = 'folder-item';
        header.innerHTML = `
            <div class="folder-info">
                <span class="folder-icon">📁</span> ${folder.name} (${folder.cards.length})
            </div>
            <div class="folder-action" onclick="deleteFolder(${folder.id}, event)">Supprimer</div>
        `;
        header.onclick = () => {
            folder.expanded = !folder.expanded;
            renderFoldersList();
        };
        folderDiv.appendChild(header);

        // Contenu du dossier (Cartes)
        if (folder.expanded) {
            if (folder.cards.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'card-item';
                empty.innerText = "Dossier vide.";
                folderDiv.appendChild(empty);
            } else {
                folder.cards.forEach(card => {
                    const cardItem = document.createElement('div');
                    cardItem.className = 'card-item';
                    cardItem.innerHTML = `
                        <span>${card.q.substring(0, 30) || 'Image...'}</span>
                        <span class="folder-action" style="font-size:0.8rem; cursor:pointer;" onclick="deleteCard(${folder.id}, ${card.id}, event)">✕</span>
                    `;
                    folderDiv.appendChild(cardItem);
                });
            }
        }
        container.appendChild(folderDiv);
    });
}

function updateDropdowns() {
    const selectSession = document.getElementById('select-session-folder');
    const selectCreate = document.getElementById('select-create-folder');
    
    // Garder l'option "Global" pour la session
    selectSession.innerHTML = '<option value="global">Toutes les matières (Mélange général)</option>';
    selectCreate.innerHTML = '';

    db.folders.forEach(f => {
        selectSession.innerHTML += `<option value="${f.id}">${f.name}</option>`;
        selectCreate.innerHTML += `<option value="${f.id}">${f.name}</option>`;
    });
}

function deleteFolder(id, event) {
    event.stopPropagation();
    if (confirm("Supprimer ce dossier et toutes ses cartes ?")) {
        db.folders = db.folders.filter(f => f.id !== id);
        saveDB();
        renderFoldersList();
    }
}

function deleteCard(folderId, cardId, event) {
    event.stopPropagation();
    if (confirm("Supprimer cette carte ?")) {
        const folder = db.folders.find(f => f.id === folderId);
        folder.cards = folder.cards.filter(c => c.id !== cardId);
        saveDB();
        renderFoldersList();
    }
}

// --- CRÉATION DE CARTES ---
document.getElementById('card-image-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) { currentImageBase64 = event.target.result; };
        reader.readAsDataURL(file);
    }
});

function saveManualCard() {
    const folderId = document.getElementById('select-create-folder').value;
    if (!folderId) return alert("Créez d'abord un dossier !");

    const q = document.getElementById('card-q-input').value.trim();
    const a = document.getElementById('card-a-input').value.trim();
    
    if (!q && !currentImageBase64) return alert("Il faut une question ou une image !");
    if (!a) return alert("Il faut une réponse !");

    const folder = db.folders.find(f => f.id == folderId);
    folder.cards.push({ id: Date.now(), q: q, a: a, img: currentImageBase64, correct: 0, wrong: 0 });
    saveDB();
    
    document.getElementById('card-q-input').value = "";
    document.getElementById('card-a-input').value = "";
    document.getElementById('card-image-input').value = "";
    currentImageBase64 = null;
    alert("Flashcard ajoutée !");
}

function saveExpressCards() {
    const folderId = document.getElementById('select-create-folder').value;
    if (!folderId) return alert("Créez d'abord un dossier !");

    const text = document.getElementById('express-textarea').value.trim();
    if (!text) return alert("Le champ est vide !");

    const lines = text.split('\n');
    let addedCount = 0;
    const folder = db.folders.find(f => f.id == folderId);

    lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 2) {
            const q = parts[0].trim();
            const a = parts.slice(1).join('|').trim();
            if (q && a) {
                folder.cards.push({ id: Date.now() + Math.random(), q: q, a: a, img: null, correct: 0, wrong: 0 });
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        saveDB();
        document.getElementById('express-textarea').value = "";
        alert(`${addedCount} cartes ajoutées avec succès !`);
    } else {
        alert("Format invalide. Utilise bien le séparateur '|'.");
    }
}

// --- IMPORT / EXPORT / RESET ---
function saveDB() { localStorage.setItem('flashcards_db_v2', JSON.stringify(db)); }

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "flashcards_backup.json");
    dl.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedDB = JSON.parse(e.target.result);
                if (importedDB && importedDB.folders) {
                    importedDB.folders.forEach(f => {
                        f.id = Date.now() + Math.random(); 
                        f.cards.forEach(c => c.id = Date.now() + Math.random());
                        db.folders.push(f);
                    });
                    saveDB();
                    alert("Cartes importées avec succès !");
                }
            } catch (err) { alert("Fichier invalide."); }
        };
        reader.readAsText(file);
    }
}

function resetData() {
    if (confirm("⚠️ ATTENTION : Cela va effacer TOUTES tes cartes et dossiers. Continuer ?")) {
        db = { folders: [] };
        saveDB();
        alert("Toutes les données ont été effacées.");
        switchTab('tab-accueil', document.querySelectorAll('.tab-item')[0]);
    }
}

// --- MOTEUR DE RÉVISION (Boucle Infinie & Swipe) ---
function startSession() {
    const targetId = document.getElementById('select-session-folder').value;
    let cardsToReview = [];
    
    if (targetId === 'global') {
        db.folders.forEach(f => cardsToReview.push(...f.cards));
    } else {
        const folder = db.folders.find(f => f.id == targetId);
        if(folder) cardsToReview = [...folder.cards];
    }

    if (cardsToReview.length === 0) return alert("Aucune carte à réviser dans cette sélection !");

    reviewQueue = cardsToReview.sort(() => Math.random() - 0.5);
    currentQueueIndex = 0;
    cardsReviewedCount = 0;
    
    document.getElementById('view-review').classList.add('active');
    loadCardToUI();
}

function closeReview() {
    document.getElementById('view-review').classList.remove('active');
}

function loadCardToUI() {
    document.getElementById('review-progress').innerText = `Vues : ${cardsReviewedCount}`;
    const cardData = reviewQueue[currentQueueIndex];
    const fc = document.getElementById('flashcard');
    
    fc.classList.remove('is-flipped', 'swipe-right-preview', 'swipe-left-preview');
    document.getElementById('review-controls').classList.remove('visible');
    fc.style.transform = '';

    document.getElementById('view-q-text').innerText = cardData.q;
    const imgEl = document.getElementById('view-q-img');
    if (cardData.img) { imgEl.src = cardData.img; imgEl.style.display = 'block'; } 
    else { imgEl.style.display = 'none'; }

    document.getElementById('view-q-reminder').innerText = cardData.q ? "Q: " + cardData.q : "Q: [Image]";
    document.getElementById('view-a-text').innerText = cardData.a;
}

document.getElementById('flashcard').addEventListener('click', function() {
    if (!this.classList.contains('is-flipped')) {
        this.classList.add('is-flipped');
        document.getElementById('review-controls').classList.add('visible');
    }
});

function handleAnswer(isCorrect) {
    const currentCard = reviewQueue[currentQueueIndex];
    
    // Mise à jour stat et gestion de l'erreur (revient 5 cartes plus tard)
    let realCard = null;
    db.folders.forEach(f => {
        const found = f.cards.find(c => c.id === currentCard.id);
        if(found) realCard = found;
    });

    if (realCard) {
        if (isCorrect) realCard.correct++;
        else {
            realCard.wrong++;
            reviewQueue.splice(currentQueueIndex + 5, 0, currentCard);
        }
        saveDB();
    }

    cardsReviewedCount++;
    currentQueueIndex++;
    
    // Si on arrive au bout, on recharge le paquet complet mélangé (Boucle infinie)
    if (currentQueueIndex >= reviewQueue.length) {
        const targetId = document.getElementById('select-session-folder').value;
        let pool = [];
        if (targetId === 'global') db.folders.forEach(f => pool.push(...f.cards));
        else pool = [...db.folders.find(f => f.id == targetId).cards];
        reviewQueue = reviewQueue.concat(pool.sort(() => Math.random() - 0.5));
    }

    const fc = document.getElementById('flashcard');
    fc.style.transform = isCorrect ? 'translateX(100vw) rotateY(180deg)' : 'translateX(-100vw) rotateY(180deg)';
    setTimeout(loadCardToUI, 300);
}

// Gestion Tactile Swipe
const flashcard = document.getElementById('flashcard');
flashcard.addEventListener('touchstart', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    touchStartX = e.changedTouches[0].screenX;
});
flashcard.addEventListener('touchmove', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    flashcard.style.transform = `rotateY(180deg) translateX(${diff}px) rotateZ(${diff * 0.05}deg)`;
    
    if (diff > 50) { flashcard.classList.add('swipe-right-preview'); flashcard.classList.remove('swipe-left-preview'); }
    else if (diff < -50) { flashcard.classList.add('swipe-left-preview'); flashcard.classList.remove('swipe-right-preview'); }
    else flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview');
});
flashcard.addEventListener('touchend', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview');
    if (diff > 100) handleAnswer(true);
    else if (diff < -100) handleAnswer(false);
    else flashcard.style.transform = 'rotateY(180deg)';
});

// Initialisation au lancement
updateDropdowns();
renderFoldersList();
