// modal.js

const modal = document.getElementById('project-modal');
const closeModalBtn = document.querySelector('.close-button');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

// Variables pour suivre l'état de la revendication actuellement ouverte
let currentItemId = null;
let originalRevendicationElement;
let imagePlaceholder; 
let detailResultDiv;
let optimizationResultDiv;
let voteScoreDiv; 

// Stocker les résultats pour le log
let generatedDetailHtml = '';
let generatedSolutionHtml = '';
let generatedMediaUrl = '';
let generatedFullModalHtml = '';


/**
 * Initialise la structure du contenu IA (Modèle 4-lignes).
 */
function initializeModalContent() {
    const structure = `
        <!-- LIGNE 1 : TITRE / NOM DE LA REVENDICATION -->
        <h3 id="original-revendication-title"></h3>
        <p id="original-revendication" class="revendication-text-source"></p>
        
        <!-- NOUVEAU: Conteneur des indicateurs dynamiques (Doit être défini ici pour l'appel de score-vote) -->
        <div id="dynamic-indicators-container"></div>
        
        <!-- LIGNE 2 : IMAGE VISUELLE (Pleine largeur) -->
        <div id="image-container">
             <h3 class="step-title">Analyse Visuelle (Gemini AI)</h3>
             <div id="image-placeholder" class="image-placeholder loading-indicator">Chargement de l'image...</div>
        </div>

        <!-- LIGNE 3 : ANALYSES TEXTUELLES (2 COLONNES) -->
        <div id="analysis-grid-container">
            <!-- Colonne 1: Présentation Détaillée -->
            <div id="detail-column" class="analysis-column">
                <h3 class="step-title">1. Présentation Détaillée (Thèse du Problème)</h3>
                <div id="detail-result" class="ia-panel loading-indicator">Analyse disponible après soumission de votre Score de Priorité.</div>
            </div>

            <!-- Colonne 2: Proposition de Solution -->
            <div id="optimization-column" class="analysis-column">
                <h3 class="step-title">2. Proposition de Solution (Optimisation par Gemma2)</h3>
                <div id="optimization-result" class="ia-panel loading-indicator">Analyse disponible après soumission de votre Score de Priorité.</div>
            </div>
        </div>

        <!-- NOUVEAU : Bouton d'enregistrement manuel (FUSIONNÉ) -->
        <div id="save-button-area" style="text-align: right; margin-bottom: 15px;">
             <button id="save-analysis-btn" class="action-btn" style="background-color: #17a2b8;">
                 💾 Télécharger l'Analyse (HTML + Image PNG)
             </button>
             <span id="save-message" style="margin-left: 10px; color: green; font-size: 0.9em;"></span>
        </div>

        <!-- LIGNE 4 : CONTRÔLES RIC / VOTE PAR SCORE -->
        <div id="vote-score-controls" class="vote-ric-footer"></div> 
    `;
    modalBody.innerHTML = structure;

    // Assigner les références DOM après injection
    originalRevendicationElement = document.getElementById('original-revendication');
    imagePlaceholder = document.getElementById('image-placeholder');
    detailResultDiv = document.getElementById('detail-result');
    optimizationResultDiv = document.getElementById('optimization-result');
    voteScoreDiv = document.getElementById('vote-score-controls'); 
    
    // Attacher l'écouteur du nouveau bouton fusionné
    document.getElementById('save-analysis-btn')?.addEventListener('click', saveAnalysisLocally);
}
initializeModalContent();


/**
 * Enregistre l'analyse complète générée dans le log du serveur.
 */
async function logGeneratedAnalysis(itemId, revendicationText, detailHtml, solutionHtml, mediaUrl) {
    // Vérification cruciale : n'enregistrer que si on a bien généré le contenu
    if (!detailHtml || !solutionHtml) return;
    
    // Récupérer le HTML complet de la modale (L'affichage dynamique est géré par renderDynamicIndicators)
    const fullModalContentHtml = modalBody.innerHTML;

    try {
        const response = await fetch('/api/log-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId,
                revendication: revendicationText,
                detailHtml,
                solutionHtml,
                mediaUrl,
                fullModalContentHtml: fullModalContentHtml // Enregistrement du contenu complet
            })
        });

        if (response.ok) {
            // Lecture du JSON uniquement si la réponse est 200 OK
            await response.json(); 
            console.log(`Analyse [${itemId}] enregistrée avec succès.`);
        } else {
            // Si la réponse n'est pas OK (404, 500), essayer de lire le texte pour le débogage
            const errorBody = await response.text();
            console.error(`Échec de l'enregistrement de l'analyse. Statut: ${response.status}`, errorBody.substring(0, 100) + '...');
        }
    } catch (error) {
        // Cette erreur capture les problèmes de réseau ou de syntaxe JSON
        console.error("Erreur de connexion lors de l'enregistrement de l'analyse:", error);
    }
}

