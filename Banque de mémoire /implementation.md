# Plan de Mise en Œuvre - MVP Application de Billetterie

Ce document contient les instructions étape par étape pour le développement de l'application de billetterie décrite dans le PRD. Ne générez pas de code avant qu'une étape ne soit explicitement demandée.

---

## Decisions techniques figees (validees)

1. Stack definitive: `Next.js` en mode `PWA` + `Supabase`.
2. Auth OTP: flux **custom serveur** (guide OTP reutilisable), envoi via `Wasender`.
3. Paiement Orange Money: `initiation -> USSD/validation Orange -> webhook`, avec bouton fallback `Verifier mon paiement`.
4. Ticketing V1: **1 achat = 1 ticket**.
5. Telephone: format **E.164 strict** (ex: `+226XXXXXXXX`).
6. Commission: 10 %, arrondi mathematique standard a l'unite FCFA.
7. Payout: autorise uniquement si `end_date` est depassee.
8. Localisation: interface 100 % francais, fuseau unique `Africa/Ouagadougou`.
9. OTP custom: TTL 5 minutes, 5 tentatives max, puis invalidation du token OTP.
10. Renvoi OTP: cooldown 60 secondes, limite 3 renvois par heure par numero.
11. Webhook Orange Money: verification signature/HMAC obligatoire (sinon fallback IP whitelist Orange).
12. Arrondi financier: `commission = round(total * 0.10)`, `organizer = total - commission`.
13. Fin evenement pour payout: si `end_date` est vide, utiliser `date + 24h`.

---

## Phase 1 : Initialisation et Base de Données

### Étape 1.1 : Initialisation du projet
* **Instruction :** Initialiser un nouveau projet frontend **Next.js en mode PWA** et configurer l'environnement backend (ex: projet Supabase). Lier le frontend au backend a l'aide des variables d'environnement appropriees.
* **Test de validation :** L'application se lance sur un émulateur ou un navigateur web et affiche une page d'accueil vide, sans erreur de connexion au backend.

### Étape 1.2 : Création du schéma de base de données
* **Instruction :** Créer les tables principales dans la base de données : `Users` (id, phone, roles), `Events` (id, title, date, price, description, image_url, organizer_id, status), `Tickets` (id, event_id, buyer_phone, qr_code_hash, status: pending/paid/scanned), et `Transactions` (id, ticket_id, total_amount, organizer_amount, commission_amount, status).
* **Test de validation :** L'insertion manuelle d'une ligne de test dans chaque table via la console de la base de données réussit, avec le respect des clés étrangères.

---

## Phase 2 : Authentification (Mobile First)

### Étape 2.1 : Interface de connexion par numéro
* **Instruction :** Créer un écran de connexion avec un champ pour saisir le numéro de téléphone et un bouton "Recevoir le code".
* **Test de validation :** L'utilisateur peut saisir un numéro (uniquement des chiffres) et cliquer sur le bouton.

### Étape 2.2 : Logique OTP (One Time Password)
* **Instruction :** Implementer le flux OTP **custom** cote serveur selon `guide-integration-otp-reutilisable.md` :
    - `POST /api/auth/send-otp` (validation E.164, generation OTP, envoi via Wasender, cookie OTP signe httpOnly)
    - `POST /api/auth/verify-otp` (verification token OTP + expiration + code, creation session)
    - OTP TTL = 5 minutes
    - maximum 5 tentatives, puis invalidation du cookie OTP et reprise du flux depuis l'etape numero
    - ecran de saisie OTP a 6 chiffres + cooldown de renvoi 60 secondes
    - limite renvoi OTP = 3 par heure et par numero
    - creation utilisateur invisible lors de la premiere validation reussie si absent
* **Test de validation :** L'utilisateur saisit un numéro, reçoit un SMS, saisit le code, et est redirigé vers l'écran d'accueil en tant qu'utilisateur connecté.

### Étape 2.3 : Gestion des profils et rôles
* **Instruction :** Créer un contexte d'application ou un state global pour stocker le rôle de l'utilisateur (Acheteur par défaut, Organisateur, ou Scanneur). Créer un système de redirection (routing) basé sur le rôle de l'utilisateur.
* **Test de validation :** Un utilisateur avec le rôle "Organisateur" dans la base de données est redirigé vers le tableau de bord organisateur, tandis qu'un utilisateur standard voit la liste des événements.

---

## Phase 3 : Création et Gestion des Événements

### Étape 3.1 : Formulaire de création d'événement
* **Instruction :** Développer un formulaire pour les organisateurs permettant de renseigner le titre, la date, le prix du ticket, une description, et d'uploader une image d'affiche.
* **Test de validation :** La soumission du formulaire enregistre correctement l'événement dans la table `Events` et upload l'image dans le bucket de stockage (storage).

### Étape 3.2 : Tableau de bord de l'organisateur
* **Instruction :** Créer une vue affichant les événements créés par l'organisateur connecté. Pour chaque événement, afficher le nombre de tickets vendus, les fonds générés (uniquement la part `organizer_amount`), et le statut (en cours/terminé).
* **Test de validation :** La vue affiche les données correctes calculées à partir des tables `Events` et `Tickets` liées à l'identifiant de l'organisateur.

