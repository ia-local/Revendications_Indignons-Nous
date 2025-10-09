// score-vote.js

// Clé de stockage local pour le score de l'utilisateur
const USER_SCORE_KEY = 'user_revendication_scores';
// Nombre total de revendications (utilisé pour déterminer le total des points disponibles)
const TOTAL_REVENDICATIONS = 361; 

// Les variables d'état sont rendues globales via window pour l'accès depuis le Dashboard
window.userScores = {}; // { 'revendication-id': score_attribué }
window.pointsAvailable = 0;
window.totalPointsMax = 0;

// Variables de contrôle DOM (locales)
let scoreInput;
let scoreMessage;

/**
 * Charge les scores de l'utilisateur depuis le stockage local (ou les initialise).
 */
function loadUserScores() {
    try {
        const storedScores = localStorage.getItem(USER_SCORE_KEY);
        window.userScores = storedScores ? JSON.parse(storedScores) : {};
    } catch (e) {
        console.error("Erreur de chargement LocalStorage:", e);
        window.userScores = {};
    }

    // Calculer le total des points disponibles
    window.totalPointsMax = TOTAL_REVENDICATIONS;
    const pointsUsed = Object.values(window.userScores).reduce((sum, score) => sum + score, 0);
    window.pointsAvailable = window.totalPointsMax - pointsUsed;
}

/**
 * Sauvegarde les scores de l'utilisateur dans le stockage local.
 */
function saveUserScores() {
    try {
        localStorage.setItem(USER_SCORE_KEY, JSON.stringify(window.userScores));
    } catch (e) {
        console.error("Erreur de sauvegarde LocalStorage:", e);
    }
}

/**
 * Initialise l'interface de contrôle de score et de vote simple pour une revendication donnée.
 * Cette fonction est rendue globale pour être appelée par modal.js
 */
window.initializeScoreControls = function(itemId, sectionTitre) {
    
    loadUserScores(); 

    const voteScoreDiv = document.getElementById('vote-score-controls');
    
    // Récupérer les données de vote simple actuelles pour cet item (pour l'affichage)
    const itemData = findItemDataGlobally(itemId);
    const votes = itemData ? itemData.votes : { oui: 0, non: 0, abstention: 0 };
    const ricType = itemData ? itemData.ric_type : 'Législatif';

    const currentScore = window.userScores[itemId] || 0;
    const scoreRangeMax = window.pointsAvailable + currentScore; 

    // CALCUL DU POURCENTAGE DE VOTE SIMPLE
    const totalVotesSimple = votes.oui + votes.non + votes.abstention;
    const votePercentage = (value) => totalVotesSimple > 0 ? ((value / totalVotesSimple) * 100).toFixed(1) : 0;
    
    // Création de la barre de progression HTML
    const progressBar = `
        <div class="vote-progress-bar">
            <div class="progress-segment" style="width: ${votePercentage(votes.oui)}%; background-color: var(--color-success);"></div>
            <div class="progress-segment" style="width: ${votePercentage(votes.non)}%; background-color: var(--color-danger);"></div>
            <div class="progress-segment" style="width: ${votePercentage(votes.abstention)}%; background-color: var(--color-warning);"></div>
        </div>
    `;


    voteScoreDiv.innerHTML = `
        <h3 class="ia-title ric-status">Action requise (Type de RIC) : <strong>${ricType}</strong></h3>
        
        <!-- FORMULAIRE DE VOTE RIC SIMPLE (OUI/NON/ABSTENTION) -->
        <div class="ric-simple-vote-area">
            <h4>1. Vote Simple (Engagement Citoyen)</h4>
            <div class="vote-summary-row">
                <span class="total-votes-count">Total des votes : ${totalVotesSimple}</span>
                <span class="ric-description">Votez Oui/Non/Abstention pour ce projet.</span>
            </div>

            ${progressBar}

            <div class="vote-details">
                <span style="color: var(--color-success);">OUI: ${votes.oui} (${votePercentage(votes.oui)}%)</span>
                <span style="color: var(--color-danger);">NON: ${votes.non} (${votePercentage(votes.non)}%)</span>
                <span style="color: var(--color-warning);">ABSTENTION: ${votes.abstention} (${votePercentage(votes.abstention)}%)</span>
            </div>

            <div class="vote-actions" data-item-id="${itemId}" id="simple-vote-buttons">
                <button class="vote-btn vote-oui" data-vote-type="oui">Voter OUI</button>
                <button class="vote-btn vote-non" data-vote-type="non">Voter NON</button>
                <button class="vote-btn vote-abstention" data-vote-type="abstention">Abstention</button>
            </div>
            <p id="simple-vote-message" class="info-message"></p>
        </div>
        
        <!-- FORMULAIRE DE SCORE DE PRIORISATION -->
        <div class="score-priorization-area">
            <h4>2. Score de Priorisation (Répartition des Points)</h4>
            <div class="score-summary">
                <p>Points Totaux: <strong>${window.totalPointsMax}</strong> | Points Utilisés: <strong>${window.totalPointsMax - window.pointsAvailable}</strong></p>
                <p class="score-available">Points Restants à attribuer: <strong>${window.pointsAvailable}</strong></p>
            </div>
            
            <div class="score-control-area">
                <label for="score-input-${itemId}">Points attribués:</label>
                <input type="range" 
                       id="score-input-${itemId}" 
                       min="0" 
                       max="${scoreRangeMax}" 
                       value="${currentScore}" 
                       class="score-slider">
                <output for="score-input-${itemId}" id="score-value-${itemId}" class="score-output">${currentScore}</output>
                <button id="submit-score-btn" class="action-btn score-submit-btn" data-item-id="${itemId}">Soumettre le Score</button>
            </div>
            <p id="score-message" class="info-message"></p>
        </div>
    `;

    // Attacher les écouteurs pour le Score (Points)
    scoreInput = document.getElementById(`score-input-${itemId}`);
    const scoreValueDOM = document.getElementById(`score-value-${itemId}`);
    scoreMessage = document.getElementById('score-message');
    
    scoreInput.addEventListener('input', (e) => {
        scoreValueDOM.textContent = e.target.value;
        scoreMessage.textContent = ''; 
    });
    document.getElementById('submit-score-btn').addEventListener('click', handleSubmitScore);
    
    // Attacher les écouteurs pour le Vote Simple RIC
    document.querySelectorAll('#simple-vote-buttons .vote-btn').forEach(btn => {
        btn.addEventListener('click', handleSimpleRicVote);
    });
}

