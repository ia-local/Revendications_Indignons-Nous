// server.js

const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');
const fs = require('fs/promises');

// --- Configuration du Serveur ---
const app = express();
const PORT = 3144;

// --- Configuration Groq et IA ---
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY 
});
const GROQ_MODEL = "gemma2-9b-it"; 

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'docs')));


// --- Chargement Statique des Revendications ---
let revendicationsData = {};
(async () => {
    try {
        const dataPath = path.join(__dirname, 'docs', 'revendications.json');
        const fileContent = await fs.readFile(dataPath, 'utf-8');
        revendicationsData = JSON.parse(fileContent);
        console.log("✅ Revendications JSON chargées.");
    } catch (error) {
        console.error("❌ Erreur de chargement de revendications.json. Veuillez vérifier le fichier:", error);
    }
})();


/**
 * Fonction pour gérer la logique de nouvelle tentative (retry) avec backoff exponentiel.
 * @param {Function} apiCall La fonction asynchrone à exécuter (l'appel Groq).
 * @param {number} maxRetries Nombre maximal de tentatives.
 * @returns Le résultat de l'appel API.
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
// ROUTE 1 : PRÉSENTATION DÉTAILLÉE DE LA REVENDICATION (/api/detail)
// ----------------------------------------------------------------------
app.get('/api/detail', async (req, res) => {
    const revendicationText = req.query.text;
    
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


// Route par défaut (gère l'accès direct à l'index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});


// --- Démarrage du Serveur ---
app.listen(PORT, () => {
    console.log(`✅ Serveur web de développement démarré.`);
    console.log(`🌐 Interface web accessible sur: http://localhost:${PORT}`);
    console.log(`🧠 Modèle d'optimisation (LPU): ${GROQ_MODEL}`);
    if (!process.env.GROQ_API_KEY) {
        console.warn("⚠️ AVERTISSEMENT: La variable d'environnement GROQ_API_KEY n'est pas définie. Les appels API échoueront.");
    }
});