### Étape 3.3 : Ajout de Scanneurs (Staff)
* **Instruction :** Ajouter une fonctionnalité dans le tableau de bord organisateur pour inviter un Scanneur via son numéro de téléphone. Cela doit créer ou mettre à jour un utilisateur avec le rôle "Scanneur" lié à cet événement spécifique.
* **Test de validation :** Le numéro invité reçoit les accès "Scanneur" pour cet événement précis, mais ne peut pas voir les données financières de l'organisateur.

---

## Phase 4 : Achat de Ticket et Paiement

### Étape 4.1 : Vue de l'événement et bouton d'achat
* **Instruction :** Créer la page de détails de l'événement pour les acheteurs. Ajouter un bouton "Acheter un ticket" qui ouvre une modale demandant le numéro de téléphone lié au compte Orange Money.
* **Test de validation :** Le clic sur le bouton affiche la modale d'achat avec le prix correct affiché.

### Étape 4.2 : Initialisation du paiement Orange Money
* **Instruction :** Développer la logique frontend pour envoyer le numéro saisi et l'ID de l'événement au backend. Le backend doit créer une entrée "pending" dans la table `Transactions` avec la logique de commission suivante :
    - `commission_amount = round(total_amount * 0.10)`
    - `organizer_amount = total_amount - commission_amount`
* **Test de validation :** La transaction est créée en base de données avec le statut "pending" et les montants sont exacts en conservant `total_amount = commission_amount + organizer_amount`.

### Étape 4.3 : Saisie OTP et Validation Orange Money
* **Instruction :** Ne pas demander le code secret Orange Money dans l'application. Utiliser le flux valide : initiation backend, confirmation via webhook Orange Money, puis fallback manuel avec bouton `Verifier mon paiement` si le webhook tarde. Le webhook doit verifier une signature/HMAC fournie par Orange Money ; si non disponible, appliquer un filtrage strict par IP whitelist Orange.
* **Test de validation :** Une simulation de réponse "SUCCESS" de l'API change le statut de la transaction et du ticket à "paid" dans la base de données.

---

## Phase 5 : Génération et Livraison du QR Code

### Étape 5.1 : Génération sécurisée du QR Code
* **Instruction :** Creer une fonction *backend* qui s'execute uniquement lorsque la transaction passe en `SUCCESS`. Cette fonction genere un identifiant unique (`qr_code_hash`) et le stocke dans `Tickets`. L'image QR est ensuite generee a la volee (API route ou client) a partir de ce hash, sans stockage d'image en base.
* **Test de validation :** Aucun `qr_code_hash` n'est genere si le paiement echoue. Si le paiement reussit, le `qr_code_hash` est bien associe au ticket en base de donnees.

### Étape 5.2 : Envoi par WhatsApp
* **Instruction :** Implémenter l'API WhatsApp (via Twilio ou Meta). Créer une fonction backend qui envoie un message standard contenant le titre de l'événement, un message de remerciement, et l'image du QR Code au numéro de téléphone de l'acheteur.
* **Test de validation :** Suite à un paiement validé (simulé), un message contenant l'image du QR Code est envoyé avec succès vers un numéro WhatsApp de test.

---

## Phase 6 : Système de Scan (Contrôle d'accès)

### Étape 6.1 : Interface de Scan (Camera)
* **Instruction :** Créer une interface pour le rôle "Scanneur" et "Organisateur" qui ouvre l'appareil photo de l'appareil pour scanner les QR Codes.
* **Test de validation :** L'application demande les permissions de la caméra et affiche le flux vidéo en direct.

### Étape 6.2 : Logique de validation du Scan (En ligne)
* **Instruction :** À la lecture d'un QR Code, envoyer le hash au backend. Le backend vérifie 3 conditions : le ticket existe-t-il pour CET événement ? Le statut est-il "paid" ? Le statut est-il déjà "scanned" ? Mettre à jour le statut à "scanned" si valide, et renvoyer la réponse au frontend.
* **Test de validation :**
    * Test A : Scanner un ticket valide affiche une modale verte "Validé".
    * Test B : Scanner le même ticket une seconde fois affiche une modale rouge "Ce code a déjà été validé".
    * Test C : Scanner un ticket appartenant à un autre événement affiche une modale rouge "Ce code n'est pas lié à cet événement".

---

## Phase 7 : Séquestre et Reversement (Admin)

### Étape 7.1 : Tableau de bord de clôture (Admin)
* **Instruction :** Créer une vue simplifiée (réservée à ton rôle Admin) listant les événements terminés. Afficher le total des fonds séquestrés (somme des `organizer_amount` des tickets "paid" et "scanned") à reverser à l'organisateur. Regle de fin: utiliser `end_date` si presente, sinon `date + 24h`.
* **Test de validation :** Le tableau Admin affiche le montant exact à reverser (Total des ventes moins les 10% de commission) pour un événement dont la date est passée.