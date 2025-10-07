// server.js

const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');
const fs = require('fs/promises');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs'); // Librairie pour charger le fichier YAML

// --- Configuration du Serveur ---
const app = express();
const PORT = 3144;
// Utiliser Express JSON pour les requêtes POST (pour /api/vote)
app.use(express.json());

// --- Configuration Groq et IA ---
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY 
});
const GROQ_MODEL = "gemma2-9b-it"; 

// ------------------------------------------------
// 1. CONFIGURATION SWAGGER UI
// ------------------------------------------------
const swaggerDocumentPath = path.join(__dirname, 'api-docs', 'swagger.yaml');
let swaggerDocument = {};

try {
    swaggerDocument = YAML.load(swaggerDocumentPath);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log("✅ Documentation Swagger disponible sur /api-docs.");
} catch (error) {
    console.error('❌ Erreur lors du chargement de la documentation Swagger (vérifiez le chemin et la syntaxe YAML):', error.message);
}


// Servir les fichiers statiques (Front-end : index.html, script.js, etc.) depuis le répertoire 'docs'
app.use(express.static(path.join(__dirname, 'docs')));


// ------------------------------------------------
// 2. GESTION DES DONNÉES ET REVENDICATIONS
// ------------------------------------------------

// Contient toutes les revendications, structurées par catégorie (ex: { democratie: [...], ecologie: [...] })
let revendicationsData = {};
const DATA_DIR = path.join(__dirname, 'docs', 'data'); 

/**
 * Charge tous les fichiers JSON du répertoire DATA_DIR.
 * Chaque fichier JSON devient une catégorie de revendications.
 */
async function loadAllRevendications() {
    try {
        const files = await fs.readdir(DATA_DIR);
        revendicationsData = {}; // Réinitialiser avant le chargement
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const category = path.parse(file).name; // 'democratie'
                const filePath = path.join(DATA_DIR, file);
                const fileContent = await fs.readFile(filePath, 'utf-8');
                
                // Assurez-vous que chaque revendication a un ID unique pour le suivi
                const data = JSON.parse(fileContent).map((item, index) => ({
                    ...item,
                    id: item.id || `${category}-${index}`, // Assure un ID unique
                    category: category,
                    votes: item.votes || { oui: 0, non: 0, abstention: 0 },
                    ric_type: item.ric_type || 'Législatif', // Type de RIC par défaut
                    priority: item.priority || 'Faible' // Priorité par défaut
                }));

                revendicationsData[category] = data;
            }
        }
        console.log(`✅ Revendications thématiques chargées : ${Object.keys(revendicationsData).join(', ')}.`);
        
    } catch (error) {
        console.error("❌ Erreur de chargement des revendications. Assurez-vous que le répertoire 'docs/data' existe et contient des fichiers JSON valides.", error);
    }
}

/**
 * Sauvegarde les revendications d'une catégorie donnée sur le disque.
 * @param {string} category Le nom de la catégorie (ex: 'democratie').
 */
async function saveRevendications(category) {
    try {
        const filePath = path.join(DATA_DIR, `${category}.json`);
        const dataToSave = JSON.stringify(revendicationsData[category], null, 2);
        await fs.writeFile(filePath, dataToSave, 'utf-8');
        console.log(`💾 Données de la catégorie '${category}' sauvegardées.`);
    } catch (error) {
        console.error(`❌ Erreur lors de la sauvegarde de la catégorie '${category}':`, error);
    }
}

/**
 * Cherche une revendication par ID à travers toutes les catégories.
 * @param {string} id L'ID unique de la revendication (ex: 'democratie-3').
 * @returns {object | null} La revendication trouvée et sa catégorie.
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

// Lancement initial du chargement des données
(async () => {
    await loadAllRevendications();
})();


/**
 * Fonction pour gérer la logique de nouvelle tentative (retry) avec backoff exponentiel.
 * [La fonction retryApiCall est inchangée]
 */
async function retryApiCall(apiCall, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error;
            }
            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}


// ----------------------------------------------------------------------
// NOUVELLE ROUTE : Retourne toutes les revendications par catégorie
// ----------------------------------------------------------------------
app.get('/api/data', async (req, res) => {
    // Recharger les données pour s'assurer d'avoir les votes les plus récents
    await loadAllRevendications(); 
    res.json(revendicationsData);
});