/**
 * Affiche immédiatement le contenu statique logué.
 * @param {object} logEntry L'entrée du log récupérée.
 */
function displayStaticAnalysis(logEntry) {
    imagePlaceholder.classList.remove('loading-indicator');
    detailResultDiv.classList.remove('loading-indicator');
    optimizationResultDiv.classList.remove('loading-indicator');

    // Mettre à jour les variables de log (maintenir l'état généré)
    generatedDetailHtml = logEntry.detailHtml;
    generatedSolutionHtml = logEntry.solutionHtml;
    generatedMediaUrl = logEntry.mediaUrl;
    
    // Si fullModalContentHtml est disponible dans le log, on l'utilise pour une restauration complète
    if (logEntry.fullModalContentHtml) {
        modalBody.innerHTML = logEntry.fullModalContentHtml;
        // Après la restauration complète, nous devons retouver les divs de contenu pour la prochaine action IA
        const currentDetailDiv = document.getElementById('detail-result');
        const currentOptimizationDiv = document.getElementById('optimization-result');
        const currentImagePlaceholder = document.getElementById('image-placeholder');
        
        if (currentDetailDiv && currentOptimizationDiv && currentImagePlaceholder) {
            detailResultDiv = currentDetailDiv;
            optimizationResultDiv = currentOptimizationDiv;
            imagePlaceholder = currentImagePlaceholder;
        }

    } else {
        // Logique d'affichage précédente si le full HTML n'est pas logué
        if (logEntry.mediaUrl && logEntry.mediaUrl !== 'N/A') {
            imagePlaceholder.innerHTML = `<img src="${logEntry.mediaUrl}" alt="Analyse visuelle (Log)" class="analysis-image">`;
        } else {
            imagePlaceholder.innerHTML = `<p class="error-message-small">❌ Image non disponible (Log statique).</p>`;
        }
        detailResultDiv.innerHTML = logEntry.detailHtml;
        optimizationResultDiv.innerHTML = logEntry.solutionHtml; 
    }

    console.log("Affichage du contenu statique logué.");
}


/**
 * Ouvre la modale et déclenche le processus IA.
 */
function openModal(sectionTitre, revendicationText, itemId) {
    currentItemId = itemId;
    
    // 1. Réinitialiser la structure interne et les variables
    initializeModalContent(); 

    // 2. Initialiser le formulaire de vote
    if (typeof initializeScoreControls === 'function') {
        initializeScoreControls(itemId, sectionTitre);
    }
    
    modalTitle.textContent = `Analyse et Projet de Réforme : ${sectionTitre}`;
    document.getElementById('original-revendication-title').textContent = revendicationText;
    originalRevendicationElement.textContent = revendicationText;
    
    // Réinitialisation des variables de log
    generatedDetailHtml = '';
    generatedSolutionHtml = '';
    generatedMediaUrl = '';

    // 3. Affichage initial des indicateurs de chargement (contenu minimum)
    imagePlaceholder.innerHTML = 'Chargement de l\'image...';
    imagePlaceholder.classList.add('loading-indicator');
    
    detailResultDiv.textContent = 'Analyse disponible après soumission de votre Score de Priorité.';
    detailResultDiv.classList.add('loading-indicator');

    optimizationResultDiv.textContent = 'Analyse disponible après soumission de votre Score de Priorité.';
    optimizationResultDiv.classList.add('loading-indicator');
    
    modal.style.display = "block";
    
    // 4. Déclencher le PROCESSUS D'ANALYSE (Vérification du log d'abord)
    
    // Afficher les indicateurs dynamiques (les votes et le score actuel) et vérifier le log statique
    fetchRealtimeItemData(currentItemId).then(realtimeData => {
        if (realtimeData) {
            renderDynamicIndicators(realtimeData);
            fetchStaticAnalysis(currentItemId); 
        }
    });
}


/**
 * Récupère les données de vote en temps réel pour l'item actuel. (Fonction utilitaire)
 */