/**
 * Fonction utilitaire pour trouver les données d'un item à partir des données globales.
 * @param {string} itemId ID de l'item à chercher.
 * @returns {object | null} Les données de l'item.
 */
function findItemDataGlobally(itemId) {
    if (!window.allData) return null;
    for (const categoryKey in window.allData) {
        const item = window.allData[categoryKey].find(item => item.id === itemId);
        if (item) return item;
    }
    return null;
}

// --- LOGIQUE DE VOTE SIMPLE RIC (OUI/NON/ABSTENTION) ---

async function handleSimpleRicVote(e) {
    e.preventDefault();
    const voteType = e.target.dataset.voteType;
    const itemId = e.target.closest('.vote-actions').dataset.itemId;
    const messageElement = document.getElementById('simple-vote-message');
    
    try {
        messageElement.textContent = `Enregistrement du vote '${voteType.toUpperCase()}'...`;
        messageElement.classList.remove('error-message');

        const response = await fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: itemId, voteType: voteType })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Mise à jour de l'affichage local immédiatement
            const itemData = findItemDataGlobally(itemId);
            if (itemData) {
                itemData.votes = data.new_votes; // Mise à jour de la source de données locale
            }
            initializeScoreControls(itemId); // Rafraîchir l'interface
            
            messageElement.textContent = `Vote '${voteType.toUpperCase()}' enregistré avec succès ! Total: ${data.total_votes}`;
            
            // Rafraîchir les cartes dans la vue principale pour mettre à jour les totaux
            if (window.renderRevendicationsView) {
                window.renderRevendicationsView();
            }
        } else {
            messageElement.textContent = `Erreur lors du vote: ${data.error || 'Erreur inconnue.'}`;
            messageElement.classList.add('error-message');
        }

    } catch (error) {
        console.error("Erreur d'enregistrement du vote:", error);
        messageElement.textContent = "Erreur de connexion au serveur de vote simple.";
        messageElement.classList.add('error-message');
    }
}

// --- LOGIQUE DE VOTE PAR SCORE (PRIORISATION) ---

/**
 * Gère l'envoi du score à l'API ou la sauvegarde locale.
 */
async function handleSubmitScore(e) {
    const itemId = e.target.dataset.itemId;
    if (!itemId) return;

    const newScore = parseInt(scoreInput.value);
    const oldScore = window.userScores[itemId] || 0;
    const scoreChange = newScore - oldScore;

    if (scoreChange === 0) {
        scoreMessage.textContent = "Aucun changement détecté.";
        return;
    }

    // 1. Mise à jour locale
    window.userScores[itemId] = newScore;
    saveUserScores();
    
    // 2. Mise à jour de l'état des points disponibles dans la modale
    loadUserScores(); 
    initializeScoreControls(itemId); // Rafraîchit l'UI avec les nouveaux totaux
    
    scoreMessage.textContent = `Score local mis à jour. Points restants: ${window.pointsAvailable}.`;

    // 3. Tentative d'envoi à l'API (pour le mode Serveur)
    try {
        const response = await fetch('/api/vote-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: itemId,
                scoreChange: scoreChange
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            scoreMessage.textContent = `Score soumis (API OK). L'impact du vote est pris en compte.`;
            
            // Mise à jour de la source de données globale
            const itemData = findItemDataGlobally(itemId);
            if (itemData) {
                 itemData.totalScore = data.new_item_score;
            }

            // Recharger les cartes principales pour mettre à jour la priorité
            if (typeof initialize === 'function') {
                initialize(); 
            }
        } else {
            scoreMessage.textContent += " (Mode Statique ou API échouée. Score stocké localement.)";
        }

    } catch (error) {
        scoreMessage.textContent += " (Connexion API impossible. Score stocké localement.)";
        console.warn("Échec d'envoi du score à l'API:", error);
    }
}

document.addEventListener('DOMContentLoaded', loadUserScores);
