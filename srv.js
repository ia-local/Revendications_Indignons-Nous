// server.js

const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');
const fs = require('fs/promises');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
// Importation du SDK Gemini (pour la génération d'images)
const { GoogleGenAI } = require('@google/genai');

// --- Configuration du Serveur ---
const app = express();
const PORT = 3144;
app.use(express.json());

// --- Configuration Groq et IA ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "llama-3.1-8b-instant"; 

// Initialisation de Gemini (assurez-vous d'avoir la clé API dans l'environnement)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

if (!genAI) {
    console.warn("⚠️ AVERTISSEMENT GEMINI: La variable d'environnement GEMINI_API_KEY n'est pas définie. La génération d'images sera désactivée.");
}


// ------------------------------------------------
// 1. CONFIGURATION SWAGGER UI
// ------------------------------------------------
// ... (Code Swagger inchangé) ...
const swaggerDocumentPath = path.join(__dirname, 'api-docs', 'swagger.yaml');
let swaggerDocument = {};

try {
    swaggerDocument = YAML.load(swaggerDocumentPath);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log("✅ Documentation Swagger disponible sur /api-docs.");
} catch (error) {
    console.error('❌ Erreur lors du chargement de la documentation Swagger (vérifiez le chemin et la syntaxe YAML):', error.message);
}


// Servir les fichiers statiques (Front-end)
app.use(express.static(path.join(__dirname, 'docs')));


// ------------------------------------------------
// 2. GESTION DES DONNÉES ET REVENDICATIONS
// ------------------------------------------------

let revendicationsData = {};
const DATA_DIR = path.join(__dirname, 'docs', 'data'); 
const CATEGORY_MAP = {
    'demcratie': 'democratie', 
    'internationnal': 'international', 
};
const PRIORITY_ORDER = { 'Élevé': 3, 'Moyen': 2, 'Faible': 1 };


// NOUVEAU: Fichier de log des analyses générées par l'IA
const ANALYSIS_LOG_PATH = path.join(DATA_DIR, 'analysis_log.json');
let analysisLog = [];

/**
 * Charge tous les fichiers JSON du répertoire DATA_DIR (y compris le log d'analyse).
 */
async function loadAllRevendications() {
    try {
        // Charger le log d'analyse
        try {
            const logContent = await fs.readFile(ANALYSIS_LOG_PATH, 'utf-8');
            analysisLog = JSON.parse(logContent);
            console.log(`✅ Log d'analyse chargé (${analysisLog.length} entrées).`);
        } catch (logError) {
            analysisLog = [];
            console.warn("⚠️ analysis_log.json non trouvé ou vide. Création d'un nouveau log.");
        }
        
        // Charger les revendications (Logique inchangée)
        const files = await fs.readdir(DATA_DIR);
        revendicationsData = {};
        
        for (const file of files) {
            if (file.endsWith('.json') && file !== 'analysis_log.json') {
                let categoryFileName = path.parse(file).name;
                const categoryKey = CATEGORY_MAP[categoryFileName] || categoryFileName;
                
                const filePath = path.join(DATA_DIR, file);
                const fileContent = await fs.readFile(filePath, 'utf-8');
                
                const data = JSON.parse(fileContent).map((item, index) => {
                    const totalVotes = (item.votes?.oui || 0) + (item.votes?.non || 0) + (item.votes?.abstention || 0);

                    return {
                        ...item,
                        id: item.id || `${categoryKey}-${index}`, 
                        category: categoryKey,
                        votes: item.votes || { oui: 0, non: 0, abstention: 0 },
                        totalVotes: totalVotes,
                        ric_type: item.ric_type || 'Législatif', 
                        priority: item.priority || 'Faible',
                        totalScore: item.totalScore || 0 // Assurez-vous que le score existe
                    };
                });

                revendicationsData[categoryKey] = data;
            }
        }
        console.log(`✅ Revendications thématiques chargées : ${Object.keys(revendicationsData).join(', ')}.`);
        
    } catch (error) {
        console.error("❌ Erreur de chargement des revendications. Assurez-vous que le répertoire 'docs/data' existe et contient des fichiers JSON valides.", error);
    }
}

/**
 * Sauvegarde les revendications d'une catégorie donnée sur le disque. (Inchangée)
 */