async function fetchRealtimeItemData(itemId) {
    if (!window.allData) return null;
    
    // Rafraîchir les données globales (pour le score et les votes simples)
    try {
        const response = await fetch('/api/data');
        if (response.ok) {
            window.allData = await response.json();
        }
    } catch (e) {
        console.warn("Impossible de rafraîchir les données globales.");
    }
    
    // Parcourir l'objet global pour trouver l'item
    for (const categoryKey in window.allData) {
        const item = window.allData[categoryKey].find(r => r.id === itemId);
        if (item) {
            return {
                votes: item.votes,
                totalScore: item.totalScore || 0,
                ric_type: item.ric_type,
                totalVotesSimple: (item.votes.oui || 0) + (item.votes.non || 0) + (item.votes.abstention || 0)
            };
        }
    }
    return null;
}

/**
 * Génère et affiche la bannière d'indicateurs dynamiques. (Doit être appelée après fetchRealtimeItemData)
 */
function renderDynamicIndicators(itemData) {
    const container = document.getElementById('dynamic-indicators-container');
    if (!container || !itemData) return;

    const oui = itemData.votes.oui || 0;
    const non = itemData.votes.non || 0;
    const abstention = itemData.votes.abstention || 0;
    const totalSimple = itemData.totalVotesSimple;
    const score = itemData.totalScore || 0;

    const oui_percent = totalSimple > 0 ? ((oui / totalSimple) * 100).toFixed(1) : 0;
    const non_percent = totalSimple > 0 ? ((non / totalSimple) * 100).toFixed(1) : 0;
    
    container.innerHTML = `
        <div class="dynamic-indicator-bar">
            <!-- Indicateur 1: Score de Priorisation -->
            <div class="indicator-item priority-score">
                <span class="label">Score de Priorité (Points)</span>
                <span class="value score-value">${score}</span>
            </div>
            <!-- Indicateur 2: Vote Simple Favorable -->
            <div class="indicator-item favorable-vote">
                <span class="label">Votes Favorable (OUI)</span>
                <span class="value oui-value">${oui} (${oui_percent}%)</span>
            </div>
            <!-- Indicateur 3: Vote Simple Contre -->
            <div class="indicator-item unfavorable-vote">
                <span class="label">Votes Contre (NON)</span>
                <span class="value non-value">${non} (${non_percent}%)</span>
            </div>
            <!-- Indicateur 4: Total Simple -->
            <div class="indicator-item total-simple">
                <span class="label">Total Votants (Simple)</span>
                <span class="value">${totalSimple}</span>
            </div>
        </div>
    `;
}


/**
 * NOUVEAU: Fonction dédiée à la vérification du log pour openModal.
 */
async function fetchStaticAnalysis(itemId) {
    try {
        const logResponse = await fetch(`/api/get-analysis-log/${itemId}`);
        const logData = await logResponse.json();

        // Si le log est trouvé, on l'affiche et on sort.
        if (logData.found) {
            displayStaticAnalysis(logData);
            return; // Arrêter ici si le contenu logué est trouvé
        }
    } catch (e) {
        console.warn("Log statique non trouvé ou erreur d'API lors de la vérification initiale.");
    }
    return false;
}

/**
 * APPEL ÉTAPE 1: Lance le processus IA complet (appelé uniquement après la soumission du score).
 * Cette fonction est rendue globale pour être appelée par score-vote.js::handleSubmitScore
 * @param {string} revendication Le texte de la revendication.
 * @param {string} itemId L'ID de la revendication.
 */
