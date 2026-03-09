# Product Requirements Document (PRD) - MVP Application de Billetterie

**Nom du Produit :** [Nom de ton App]
**Version :** 1.0 (MVP)
**Plateforme :** Mobile-First (PWA, React Native ou Flutter)

---

## 1. 🎯 Vision du Produit
Créer une plateforme de billetterie mobile-first, simple et sécurisée pour le marché ouest-africain. L'application permet aux organisateurs de vendre des tickets facilement, et aux acheteurs de payer via Mobile Money (Orange Money) pour recevoir un QR Code unique par WhatsApp. Pour garantir la confiance, les fonds sont bloqués et reversés à l'organisateur à la fin de l'événement.

## 2. 👥 Rôles Utilisateurs
* **Acheteur (Client) :** Achète un ticket et reçoit un QR code.
* **Organisateur (Créateur) :** Crée l'événement, suit les ventes, ajoute des scanneurs, et reçoit les fonds post-événement.
* **Scanneur (Staff) :** Rôle délégué par l'organisateur. Peut uniquement scanner les tickets pour valider les entrées.
* **Admin (Toi) :** Gère la plateforme, les litiges et les reversements (payouts).

## 3. 🚀 Périmètre du MVP (V1)

### ✅ Ce qui est INCLUS (V1)
* Connexion/Inscription par Numéro de Téléphone + OTP.
* Création d'un événement simple (Titre, Date, Prix, Description, Image).
* Achat de ticket via paiement par API Orange Money (Saisie OTP Mobile Money).
* Génération de QR Code unique après validation du paiement.
* Envoi du QR Code + Message de remerciement via WhatsApp (et dispo in-app).
* Interface de scan de QR Code (En ligne uniquement).
* Gestion des rôles "Scanneurs" (ajout de staff par l'organisateur).
* Reversement manuel/semi-auto des fonds à la fin de l'événement (Séquestre).
* Modèle économique : Commission fixe de 10% par transaction.

### ❌ Ce qui est EXCLU (Remis à la V2)
* Mode Hors-Ligne pour le scan (pour des raisons strictes de sécurité au lancement).
* Système de parrainage (Referral).
* Intégration d'autres moyens de paiement (FedaPay, cartes bancaires).

---

## 4. 📱 Fonctionnalités Clés & Parcours Utilisateur

### 4.1. Authentification (Mobile First)
* **Logique :** Pas de mot de passe. L'utilisateur entre son numéro -> reçoit un SMS OTP -> est connecté.
* **Création de compte :** Invisible. Si le numéro n'existe pas, le compte est créé à la volée.

### 4.2. Le Paiement & La Commission
* **Flux :** Le client clique sur "Payer" -> Saisit son numéro de téléphone de paiement -> Saisit le code OTP Orange Money -> Le serveur valide.
* **Business Model :** 10% de commission prélevés sur chaque vente. 
* **Calculs :** Le système doit enregistrer le `montant_total` et le `montant_organisateur` (montant_total - 10%).

### 4.3. Génération et Livraison du Ticket
* Une fois le statut du paiement sur `SUCCESS`, un ID unique et crypté est généré.
* Cet ID est transformé en image QR Code.
* Une intégration API (ex: Twilio/Meta ou bot WhatsApp) envoie le ticket au numéro de l'acheteur.

### 4.4. Le Système de Scan (Contrôle d'accès)
* L'organisateur ou le Scanneur ouvre l'appareil photo via l'application.
* **Cas 1 :** Le QR Code correspond à l'événement et n'a jamais été scanné -> Affichage Vert : **"Validé"**. Le statut du ticket passe à `scanned`.
* **Cas 2 :** Le QR Code a déjà été scanné -> Affichage Rouge : **"Ce code a déjà été validé"**.
* **Cas 3 :** Le QR Code appartient à un autre événement -> Affichage Rouge : **"Ce code n'est pas lié à cet événement"**.

## 5. 🛠️ Exigences Techniques (Stack Recommandée pour Cursor)

* **Frontend :** React Native (Expo) ou Flutter pour un déploiement rapide iOS/Android, ou Next.js en PWA pour du web mobile.
* **Backend / Base de données :** Supabase (Idéal pour l'Auth OTP par numéro de téléphone et la base de données en temps réel) ou Firebase.
* **Paiement :** API directe Orange Money.
* **Notifications :** API WhatsApp Cloud ou Twilio pour l'envoi des QR codes.

## 6. 🔒 Sécurité et Confiance (Escrow)
* L'argent collecté atterrit sur le compte marchand de la plateforme.
* Le solde de l'organisateur est visible dans son tableau de bord mais non retirable avant la fin de l'événement.
* Le QR code ne doit JAMAIS être généré par le frontend, uniquement par le backend après confirmation du Webhook d'Orange Money.