async function saveRevendications(categoryKey) {
    try {
        const categoryFileName = Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === categoryKey) || categoryKey;
        const filePath = path.join(DATA_DIR, `${categoryFileName}.json`);
        
        const dataToSave = revendicationsData[categoryKey].map(item => {
            const { totalVotes, totalScore, ...rest } = item; 
            return { ...rest, totalScore: totalScore };
        });

        await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
        console.log(`💾 Données de la catégorie '${categoryKey}' sauvegardées.`);
    } catch (error) {
        console.error(`❌ Erreur lors de la sauvegarde de la catégorie '${categoryKey}':`, error);
    }
}

/**
 * NOUVEAU: Ajoute et sauvegarde une analyse générée au log.
 */
async function saveAnalysisLog(analysisData) {
    // Ajouter l'entrée horodatée au début du tableau
    const logEntry = {
        timestamp: new Date().toISOString(),
        ...analysisData
    };
    analysisLog.unshift(logEntry); 

    try {
        await fs.writeFile(ANALYSIS_LOG_PATH, JSON.stringify(analysisLog, null, 2), 'utf-8');
        console.log(`💾 Analyse pour ${analysisData.itemId} loguée.`);
    } catch (error) {
        console.error("❌ Erreur lors de la sauvegarde du log d'analyse:", error);
    }
}

/**
 * Cherche une revendication par ID à travers toutes les catégories. (Inchangée)
 */
function findRevendicationById(id) {
    for (const category in revendicationsData) {
        const item = revendicationsData[category].find(r => r.id === id);
        if (item) {
            return { item, category };
        }
    }
    return null;
}

/**
 * Fonction pour gérer la logique de nouvelle tentative (retry) avec backoff exponentiel. (Inchangée)
 */