window.launchFullIAProcess = async function(itemId) {
    const revendication = document.getElementById('original-revendication').textContent;
    
    // 1. Dégager les messages initiaux et afficher le chargement
    // Ajout d'un effet visuel de régénération
    detailResultDiv.innerHTML = '<span class="loading-spinner"></span><br>Chargement des détails (Étape 1/2)...';
    optimizationResultDiv.innerHTML = '<span class="loading-spinner"></span><br>En attente des analyses (Étape 2/2)...';
    imagePlaceholder.innerHTML = '<span class="loading-spinner"></span><br>Régénération de l\'image...';

    detailResultDiv.classList.add('loading-indicator');
    optimizationResultDiv.classList.add('loading-indicator');
    imagePlaceholder.classList.add('loading-indicator');
    
    // 2. Continuer le processus IA
    const encodedRevendication = encodeURIComponent(revendication);
    const analysisURL = `/api/full-analysis?topic=${encodedRevendication}`; 

    try {
        const response = await fetch(analysisURL);
        const data = await response.json();
        
        // --- Gestion de l'image (Visualisation) ---
        imagePlaceholder.classList.remove('loading-indicator');
        
        if (data.mediaUrl) {
            generatedMediaUrl = data.mediaUrl; // Stocker l'URL pour le log
            imagePlaceholder.innerHTML = `<img src="${data.mediaUrl}" alt="Analyse visuelle de la revendication" class="analysis-image">`;
        } else {
            imagePlaceholder.innerHTML = `<p class="error-message-small">❌ Image non disponible (Service désactivé ou erreur).</p>`;
        }
        
        // --- Gestion du Détail (Thèse) ---
        detailResultDiv.classList.remove('loading-indicator');

        if (data.detail) {
            generatedDetailHtml = data.detail; // Stocker le HTML pour le log
            detailResultDiv.innerHTML = data.detail;
            
            // 2. Passer à l'étape d'optimisation
            fetchOptimization(data.detail); 
        } else {
            detailResultDiv.innerHTML = '<p class="error-message">❌ Erreur d\'analyse textuelle (Étape 1) : Réponse vide.</p>';
            optimizationResultDiv.textContent = 'Annulé.';
        }

    } catch (error) {
        console.error("Erreur lors de la récupération de l'analyse IA:", error);
        detailResultDiv.classList.remove('loading-indicator');
        imagePlaceholder.innerHTML = `<p class="error-message-small">❌ Connexion au service d'analyse échouée.</p>`;
        detailResultDiv.innerHTML = '<p class="error-message">❌ Connexion au service d\'analyse échouée.</p>';
        optimizationResultDiv.textContent = 'Annulé.';
    }
}


/**
 * ÉTAPE 2: Appel à /api/optimise - Génère la solution concrète.
 */
