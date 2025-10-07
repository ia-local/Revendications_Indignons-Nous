// score-vote.js

// Clé de stockage local pour le score de l'utilisateur
const USER_SCORE_KEY = 'user_revendication_scores';
// Nombre total de revendications (utilisé pour déterminer le total des points disponibles)
const TOTAL_REVENDICATIONS = 361; 

let userScores = {}; // { 'revendication-id': score_attribué }
let pointsAvailable = 0;
let totalPointsMax = 0;
let currentItemId = null; 

let voteScoreDiv;
let scoreInput;
let scoreMessage;

/**
 * Charge les scores de l'utilisateur depuis le stockage local (ou les initialise).
 */
function loadUserScores() {
    try {
        const storedScores = localStorage.getItem(USER_SCORE_KEY);
        userScores = storedScores ? JSON.parse(storedScores) : {};
    } catch (e) {
        console.error("Erreur de chargement LocalStorage:", e);
        userScores = {};
    }

    // Calculer le total des points disponibles
    totalPointsMax = TOTAL_REVENDICATIONS;
    const pointsUsed = Object.values(userScores).reduce((sum, score) => sum + score, 0);
    pointsAvailable = totalPointsMax - pointsUsed;
}

/**
 * Sauvegarde les scores de l'utilisateur dans le stockage local.
 */
function saveUserScores() {
    try {
        localStorage.setItem(USER_SCORE_KEY, JSON.stringify(userScores));
    } catch (e) {
        console.error("Erreur de sauvegarde LocalStorage:", e);
    }
}

/**
 * Initialise l'interface de contrôle de score pour une revendication donnée.
 */
function initializeScoreControls(itemId, sectionTitre) {
    currentItemId = itemId;
    loadUserScores();

    voteScoreDiv = document.getElementById('vote-score-controls');

    const currentScore = userScores[itemId] || 0;
    // La limite max est (points_restants + score_déjà_attribué)
    const scoreRangeMax = pointsAvailable + currentScore; 

    voteScoreDiv.innerHTML = `
        <h3 class="ia-title score-status">Système de Vote par Points (Score RIC)</h3>
        
        <div class="score-summary">
            <p>Points Totaux disponibles: <strong>${totalPointsMax}</strong></p>
            <p>Points Utilisés: <strong>${totalPointsMax - pointsAvailable}</strong></p>
            <p class="score-available">Points Restants à attribuer: <strong>${pointsAvailable}</strong></p>
        </div>
        
        <div class="score-control-area">
            <label for="score-input-${itemId}">Points attribués à ce projet:</label>
            <input type="range" 
                   id="score-input-${itemId}" 
                   min="0" 
                   max="${scoreRangeMax}" 
                   value="${currentScore}" 
                   class="score-slider">
            <output for="score-input-${itemId}" id="score-value-${itemId}" class="score-output">${currentScore}</output>
            <button id="submit-score-btn" class="action-btn score-submit-btn">Soumettre le Score</button>
        </div>
        <p id="score-message" class="info-message"></p>
    `;

    // Attacher les écouteurs d'événements
    scoreInput = document.getElementById(`score-input-${itemId}`);
    scoreValue = document.getElementById(`score-value-${itemId}`);
    scoreMessage = document.getElementById('score-message');
    
    scoreInput.addEventListener('input', (e) => {
        scoreValue.textContent = e.target.value;
        scoreMessage.textContent = ''; 
    });

    document.getElementById('submit-score-btn').addEventListener('click', handleSubmitScore);
}

/**
 * Gère l'envoi du score à l'API ou la sauvegarde locale.
 */
async function handleSubmitScore() {
    const newScore = parseInt(scoreInput.value);
    const oldScore = userScores[currentItemId] || 0;
    const scoreChange = newScore - oldScore;

    if (scoreChange === 0) {
        scoreMessage.textContent = "Aucun changement détecté.";
        return;
    }

    // 1. Mise à jour locale (et vérification des limites)
    userScores[currentItemId] = newScore;
    saveUserScores();
    
    // 2. Mise à jour de l'état des points disponibles dans la modale
    loadUserScores(); 
    initializeScoreControls(currentItemId);
    
    scoreMessage.textContent = `Score local mis à jour. Points restants: ${pointsAvailable}.`;

    // 3. Tentative d'envoi à l'API (pour le mode Serveur)
    try {
        const response = await fetch('/api/vote-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentItemId,
                scoreChange: scoreChange
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            scoreMessage.textContent = `Score soumis (API OK). L'impact du vote est pris en compte.`;
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