async function retryApiCall(apiCall, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            if (error.status === 429) {
                console.error("ERREUR QUOTA (429): Arrêt des réessais Groq.");
                throw error;
            }

            if (i === maxRetries - 1) {
                throw error;
            }
            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


// Lancement initial du chargement des données
(async () => {
    await loadAllRevendications();
})();


// ----------------------------------------------------------------------
// ROUTE : Analyse Complète + Visualisation (Remplace /api/detail)
// ----------------------------------------------------------------------
app.get('/api/full-analysis', async (req, res) => {
    // ... (Logique de l'IA inchangée) ...
    const topic = req.query.topic; 
    
    if (!topic) {
        return res.status(400).json({ error: "Le paramètre 'topic' (revendication) est manquant." });
    }
    
    // --- 1. Préparation des appels asynchrones ---
    const textAnalysisPromise = (async () => {
        const textPrompt = `
            Revendication : "${topic}"
            En tant qu'analyste politique et social, vous devez détailler, contextualiser et développer la revendication ci-dessus.
            Présentez la comme une thèse envisagée, expliquant le problème sous-jacent, les enjeux actuels et les conséquences de son non-traitement.
            
            INSTRUCTIONS DE FORMATAGE CRUCIALE : La réponse doit être enveloppée dans une seule balise <div> avec la classe 'ia-output'. Utilisez les balises <h3> pour les titres de section ('Contexte et Problématique' et 'Justification de l'Urgence') et <strong> pour les mots-clés importants. N'incluez aucun Markdown, seulement du HTML valide.
            
            Structurez votre réponse avec les balises HTML demandées.
        `;

        try {
            const apiCall = async () => groq.chat.completions.create({
                messages: [
                    { role: "system", content: "Vous êtes un analyste politique et social. Votre tâche est de développer la revendication utilisateur en une thèse détaillée et contextualisée. La réponse doit être formatée en HTML structuré." },
                    { role: "user", content: textPrompt },
                ],
                model: GROQ_MODEL,
                temperature: 0.7, 
            });

            const chatCompletion = await retryApiCall(apiCall);
            return chatCompletion.choices[0]?.message?.content || "Analyse textuelle non générée.";

        } catch (error) {
            console.error("Erreur Groq lors de l'analyse textuelle:", error.message);
            return `<div class="error-message">Erreur: Le service d'analyse textuelle (Groq) a échoué. ${error.message}</div>`;
        }
    })();


    const imageGenerationPromise = (async () => {
        if (!genAI) return 'disabled';
        
        let mediaUrl = 'not_generated';
        const MAX_RETRIES = 5; 
        
        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const imagePrompt = `Crée une image symbolique de haute qualité, style art politique minimaliste, représentant le concept clé de cette revendication citoyenne: "${topic}". Concentrez-vous sur l'impact social ou l'enjeu démocratique.`;
                
                const result = await genAI.models.generateContent({
                    model: 'gemini-2.5-flash-image-preview',
                    contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
                    config: {
                        responseModalities: ["IMAGE"]
                    }
                });
                
                const imagePart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                
                if (imagePart && imagePart.inlineData?.data) {
                    mediaUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                    break; // Succès
                }

                console.warn(`Tentative d'image échouée ${i + 1}/${MAX_RETRIES}: Réponse vide ou incomplète.`);
                await new Promise(resolve => setTimeout(resolve, 500)); 
                
            } catch (imageError) { 
                if (imageError.status === 429) {
                     console.error("ERREUR QUOTA (429): Arrêt de la génération d'images.");
                     return 'error'; 
                }

                console.error(`Tentative d'image échouée ${i + 1}/${MAX_RETRIES} (Gemini):`, imageError.message); 
                mediaUrl = 'error';
                if (i === MAX_RETRIES - 1) throw imageError;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return mediaUrl;

    })();


    // --- 2. Exécution des promesses ---
    const [detail, mediaUrl] = await Promise.all([textAnalysisPromise, imageGenerationPromise]);

    // --- 3. Envoi de la réponse combinée ---
    res.json({ 
        success: true,
        detail: detail,
        mediaUrl: mediaUrl === 'disabled' || mediaUrl === 'error' ? null : mediaUrl 
    });
});


// ----------------------------------------------------------------------
// NOUVELLE ROUTE : Enregistrer les Analyses IA pour l'Historique
// ----------------------------------------------------------------------
app.post('/api/log-analysis', async (req, res) => {
    const { itemId, revendication, detailHtml, solutionHtml, mediaUrl } = req.body;

    if (!itemId || !revendication || !detailHtml || !solutionHtml) {
        return res.status(400).json({ error: "Les données d'analyse (itemId, detail, solution) sont requises." });
    }

    try {
        await saveAnalysisLog({
            itemId,
            revendication,
            detailHtml,
            solutionHtml,
            mediaUrl: mediaUrl || 'N/A'
        });

        res.json({ success: true, message: "Analyse enregistrée dans le log." });
    } catch (error) {
        console.error("Erreur lors du log de l'analyse:", error);
        res.status(500).json({ error: "Échec de l'enregistrement de l'analyse." });
    }
});


// ----------------------------------------------------------------------
// ROUTE : OPTIMISATION ET SOLUTIONS ENVISAGÉES (/api/optimise) (inchangée)
// ----------------------------------------------------------------------
app.get('/api/optimise', async (req, res) => {
    const detailText = req.query.detail; 
    
    if (!detailText) {
        return res.status(400).json({ error: "Le paramètre 'detail' (détail de la revendication) est manquant." });
    }

    const prompt = `
        En vous basant uniquement sur l'analyse détaillée fournie ci-dessous, agissez en tant qu'expert législatif et réformateur.
        Proposez une solution optimale et concrète pour résoudre le problème soulevé.
        Votre solution doit prendre la forme d'un projet de loi, d'une réforme constitutionnelle, d'une abrogation, d'une destitution, d'une initiative ou d'une réforme ciblée.
        Détaillez le type d'action requis et les étapes clés.
        
        INSTRUCTIONS DE FORMATAGE CRUCIALE :
        1. **La réponse doit être enveloppée dans une seule balise <div> avec la classe 'ia-output'.**
        2. Utilisez les balises **<h3>** pour les titres de section ('Proposition de Solution', 'Type d'Acte' et 'Étapes de Mise en Œuvre') avec la classe 'ia-title'.
        3. Utilisez des **<ul> ou <ol>** pour structurer l'information.
        4. Mettez les **mots-clés importants** en **gras** (utilisation de <strong>).
        5. N'incluez aucun code Markdown, seulement du HTML valide.

        Structurez votre réponse avec les balises HTML demandées.

        Analyse Détaillée à laquelle vous devez répondre : 
        ---
        ${detailText}
        ---
    `;

    try {
        const apiCall = async () => groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Vous êtes un expert législatif et un réformateur, spécialisé dans la conception de solutions concrètes pour les problèmes sociaux et politiques. La réponse doit être formatée en HTML structuré selon les instructions fournies."
                },
                {
                    role: "user",
                    content: prompt, 
                }
            ],
            model: GROQ_MODEL,
            temperature: 0.5,
        });

        const chatCompletion = await retryApiCall(apiCall);

        res.json({
            solution: chatCompletion.choices[0]?.message?.content || "Pas de solution générée."
        });

    } catch (error) {
        console.error("Erreur fatale lors de l'appel à /api/optimise:", error.message);
        res.status(500).json({ 
            error: `Erreur lors de la génération des solutions par le modèle. Vérifiez la clé API et les logs. Détails: ${error.message}` 
        });
    }
});