// ----------------------------------------------------------------------
// NOUVELLE ROUTE : Retourne les statistiques pour le Dashboard
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
            stats.totalVotes += (item.votes.oui || 0) + (item.votes.non || 0) + (item.votes.abstention || 0);
        });
    }

    res.json(stats);
});


// ----------------------------------------------------------------------
// NOUVELLE ROUTE : Enregistrer un vote
// ----------------------------------------------------------------------
app.post('/api/vote', async (req, res) => {
    const { id, voteType } = req.body; // voteType doit être 'oui', 'non', ou 'abstention'
    
    if (!id || !voteType) {
        return res.status(400).json({ error: "Les paramètres 'id' et 'voteType' sont requis." });
    }
    
    const result = findRevendicationById(id);

    if (!result) {
        return res.status(404).json({ error: `Revendication avec l'ID '${id}' non trouvée.` });
    }

    const { item, category } = result;

    // Mise à jour du vote
    if (item.votes[voteType] !== undefined) {
        item.votes[voteType]++;
        await saveRevendications(category); // Sauvegarder la modification sur le disque
        res.json({ success: true, new_votes: item.votes });
    } else {
        res.status(400).json({ error: "Type de vote invalide." });
    }
});


// ----------------------------------------------------------------------
// ROUTE 1 : PRÉSENTATION DÉTAILLÉE DE LA REVENDICATION (/api/detail)
// NOTE : Le front-end devra maintenant envoyer l'ID et la catégorie
// ----------------------------------------------------------------------
app.get('/api/detail', async (req, res) => {
    const revendicationText = req.query.text; // Utilise toujours le texte car l'IA a besoin du contenu précis
    
    if (!revendicationText) {
        return res.status(400).json({ error: "Le paramètre 'text' (revendication) est manquant." });
    }
    
    const prompt = `
        Revendication : "${revendicationText}"
        
        En tant qu'analyste politique et social, vous devez détailler, contextualiser et développer la revendication ci-dessus.
        Présentez la comme une thèse envisagée, expliquant le problème sous-jacent, les enjeux actuels et les conséquences de son non-traitement.
        
        INSTRUCTIONS DE FORMATAGE CRUCIALE : 
        1. **La réponse doit être enveloppée dans une seule balise <div> avec la classe 'ia-output'.**
        2. Utilisez les balises **<h3>** pour les titres de section ('Contexte et Problématique' et 'Justification de l'Urgence') avec la classe 'ia-title'.
        3. Utilisez des **<ul> ou <ol>** pour structurer l'information.
        4. Mettez les **mots-clés importants** en **gras** (utilisation de <strong>).
        5. N'incluez aucun code Markdown, seulement du HTML valide.

        Structurez votre réponse avec les balises HTML demandées.
    `;

    try {
        const apiCall = async () => groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Vous êtes un analyste politique et social. Votre tâche est de développer la revendication utilisateur en une thèse détaillée et contextualisée, en vous concentrant sur le problème et l'urgence, sans proposer de solution à ce stade. La réponse doit être formatée en HTML structuré selon les instructions fournies."
                },
                {
                    role: "user",
                    content: prompt, 
                }
            ],
            model: GROQ_MODEL,
            temperature: 0.7, 
        });

        const chatCompletion = await retryApiCall(apiCall);

        res.json({
            detail: chatCompletion.choices[0]?.message?.content || "Pas de détail généré."
        });

    } catch (error) {
        console.error("Erreur fatale lors de l'appel à /api/detail:", error.message);
        res.status(500).json({ 
            error: `Erreur lors de la génération des détails par le modèle. Vérifiez la clé API et les logs. Détails: ${error.message}` 
        });
    }
});


// ----------------------------------------------------------------------
// ROUTE 2 : OPTIMISATION ET SOLUTIONS ENVISAGÉES (/api/optimise)
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
        console.warn("⚠️ AVERTISSEMENT: La variable d'environnement GROQ_API_KEY n'est pas définie. Les appels API échoueront.");
    }
});
