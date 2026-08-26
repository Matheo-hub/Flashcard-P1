// --- BASE DE DONNÉES (Dossiers, Import/Export, Âge des cartes) ---
let db = JSON.parse(localStorage.getItem('flashcards_db')) || { folders: [] };
let currentFolderId = null;
let currentImageBase64 = null;

// Variables pour le mode Révision
let reviewQueue = [];
let currentQueueIndex = 0;
let cardsReviewedCount = 0;
let reviewMode = 'global'; // 'global' ou 'folder'

let touchStartX = 0;
let touchEndX = 0;

// --- NAVIGATION ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    const btnBack = document.getElementById('btn-back');
    const btnImport = document.getElementById('btn-stats');
    
    if (viewId === 'view-home') {
        btnBack.style.display = 'none';
        btnImport.style.display = 'block';
        renderFolders();
    } else {
        btnBack.style.display = 'block';
        btnImport.style.display = 'none';
    }
}

function goBack() {
    if (document.getElementById('view-create').classList.contains('active') || document.getElementById('view-review').classList.contains('active')) {
        if (currentFolderId) switchView('view-folder');
        else switchView('view-home');
    } else if (document.getElementById('view-folder').classList.contains('active')) {
        currentFolderId = null;
        switchView('view-home');
    }
}

// --- GESTION DES DOSSIERS ---
function createFolder() {
    const name = prompt("Nom du nouveau dossier :");
    if (name) {
        db.folders.push({ id: Date.now(), name: name, cards: [] });
        saveDB();
        renderFolders();
    }
}

function renderFolders() {
    const list = document.getElementById('folders-list');
    list.innerHTML = '';
    
    db.folders.forEach(folder => {
        let totalTries = 0;
        let totalCorrect = 0;
        folder.cards.forEach(c => {
            totalTries += (c.correct + c.wrong);
            totalCorrect += c.correct;
        });
        const successRate = totalTries > 0 ? Math.round((totalCorrect / totalTries) * 100) : 0;

        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <div class="item-info" onclick="openFolder(${folder.id})">
                <h4>${folder.name}</h4>
                <div class="item-stats">${folder.cards.length} cartes | Réussite : ${successRate}%</div>
            </div>
            <button class="btn-delete" onclick="deleteFolder(${folder.id}, event)">🗑️</button>
        `;
        list.appendChild(el);
    });
}

function openFolder(id) {
    currentFolderId = id;
    renderCards();
    switchView('view-folder');
}

function deleteFolder(id, event) {
    event.stopPropagation();
    if (confirm("Supprimer ce dossier et toutes ses cartes ?")) {
        db.folders = db.folders.filter(f => f.id !== id);
        saveDB();
        renderFolders();
    }
}

// --- GESTION DES CARTES ---
function showCreateView() {
    document.getElementById('card-image-input').value = "";
    document.getElementById('card-q-input').value = "";
    document.getElementById('card-a-input').value = "";
    currentImageBase64 = null;
    switchView('view-create');
}

document.getElementById('card-image-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) { currentImageBase64 = event.target.result; };
        reader.readAsDataURL(file);
    }
});

function saveCard() {
    const q = document.getElementById('card-q-input').value.trim();
    const a = document.getElementById('card-a-input').value.trim();
    
    if (!q && !currentImageBase64) {
        alert("Il faut au moins une question ou une image !");
        return;
    }

    const newCard = {
        id: Date.now(),
        createdAt: Date.now(), // Age de la carte
        q: q,
        a: a,
        img: currentImageBase64,
        correct: 0,
        wrong: 0
    };

    const folder = db.folders.find(f => f.id === currentFolderId);
    folder.cards.push(newCard);
    saveDB();
    openFolder(currentFolderId);
}

function renderCards() {
    const folder = db.folders.find(f => f.id === currentFolderId);
    document.getElementById('current-folder-title').innerText = folder.name;
    const list = document.getElementById('cards-list');
    list.innerHTML = '';
    
    folder.cards.forEach(card => {
        const ageDays = Math.floor((Date.now() - card.createdAt) / (1000 * 60 * 60 * 24));
        const total = card.correct + card.wrong;
        const rate = total > 0 ? Math.round((card.correct / total) * 100) : 0;
        
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <div class="item-info">
                <h4>${card.q.substring(0, 30) || 'Image...'}</h4>
                <div class="item-stats">Âge: ${ageDays}j | Vues: ${total} | Réussite: ${rate}%</div>
            </div>
            <button class="btn-delete" onclick="deleteCard(${card.id})">🗑️</button>
        `;
        list.appendChild(el);
    });
}

function deleteCard(cardId) {
    if (confirm("Supprimer cette carte ?")) {
        const folder = db.folders.find(f => f.id === currentFolderId);
        folder.cards = folder.cards.filter(c => c.id !== cardId);
        saveDB();
        renderCards();
    }
}

