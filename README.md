# IA Mail Gestion README

## En une phrase
Cette application aide a traiter des emails entrants plus vite: elle lit les messages, propose une reponse avec l'IA, permet de corriger le brouillon, puis envoie la reponse avec suivi.

## Pourquoi ce projet
Dans beaucoup d'equipes, une grande partie du temps est perdue a:
- lire chaque email un par un,
- decider si une reponse est necessaire,
- rediger des reponses repetitives,
- garder une trace de ce qui a ete fait.

L'objectif du projet est de transformer ce flux en parcours simple, clair et fiable, avec un mode individuel et un mode session par lot.

## Ce que fait l'application
1. Recupere les emails recus.
2. Analyse le contenu avec l'IA (intention, type de demande, niveau d'urgence).
3. Decide si le message doit etre traite.
4. Propose un brouillon de reponse.
5. Permet a l'utilisateur de modifier le brouillon.
6. Sauvegarde le brouillon final.
7. Envoie la reponse et met a jour le statut.
8. Lance des sessions de traitement sur un nombre de mails choisi (ex: 5, 10, 20, 50).

## Deux modes d'utilisation
1. Mode unitaire (mail par mail):
- utile pour relire finement un message important,
- analyser, corriger, sauvegarder et envoyer au cas par cas.

2. Mode session (traitement par lot):
- l'utilisateur choisit combien de mails traiter,
- l'application execute une session complete,
- un rapport final resume: traites, ignores, erreurs, performance.

## Parcours utilisateur (simple)
1. Je choisis un mode:
- soit je traite un email precis,
- soit je lance une session sur X emails.
2. L'application analyse les emails et priorise les messages importants.
3. Je lis le resume et la proposition de reponse.
4. Je corrige le brouillon si besoin.
5. Je sauvegarde ou j'envoie.
6. Le systeme conserve l'historique, evite les doublons d'envoi et trace les statuts.
7. En mode session, je recupere un rapport global de traitement.

## Valeur concrete
- Gain de temps sur les reponses repetitives.
- Qualite plus homogene des reponses.
- Moins d'oubli grace au suivi des statuts.
- Meilleure tracabilite (ce qui a ete analyse, redige, envoye).
- Capacite a absorber un volume variable grace au mode session (traitement par lot).

## Garde-fous integres
- Verification avant envoi pour eviter un double envoi.
- Verrou de traitement quand un envoi est deja en cours.
- Sauvegarde propre du brouillon courant.
- Gestion d'erreurs avec messages clairs.

## Pourquoi c'est pertinent pour un besoin entreprise
Ce projet illustre la logique d'un outil interne qui centralise des informations, automatise des taches repetitives et fiabilise les operations.

Concretement:
1. Centraliser des flux heterogenes:
- aujourd'hui sur les emails,
- demain sur d'autres sources (API metier type ERP, outils techniques, plateformes internes).

2. Structurer le pilotage operationnel:
- priorisation automatique,
- statut clair des actions (a traiter, brouillon, envoye),
- historique exploitable pour le suivi equipe/client/distributeur.

3. Fiabiliser la donnee:
- moins de perte d'information,
- traces de ce qui a ete fait,
- base exploitable pour reporting et amelioration continue.

4. Avancer par increment:
- MVP utile rapidement,
- evolution progressive vers un outil interne plus large (gestion projets, suivi installations, coordination).

## Ce projet montre quelles competences
- Transformer un besoin metier en produit concret.
- Integrer des APIs externes (email + IA) de bout en bout.
- Concevoir un workflow fiable avec suivi de statut.
- Construire une experience utilisateur simple pour des actions complexes.
- Penser une architecture evolutive orientee outil interne d'entreprise.

## Statut du projet
Projet personnel de demonstration (portfolio), operationnel pour un usage de base.

