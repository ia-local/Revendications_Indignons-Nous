# 🧠 Projet de Réformes "Indignons-Nous" : Interface d'Optimisation IA

## Introduction

Ce projet met en place une **interface web de développement** qui permet de consulter les revendications du mouvement "Indignons-Nous" et d'utiliser un modèle de langage (LLM) **Gemma2-9b-it** (via Groq LPU) pour générer, en temps réel, une **analyse détaillée (thèse)** et une **proposition de solution concrète (projet de réforme)** pour chacune d'elles.

L'objectif est d'optimiser le plan de développement en transformant des revendications brutes en propositions législatives ou constitutionnelles structurées.

## 🚀 Fonctionnalités Clés

* **Navigation Latérale** : Menu pour parcourir les grandes sections de revendications (Démocratie, Écologie, Travail, etc.).
* **Système de Pagination** : Gestion claire des longues listes de revendications.
* **Pipeline d'Optimisation IA (Groq)** :
    1.  **Étape 1 (`/api/detail`)** : Analyse de la revendication en tant que **thèse** (problème, enjeux, urgence).
    2.  **Étape 2 (`/api/optimise`)** : Proposition de **solution** (projet de loi, abrogation, réforme constitutionnelle) basée sur l'analyse de l'Étape 1.
* **Rendu HTML Optimisé** : Les réponses de l'IA sont générées en HTML structuré (listes, gras, titres) pour une lisibilité maximale dans la modale.

## ⚙️ Installation et Lancement

### Prérequis

* Node.js (LTS recommandé)
* Une clé API Groq (disponible sur [Groq Console](https://console.groq.com/keys))

### 1. Structure du Projet

Assurez-vous que votre répertoire contient la structure suivante :
<code>
.
├── server.js               # Serveur Express et API Groq
├── package.json            # Dépendances Node.js
└── revendocations.json     # La liste des revendications
└── public/                 # Contenu Front-end statique
    ├── index.html
    ├── style.css
    ├── modal.css
    ├── script.js
    ├── modal.js
</code>

### 2. Configuration et Dépendances

Installez les dépendances Express et Groq SDK :

<code>
npm install express groq-sdk
</code>

### 3 Définir la Clé API

Pour des raisons de sécurité, la clé API Groq doit être définie comme une variable d'environnement.

Linux/macOS :
<code>
export GROQ_API_KEY="VOTRE_CLÉ_GROQ"
</code>
Windows (CMD) :
<code>
set GROQ_API_KEY="VOTRE_CLÉ_GROQ"
</code>
(Optionnel mais recommandé : Utilisez un fichier .env et la librairie dotenv pour la gestion des secrets en développement.)

### 4 Démarrage du Serveur

Lancez le serveur Node.js sur le port 3144 :
<code>
node server.js
</code>
# Ou si vous avez configuré le script dans package.json:
<code>
npm start
</code>
L'application sera accessible à l'adresse : http://localhost:3144.


📝 Pipeline d'Optimisation IA (Gemma2-9b-it)
Chaque clic sur une revendication déclenche le workflow API en deux étapes pour garantir la cohérence et le respect des limites de jetons :