// ----------------------------------------------------------------------
// Les autres routes /api/stats, /api/vote, /api/vote-score sont inchangées.
// ----------------------------------------------------------------------

app.get('/api/stats', async (req, res) => {
    await loadAllRevendications(); 

    const stats = {
        totalRevendications: 0,
        byCategory: {},
        byPriority: { 'Faible': 0, 'Moyen': 0, 'Élevé': 0 },
        totalVotes: 0
    };

    for (const category in revendicationsData) {
        const count = revendicationsData[category].length;
        stats.totalRevendications += count;
        stats.byCategory[category] = count;

        revendicationsData[category].forEach(item => {
            stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
            // totalVotes est maintenant le totalScore (points) pour la priorisation
            stats.totalVotes += (item.totalScore || 0); 
        });
    }

    res.json(stats);
});


app.post('/api/vote', async (req, res) => {
    const { id, voteType } = req.body;
    
    if (!id || !voteType) {
        return res.status(400).json({ error: "Les paramètres 'id' et 'voteType' sont requis." });
    }
    
    const result = findRevendicationById(id);

    if (!result) {
        return res.status(404).json({ error: `Revendication avec l'ID '${id}' non trouvée.` });
    }

    const { item, category } = result;

    if (item.votes[voteType] !== undefined) {
        item.votes[voteType]++;
        item.totalVotes = (item.votes.oui || 0) + (item.votes.non || 0) + (item.votes.abstention || 0);

        await saveRevendications(category); 
        res.json({ success: true, new_votes: item.votes, total_votes: item.totalVotes });
    } else {
        res.status(400).json({ error: "Type de vote invalide." });
    }
});


app.post('/api/vote-score', async (req, res) => {
    const { id, scoreChange } = req.body; 
    
    if (!id || typeof scoreChange !== 'number' || scoreChange === 0) {
        return res.status(400).json({ error: "Les paramètres 'id' et 'scoreChange' (différence de points) sont requis." });
    }
    
    const result = findRevendicationById(id);

    if (!result) {
        return res.status(404).json({ error: `Revendication avec l'ID '${id}' non trouvée.` });
    }

    const { item, category } = result;
    
    item.totalScore = (item.totalScore || 0) + scoreChange;
    
    try {
        await saveRevendications(category); 
        
        res.json({ 
            success: true, 
            new_item_score: item.totalScore 
        });
        
    } catch (error) {
        console.error("Erreur lors de l'enregistrement du score:", error.message);
        res.status(500).json({ error: "Erreur serveur lors de la sauvegarde du score." });
    }
});


// Route par défaut (gère l'accès direct à l'index.html dans 'docs')
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});


// --- Démarrage du Serveur ---
app.listen(PORT, () => {
    console.log(`✅ Serveur web de développement démarré.`);
    console.log(`🌐 Interface web accessible sur: http://localhost:${PORT}`);
    console.log(`📚 Documentation de l'API : http://localhost:${PORT}/api-docs`);
    console.log(`🧠 Modèle d'optimisation (LPU): ${GROQ_MODEL}`);
    if (!process.env.GROQ_API_KEY) {
        console.warn("⚠️ AVERTISSEMENT: La variable d'environnement GROQ_API_KEY n'est pas définie. Les appels Groq échoueront.");
    }
});