async function fetchOptimization(detailText) {
    const encodedDetail = encodeURIComponent(detailText);
    const optimizeURL = `/api/optimise?detail=${encodedDetail}`;

    optimizationResultDiv.textContent = 'Génération de la solution basée sur l\'analyse détaillée...';

    try {
        const response = await fetch(optimizeURL);
        const data = await response.json();

        // Récupérer les données en temps réel pour le remplacement des placeholders
        const itemData = await fetchRealtimeItemData(currentItemId);

        optimizationResultDiv.classList.remove('loading-indicator');

        if (data.error) {
            optimizationResultDiv.innerHTML = `<p class='error-message'>❌ **Erreur d'API (Étape 2)**: ${data.error}</p>`;
        } else if (data.solution) {
            
            let solutionHtml = data.solution;

            // --- Remplacement des Placeholders avec les Données Dynamiques ---
            if (itemData) {
                const totalSimple = itemData.totalVotesSimple;
                const score = itemData.totalScore;
                const oui = itemData.votes.oui || 0;
                
                solutionHtml = solutionHtml.replace(/\[TOTAL_VOTANTS_PLACEHOLDER\]/g, totalSimple)
                                           .replace(/\[SCORE_PRIORITE_PLACEHOLDER\]/g, score)
                                           .replace(/\[VOTANTS_FAVORABLES_PLACEHOLDER\]/g, oui);
            }
            // -------------------------------------------------------------

            generatedSolutionHtml = solutionHtml; // Stocker le HTML pour le log
            optimizationResultDiv.innerHTML = solutionHtml;

            // Enregistrement automatique après la réussite des deux étapes
            logGeneratedAnalysis(
                currentItemId, 
                document.getElementById('original-revendication').textContent, 
                generatedDetailHtml, 
                generatedSolutionHtml, 
                generatedMediaUrl
            );

        } else {
            optimizationResultDiv.innerHTML = '<p class=\'error-message\'>❌ Erreur de solution (Étape 2) : Réponse vide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la récupération de l'optimisation IA:", error);
        optimizationResultDiv.classList.remove('loading-indicator');
        optimizationResultDiv.innerHTML = '<p class=\'error-message\'>❌ Erreur de connexion au service d\'optimisation (Étape 2).</p>';
    }
}


// --- Fonctions de Sauvegarde Manuelle ---

/**
 * Télécharge une chaîne Base64 (image) sous forme de fichier.
 */
function downloadBase64AsPng(dataURL, filename) {
    if (!dataURL || dataURL.startsWith('http')) {
        return false; // Échec du téléchargement Base64
    }
    
    // Créer un lien pour simuler le téléchargement
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
}

/**
 * Gère la sauvegarde du contenu généré par l'IA au format HTML (et propose l'image PNG).
 */
async function saveAnalysisLocally() {
    const fileName = currentItemId ? `Analyse_RIC_${currentItemId}` : 'Analyse_RIC_Projet';
    const revendicationText = document.getElementById('original-revendication-title').textContent;
    const saveMessage = document.getElementById('save-message');

    if (!generatedDetailHtml || !generatedSolutionHtml) {
        saveMessage.textContent = "❌ L'analyse n'est pas encore complète !";
        saveMessage.style.color = 'red';
        return;
    }

    // NOUVEAU : Récupérer les données de vote en temps réel pour l'intégration HTML
    const itemData = await fetchRealtimeItemData(currentItemId);
    let dynamicIndicatorHtml = '';

    if (itemData) {
        const oui = itemData.votes.oui || 0;
        const non = itemData.votes.non || 0;
        const totalSimple = itemData.totalVotesSimple;
        const score = itemData.totalScore || 0;
        
        const oui_percent = totalSimple > 0 ? ((oui / totalSimple) * 100).toFixed(1) : 0;
        const non_percent = totalSimple > 0 ? ((non / totalSimple) * 100).toFixed(1) : 0;

        dynamicIndicatorHtml = `
            <div style="display: flex; justify-content: space-around; background: #e0f7fa; padding: 10px; margin-bottom: 20px; border-radius: 6px; border: 1px solid #007bff;">
                <p style="margin: 0;"><strong>Score de Priorité:</strong> <span style="color: #0056b3;">${score}</span></p>
                <p style="margin: 0;"><strong>Votes OUI:</strong> <span style="color: #28a745;">${oui} (${oui_percent}%)</span></p>
                <p style="margin: 0;"><strong>Votes NON:</strong> <span style="color: #dc3545;">${non} (${non_percent}%)</span></p>
                <p style="margin: 0;"><strong>Total Votants:</strong> ${totalSimple}</p>
            </div>
        `;
    }


    // --- 1. Sauvegarde du Fichier HTML de l'Analyse ---
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Analyse et Proposition - ${revendicationText}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 900px; margin: auto; }
                h1 { color: #0056b3; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
                h3 { color: #007bff; margin-top: 20px; border-bottom: 1px solid #ddd; }
                /* MODIFICATION: Utilisation de la mise en page en colonne */
                .grid { display: flex; flex-direction: column; gap: 20px; }
                .col { width: 100%; } /* Prend toute la largeur */
                .image-container img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); margin-top: 10px; }
                .ia-output { background: #f4f4f9; padding: 15px; border-radius: 6px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <h1>Analyse du Projet : ${revendicationText}</h1>
            
            <div class="image-container">
                <h3>Analyse Visuelle Générée:</h3>
                ${generatedMediaUrl ? `<img src="${generatedMediaUrl}" alt="Visualisation du concept">` : '<p>Image non générée ou non disponible.</p>'}
            </div>
            
            <!-- AFFICHAGE DES INDICATEURS DYNAMIQUES DANS LE FICHIER HTML -->
            ${dynamicIndicatorHtml}

            <!-- UTILISATION DE FLEX-DIRECTION: COLUMN -->
            <div class="grid">
                <div class="col">
                    <h3>1. Présentation Détaillée (Thèse):</h3>
                    ${generatedDetailHtml}
                </div>
                <div class="col">
                    <h3>2. Proposition de Solution (Optimisation):</h3>
                    ${generatedSolutionHtml}
                </div>
            </div>

            <hr>
            <p>Ce document est une analyse générée par IA (Groq/Gemini) le ${new Date().toLocaleDateString()}.</p>
        </body>
        </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `${fileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    saveMessage.textContent = "✅ Fichier HTML enregistré !";
    saveMessage.style.color = 'green';
    
    // --- 2. Sauvegarde de l'Image PNG (TÉLÉCHARGEMENT SECONDAIRE) ---
    if (generatedMediaUrl && generatedMediaUrl !== 'N/A') {
        const imageFileName = `${fileName}_Image.png`;
        const success = downloadBase64AsPng(generatedMediaUrl, imageFileName);
        
        if (success) {
             saveMessage.textContent += " & Image PNG enregistrée !";
        } else {
             saveMessage.textContent = "⚠️ HTML enregistré, mais échec du téléchargement de l'image (non Base64 ou erreur).";
        }
    }
    
    setTimeout(() => { saveMessage.textContent = ""; }, 4000);
}


/**
 * Gère la sauvegarde de l'image Base64 au format PNG.
 * (Fonction conservée mais appelée par saveAnalysisLocally)
 */
function saveImageLocally() {
    const fileName = currentItemId ? `Image_RIC_${currentItemId}.png` : 'Image_RIC_Projet.png';
    const saveMessage = document.getElementById('save-message');
    
    if (!generatedMediaUrl || generatedMediaUrl === 'N/A') {
        saveMessage.textContent = "❌ Aucune image disponible à enregistrer.";
        saveMessage.style.color = 'red';
        setTimeout(() => { saveMessage.textContent = ""; }, 3000);
        return;
    }
    
    downloadBase64AsPng(generatedMediaUrl, fileName);
}


/**
 * Enregistre l'analyse complète générée dans le log du serveur.
 */
async function logGeneratedAnalysis(itemId, revendicationText, detailHtml, solutionHtml, mediaUrl) {
    // Vérification cruciale : n'enregistrer que si on a bien généré le contenu
    if (!detailHtml || !solutionHtml) return;
    
    // Récupérer le HTML complet de la modale (L'affichage dynamique est géré par renderDynamicIndicators)
    const fullModalContentHtml = modalBody.innerHTML;

    try {
        const response = await fetch('/api/log-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId,
                revendication: revendicationText,
                detailHtml,
                solutionHtml,
                mediaUrl,
                fullModalContentHtml: fullModalContentHtml // Enregistrement du contenu complet
            })
        });

        if (response.ok) {
            await response.json(); 
            console.log(`Analyse [${itemId}] enregistrée avec succès.`);
        } else {
            const errorBody = await response.text();
            console.error(`Échec de l'enregistrement de l'analyse. Statut: ${response.status}`, errorBody.substring(0, 100) + '...');
        }
    } catch (error) {
        console.error("Erreur de connexion lors de l'enregistrement de l'analyse:", error);
    }
}

/**
 * Affiche immédiatement le contenu statique logué.
 * @param {object} logEntry L'entrée du log récupérée.
 */
function displayStaticAnalysis(logEntry) {
    // Si fullModalContentHtml est disponible dans le log, on l'utilise pour une restauration complète
    if (logEntry.fullModalContentHtml) {
        modalBody.innerHTML = logEntry.fullModalContentHtml;
    }
    // Sinon, on revient à l'ancienne méthode d'injection simple (méthode de sécurité)
    else {
        imagePlaceholder.classList.remove('loading-indicator');
        detailResultDiv.classList.remove('loading-indicator');
        optimizationResultDiv.classList.remove('loading-indicator');

        if (logEntry.mediaUrl && logEntry.mediaUrl !== 'N/A') {
            imagePlaceholder.innerHTML = `<img src="${logEntry.mediaUrl}" alt="Analyse visuelle (Log)" class="analysis-image">`;
        } else {
            imagePlaceholder.innerHTML = `<p class="error-message-small">❌ Image non disponible (Log statique).</p>`;
        }
        detailResultDiv.innerHTML = logEntry.detailHtml;
        optimizationResultDiv.innerHTML = logEntry.solutionHtml; 
    }

    // Mise à jour des variables pour le log (au cas où l'utilisateur sauvegarde localement après restauration)
    generatedDetailHtml = logEntry.detailHtml;
    generatedSolutionHtml = logEntry.solutionHtml;
    generatedMediaUrl = logEntry.mediaUrl;

    console.log("Affichage du contenu statique logué.");
}


/**
 * Ouvre la modale et déclenche le processus IA.
 */
function openModal(sectionTitre, revendicationText, itemId) {
    currentItemId = itemId;
    
    // Réinitialiser la structure interne et les variables
    initializeModalContent(); 

    if (typeof initializeScoreControls === 'function') {
        initializeScoreControls(itemId, sectionTitre);
    }
    
    modalTitle.textContent = `Analyse et Projet de Réforme : ${sectionTitre}`;
    document.getElementById('original-revendication-title').textContent = revendicationText;
    originalRevendicationElement.textContent = revendicationText;
    
    // Réinitialisation des variables de log
    generatedDetailHtml = '';
    generatedSolutionHtml = '';
    generatedMediaUrl = '';

    // Affichage initial des indicateurs de chargement (contenu minimum)
    imagePlaceholder.innerHTML = 'Chargement de l\'image...';
    imagePlaceholder.classList.add('loading-indicator');
    
    detailResultDiv.textContent = 'Analyse disponible après soumission de votre Score de Priorité.';
    detailResultDiv.classList.add('loading-indicator');

    optimizationResultDiv.textContent = 'Analyse disponible après soumission de votre Score de Priorité.';
    optimizationResultDiv.classList.add('loading-indicator');
    
    modal.style.display = "block";
    
    // Afficher les indicateurs dynamiques (les votes et le score actuel) et vérifier le log statique
    fetchRealtimeItemData(currentItemId).then(realtimeData => {
        if (realtimeData) {
            renderDynamicIndicators(realtimeData);
            fetchStaticAnalysis(currentItemId); 
        }
    });
}


/**
 * Récupère les données de vote en temps réel pour l'item actuel. (Fonction utilitaire)
 */
async function fetchRealtimeItemData(itemId) {
    if (!window.allData) return null;
    
    // Rafraîchir les données globales (pour le score et les votes simples)
    try {
        const response = await fetch('/api/data');
        if (response.ok) {
            window.allData = await response.json();
        }
    } catch (e) {
        console.warn("Impossible de rafraîchir les données globales.");
    }
    
    // Parcourir l'objet global pour trouver l'item
    for (const categoryKey in window.allData) {
        const item = window.allData[categoryKey].find(r => r.id === itemId);
        if (item) {
            return {
                votes: item.votes,
                totalScore: item.totalScore || 0,
                ric_type: item.ric_type,
                totalVotesSimple: (item.votes.oui || 0) + (item.votes.non || 0) + (item.votes.abstention || 0)
            };
        }
    }
    return null;
}

/**
 * Génère et affiche la bannière d'indicateurs dynamiques. (Doit être appelée après fetchRealtimeItemData)
 */
function renderDynamicIndicators(itemData) {
    const container = document.getElementById('dynamic-indicators-container');
    if (!container || !itemData) return;

    const oui = itemData.votes.oui || 0;
    const non = itemData.votes.non || 0;
    const abstention = itemData.votes.abstention || 0;
    const totalSimple = itemData.totalVotesSimple;
    const score = itemData.totalScore || 0;

    const oui_percent = totalSimple > 0 ? ((oui / totalSimple) * 100).toFixed(1) : 0;
    const non_percent = totalSimple > 0 ? ((non / totalSimple) * 100).toFixed(1) : 0;
    
    container.innerHTML = `
        <div class="dynamic-indicator-bar">
            <!-- Indicateur 1: Score de Priorisation -->
            <div class="indicator-item priority-score">
                <span class="label">Score de Priorité (Points)</span>
                <span class="value score-value">${score}</span>
            </div>
            <!-- Indicateur 2: Vote Simple Favorable -->
            <div class="indicator-item favorable-vote">
                <span class="label">Votes Favorable (OUI)</span>
                <span class="value oui-value">${oui} (${oui_percent}%)</span>
            </div>
            <!-- Indicateur 3: Vote Simple Contre -->
            <div class="indicator-item unfavorable-vote">
                <span class="label">Votes Contre (NON)</span>
                <span class="value non-value">${non} (${non_percent}%)</span>
            </div>
            <!-- Indicateur 4: Total Simple -->
            <div class="indicator-item total-simple">
                <span class="label">Total Votants (Simple)</span>
                <span class="value">${totalSimple}</span>
            </div>
        </div>
    `;
}


/**
 * NOUVEAU: Fonction dédiée à la vérification du log pour openModal.
 */
async function fetchStaticAnalysis(itemId) {
    try {
        const logResponse = await fetch(`/api/get-analysis-log/${itemId}`);
        const logData = await logResponse.json();

        // Si le log est trouvé, on l'affiche et on sort.
        if (logData.found) {
            displayStaticAnalysis(logData);
            return; // Arrêter ici si le contenu logué est trouvé
        }
    } catch (e) {
        console.warn("Log statique non trouvé ou erreur d'API lors de la vérification initiale.");
    }
    return false;
}

/**
 * APPEL ÉTAPE 1: Lance le processus IA complet (appelé uniquement après la soumission du score).
 * Cette fonction est rendue globale pour être appelée par score-vote.js::handleSubmitScore
 * @param {string} revendication Le texte de la revendication.
 * @param {string} itemId L'ID de la revendication.
 */
window.launchFullIAProcess = async function(itemId) {
    const revendication = document.getElementById('original-revendication').textContent;
    
    // 1. Dégager les messages initiaux et afficher le chargement
    detailResultDiv.classList.add('loading-indicator');
    optimizationResultDiv.classList.add('loading-indicator');
    imagePlaceholder.classList.add('loading-indicator');
    
    // Afficher les messages IA
    detailResultDiv.textContent = 'Chargement des détails (Étape 1/2)...';
    optimizationResultDiv.textContent = 'En attente des analyses pour générer la solution (Étape 2/2)...';

    // 2. Continuer le processus IA
    const encodedRevendication = encodeURIComponent(revendication);
    const analysisURL = `/api/full-analysis?topic=${encodedRevendication}`; 

    try {
        const response = await fetch(analysisURL);
        const data = await response.json();
        
        // --- Gestion de l'image (Visualisation) ---
        imagePlaceholder.classList.remove('loading-indicator');
        
        if (data.mediaUrl) {
            generatedMediaUrl = data.mediaUrl; // Stocker l'URL pour le log
            imagePlaceholder.innerHTML = `<img src="${data.mediaUrl}" alt="Analyse visuelle de la revendication" class="analysis-image">`;
        } else {
            imagePlaceholder.innerHTML = `<p class="error-message-small">❌ Image non disponible (Service désactivé ou erreur).</p>`;
        }
        
        // --- Gestion du Détail (Thèse) ---
        detailResultDiv.classList.remove('loading-indicator');

        if (data.detail) {
            generatedDetailHtml = data.detail; // Stocker le HTML pour le log
            detailResultDiv.innerHTML = data.detail;
            
            // 2. Passer à l'étape d'optimisation
            fetchOptimization(data.detail); 
        } else {
            detailResultDiv.innerHTML = '<p class="error-message">❌ Erreur d\'analyse textuelle (Étape 1) : Réponse vide.</p>';
            optimizationResultDiv.textContent = 'Annulé.';
        }

    } catch (error) {
        console.error("Erreur lors de la récupération de l'analyse IA:", error);
        detailResultDiv.classList.remove('loading-indicator');
        imagePlaceholder.innerHTML = `<p class="error-message-small">❌ Connexion au service d'analyse échouée.</p>`;
        detailResultDiv.innerHTML = '<p class="error-message">❌ Connexion au service d\'analyse échouée.</p>';
        optimizationResultDiv.textContent = 'Annulé.';
    }
}