// --- IMPORT / EXPORT JSON ---
function saveDB() {
    localStorage.setItem('flashcards_db', JSON.stringify(db));
}

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "flashcards_backup.json");
    dlAnchorElem.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedDB = JSON.parse(e.target.result);
                if (importedDB && importedDB.folders) {
                    
                    // On parcourt les dossiers importés pour les ajouter
                    importedDB.folders.forEach(importedFolder => {
                        // On génère de nouveaux ID pour éviter les bugs
                        importedFolder.id = Date.now() + Math.random(); 
                        importedFolder.cards.forEach(card => card.id = Date.now() + Math.random());
                        
                        // On ajoute le dossier à ta base de données actuelle
                        db.folders.push(importedFolder);
                    });
                    
                    saveDB();
                    renderFolders();
                    alert("Les cartes ont été ajoutées avec succès à tes dossiers !");
                }
            } catch (err) {
                alert("Erreur lors de l'importation. Fichier invalide.");
            }
        };
        reader.readAsText(file);
    }
}

// --- MOTEUR DE RÉVISION (Boucle Infinie) ---
function startReview(mode) {
    reviewMode = mode;
    let cardsToReview = [];

    if (mode === 'global') {
        db.folders.forEach(f => cardsToReview.push(...f.cards));
    } else {
        const folder = db.folders.find(f => f.id === currentFolderId);
        cardsToReview = [...folder.cards];
    }

    if (cardsToReview.length === 0) {
        alert("Il n'y a aucune carte à réviser ici !");
        return;
    }

    // Mélange initial
    reviewQueue = cardsToReview.sort(() => Math.random() - 0.5);
    currentQueueIndex = 0;
    cardsReviewedCount = 0;
    
    switchView('view-review');
    loadCardToUI();
}

function loadCardToUI() {
    document.getElementById('review-progress').innerText = `Cartes vues (session) : ${cardsReviewedCount}`;
    
    const cardData = reviewQueue[currentQueueIndex];
    const fc = document.getElementById('flashcard');
    const controls = document.getElementById('review-controls');
    
    fc.classList.remove('is-flipped', 'swipe-right-preview', 'swipe-left-preview');
    controls.classList.remove('visible');
    fc.style.transform = '';

    // Recto
    document.getElementById('view-q-text').innerText = cardData.q;
    const imgEl = document.getElementById('view-q-img');
    if (cardData.img) {
        imgEl.src = cardData.img;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }

    // Verso
    document.getElementById('view-q-reminder').innerText = cardData.q ? "Q: " + cardData.q : "Q: [Image]";
    document.getElementById('view-a-text').innerText = cardData.a;
}

// Retourner la carte
document.getElementById('flashcard').addEventListener('click', function() {
    if (!this.classList.contains('is-flipped')) {
        this.classList.add('is-flipped');
        document.getElementById('review-controls').classList.add('visible');
    }
});

// Validation
function handleAnswer(isCorrect) {
    const currentCard = reviewQueue[currentQueueIndex];
    
    // Trouver la vraie carte dans la base de données pour mettre à jour les stats
    let realCard = null;
    db.folders.forEach(f => {
        const found = f.cards.find(c => c.id === currentCard.id);
        if(found) realCard = found;
    });

    if (realCard) {
        if (isCorrect) {
            realCard.correct++;
        } else {
            realCard.wrong++;
            // Insérer une copie de cette carte 5 positions plus loin !
            const insertIndex = currentQueueIndex + 5;
            reviewQueue.splice(insertIndex, 0, currentCard); 
        }
        saveDB(); // Sauvegarde en temps réel
    }

    cardsReviewedCount++;
    currentQueueIndex++;
    
    // Boucle infinie : si on arrive à la fin, on remet toutes les cartes
    if (currentQueueIndex >= reviewQueue.length) {
        let pool = [];
        if (reviewMode === 'global') {
            db.folders.forEach(f => pool.push(...f.cards));
        } else {
            const folder = db.folders.find(f => f.id === currentFolderId);
            pool = [...folder.cards];
        }
        reviewQueue = reviewQueue.concat(pool.sort(() => Math.random() - 0.5));
    }

    // Animation de transition
    const fc = document.getElementById('flashcard');
    fc.style.transform = isCorrect ? 'translateX(100vw) rotateY(180deg)' : 'translateX(-100vw) rotateY(180deg)';
    
    setTimeout(() => {
        loadCardToUI();
    }, 300);
}

// --- SWIPE TACTILE ---
const flashcard = document.getElementById('flashcard');

flashcard.addEventListener('touchstart', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    touchStartX = e.changedTouches[0].screenX;
});

flashcard.addEventListener('touchmove', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    const currentX = e.changedTouches[0].screenX;
    const diff = currentX - touchStartX;
    
    flashcard.style.transform = `rotateY(180deg) translateX(${diff}px) rotateZ(${diff * 0.05}deg)`;
    
    if (diff > 50) {
        flashcard.classList.add('swipe-right-preview');
        flashcard.classList.remove('swipe-left-preview');
    } else if (diff < -50) {
        flashcard.classList.add('swipe-left-preview');
        flashcard.classList.remove('swipe-right-preview');
    } else {
        flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview');
    }
});

flashcard.addEventListener('touchend', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;

    flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview');

    if (diff > 100) {
        handleAnswer(true);
    } else if (diff < -100) {
        handleAnswer(false);
    } else {
        flashcard.style.transform = 'rotateY(180deg)';
    }
});

// Init
renderFolders();