/**
 * ÉTAPE 2: Appel à /api/optimise - Génère la solution concrète.
 */
async function fetchOptimization(detailText) {
    const encodedDetail = encodeURIComponent(detailText);
    const optimizeURL = `/api/optimise?detail=${encodedDetail}`;

    optimizationResultDiv.textContent = 'Génération de la solution basée sur l\'analyse détaillée...';

    try {
        const response = await fetch(optimizeURL);
        const data = await response.json();

        // Récupérer les données en temps réel pour le remplacement des placeholders
        const itemData = await fetchRealtimeItemData(currentItemId);

        optimizationResultDiv.classList.remove('loading-indicator');

        if (data.error) {
            optimizationResultDiv.innerHTML = `<p class='error-message'>❌ **Erreur d'API (Étape 2)**: ${data.error}</p>`;
        } else if (data.solution) {
            
            let solutionHtml = data.solution;

            // --- Remplacement des Placeholders avec les Données Dynamiques ---
            if (itemData) {
                const totalSimple = itemData.totalVotesSimple;
                const score = itemData.totalScore;
                const oui = itemData.votes.oui || 0;
                
                solutionHtml = solutionHtml.replace(/\[TOTAL_VOTANTS_PLACEHOLDER\]/g, totalSimple)
                                           .replace(/\[SCORE_PRIORITE_PLACEHOLDER\]/g, score)
                                           .replace(/\[VOTANTS_FAVORABLES_PLACEHOLDER\]/g, oui);
            }
            // -------------------------------------------------------------

            generatedSolutionHtml = solutionHtml; // Stocker le HTML pour le log
            optimizationResultDiv.innerHTML = solutionHtml;

            // Enregistrement automatique après la réussite des deux étapes
            logGeneratedAnalysis(
                currentItemId, 
                document.getElementById('original-revendication').textContent, 
                generatedDetailHtml, 
                generatedSolutionHtml, 
                generatedMediaUrl
            );

        } else {
            optimizationResultDiv.innerHTML = '<p class=\'error-message\'>❌ Erreur de solution (Étape 2) : Réponse vide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la récupération de l'optimisation IA:", error);
        optimizationResultDiv.classList.remove('loading-indicator');
        optimizationResultDiv.innerHTML = '<p class=\'error-message\'>❌ Erreur de connexion au service d\'optimisation (Étape 2).</p>';
    }
}


// --- Gestion des Événements de Fermeture ---
closeModalBtn.onclick = function() {
    modal.style.display = "none";
    if (window.renderRevendicationsView) {
        window.renderRevendicationsView();
    }
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
        if (window.renderRevendicationsView) {
            window.renderRevendicationsView();
        }
    }
}
