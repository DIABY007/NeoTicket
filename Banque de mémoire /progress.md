## Suivi d’Avancement - MVP Billetterie

Ce document liste toutes les étapes définies dans `implementation.md` et leur statut.
Convention de statut : `À faire`, `En cours`, `Terminé`.

---

## Phase 1 : Initialisation et Base de Données

- **Étape 1.1 : Initialisation du projet**
  - Description : Initialiser le projet Next.js PWA (frontend) et la configuration Supabase (backend), lier le frontend au backend via les variables d’environnement.
  - Statut : Terminé
  - Livrables :
    - Projet initialise dans `web/` avec Next.js App Router + TypeScript + ESLint.
    - Base PWA en place : `manifest`, `service worker`, enregistrement client.
    - Variables d'environnement standardisees dans `web/.env.example`.
    - Liaison Supabase preparee via helpers `web/src/lib/supabase/client.ts` et `web/src/lib/supabase/server.ts`.
  - Verification realisee : `npm run lint` et `npm run build` OK.

- **Étape 1.2 : Création du schéma de base de données**
  - Description : Créer les tables `Users`, `Events`, `Tickets`, `Transactions`, `EventScanners`, `Payouts` dans Supabase, avec les clés étrangères et contraintes.
  - Statut : Terminé
  - Livrables :
    - Migration SQL creee : `web/supabase/migrations/20260307_120000_init_schema.sql`.
    - Enums metier, tables, cles etrangeres, contraintes (E.164, coherence des montants), indexes et triggers `updated_at` inclus.
    - Vue `v_events_with_effective_end` ajoutee pour gerer la regle `end_date` sinon `date + 24h`.
  - Validation test : migration executee avec succes sur Supabase (validation confirmee par passage a l'etape suivante).

---

## Phase 2 : Authentification (Mobile First)

- **Étape 2.1 : Interface de connexion par numéro**
  - Description : Créer un écran/une page de connexion avec champ numéro de téléphone et bouton "Recevoir le code".
  - Statut : Terminé
  - Livrables :
    - Composant UI: `web/src/components/auth/login-phone-form.tsx`.
    - Ecran rendu sur la page d'accueil: `web/src/app/page.tsx`.
    - Validation frontend: chiffres uniquement, longueur minimale, et bouton `Recevoir le code` actif pour test UX.
  - Limite volontaire : aucune logique d'envoi OTP backend a ce stade (reservee a l'etape 2.2).

- **Étape 2.2 : Logique OTP (One Time Password)**
  - Description : Connecter le formulaire de connexion au service d’authentification (Supabase ou backend custom inspiré de NeoLove) pour envoyer un SMS OTP et gérer la saisie/validation du code.
  - Statut : Terminé
  - Livrables :
    - API `POST /api/auth/send-otp` : validation E.164, rate-limit (cooldown 60s, max 3 envois/heure), generation OTP, envoi Wasender, cookie OTP signe.
    - API `POST /api/auth/verify-otp` : verification code 6 chiffres, max 5 tentatives, creation utilisateur automatique si absent, creation session applicative, suppression cookie OTP.
    - Formulaire login passe en flux 2 etapes (numero -> OTP) avec etats de chargement, erreurs et renvoi OTP.
  - Fichiers principaux :
    - `web/src/app/api/auth/send-otp/route.ts`
    - `web/src/app/api/auth/verify-otp/route.ts`
    - `web/src/lib/auth/*`
    - `web/src/lib/wasender.ts`
    - `web/src/components/auth/login-phone-form.tsx`

- **Étape 2.3 : Gestion des profils et rôles**
  - Description : Mettre en place le contexte global utilisateur, la gestion multi-rôles (Acheteur, Organisateur, Scanneur, Admin) et les redirections selon le rôle.
  - Statut : Terminé
  - Livrables :
    - State global auth/roles via `AuthProvider`.
    - API `GET /api/auth/me` pour charger la session utilisateur depuis cookie signe.
    - Redirection post-login et au chargement de `/` vers la route correspondant au role principal.
    - Routes cibles creees :
      - `web/src/app/buyer/page.tsx`
      - `web/src/app/organizer/dashboard/page.tsx`
      - `web/src/app/scanner/scan/page.tsx`
      - `web/src/app/admin/dashboard/page.tsx`

---

## Phase 3 : Création et Gestion des Événements

- **Étape 3.1 : Formulaire de création d’événement**
  - Description : Formulaire pour Organisateur (titre, date, prix, description, upload d’image) et enregistrement dans `Events` + Storage.
  - Statut : Terminé
  - Livrables :
    - UI de creation evenement sur `web/src/app/organizer/dashboard/page.tsx`.
    - Formulaire complet `web/src/components/organizer/create-event-form.tsx` (titre, description, date debut, date fin, prix, image).
    - API `POST /api/organizer/events` sur `web/src/app/api/organizer/events/route.ts`.
    - Upload affiche vers Supabase Storage (bucket configurable `SUPABASE_STORAGE_EVENTS_BUCKET`, defaut `event-posters`).
    - Insertion evenement en base `events` avec `status = draft` et `image_url` public.
  - Verification technique : lint/build OK.

- **Étape 3.2 : Tableau de bord de l’organisateur**
  - Description : Vue listant les événements de l’organisateur avec nombre de tickets vendus, fonds générés (part organisateur), statut.
  - Statut : Terminé
  - Livrables :
    - API `GET /api/organizer/dashboard` sur `web/src/app/api/organizer/dashboard/route.ts`.
    - Aggregation des metriques par evenement : tickets vendus (`paid`/`scanned`), fonds organisateur (somme `transactions.organizer_amount` en `success`).
    - Statut d'affichage calcule (`En cours` / `Termine`) base sur la date de fin effective.
    - UI dashboard `web/src/components/organizer/events-overview.tsx` integree dans `web/src/components/organizer/organizer-dashboard-content.tsx`.
    - Rafraichissement automatique des metriques apres creation d'un evenement.
  - Verification technique : lint/build OK.

- **Étape 3.3 : Ajout de Scanneurs (Staff)**
  - Description : Fonctionnalité d’invitation par numéro pour ajouter un Scanneur à un événement via la table `EventScanners` (création de User invité si nécessaire).
  - Statut : Terminé
  - Livrables :
    - API `POST /api/organizer/scanners` : invitation par numero E.164, creation utilisateur `invited` si absent, ajout role `scanner` si present, liaison `event_scanners`.
    - API `GET /api/organizer/scanners?eventId=...` : liste des scanneurs assignes a un evenement.
    - UI `web/src/components/organizer/scanner-management.tsx` integree au dashboard organisateur.
  - Regles appliquees :
    - Verification que l'evenement appartient bien a l'organisateur connecte.
    - Un scanneur peut etre assigne a plusieurs evenements.
    - Le role scanneur ne donne pas acces aux metriques financieres (route dediee scanner sans donnees fonds).
  - Verification technique : lint/build OK.

---

## Phase 4 : Achat de Ticket et Paiement

- **Étape 4.1 : Vue de l’événement et bouton d’achat**
  - Description : Page de détails d’un événement côté Acheteur avec bouton "Acheter un ticket" et modale demandant le numéro Orange Money.
  - Statut : Terminé
  - Livrables :
    - Catalogue acheteur + detail evenement implemente sur `web/src/app/buyer/page.tsx` et `web/src/components/buyer/event-catalog.tsx`.
    - Bouton `Acheter un ticket` ouvre une modale Orange Money.
    - Modale affiche le prix exact de l'evenement selectionne et demande le numero Orange Money.
    - Endpoint catalogue public `GET /api/events` ajoute sur `web/src/app/api/events/route.ts`.
  - Verification technique : lint/build OK.

- **Étape 4.2 : Initialisation du paiement Orange Money**
  - Description : Logique frontend + backend pour créer une `Transaction` en `pending` avec calcul des montants (total, 10 % commission, 90 % organisateur) et appel à l’API Orange Money (BF).
  - Statut : Terminé
  - Livrables :
    - Service `OrangeMoneyService` (`web/src/lib/orange-money.ts`) avec OAuth2 token + initiation paiement.
    - API `POST /api/pay/initiate` (`web/src/app/api/pay/initiate/route.ts`) :
      - validation `eventId`/`buyerPhone`,
      - creation `tickets` + `transactions` en `pending`,
      - calcul commission applique (`round(total*0.10)`),
      - appel Orange Money initiation.
    - UI acheteur connectee: modale paiement sur `web/src/components/buyer/event-catalog.tsx`.

- **Étape 4.3 : Saisie OTP et validation Orange Money**
  - Description : Écran de saisie du code OTP, envoi de ce code au backend, appel API Orange Money, mise à jour des statuts `Transactions` et `Tickets`.
  - Statut : Terminé
  - Livrables :
    - API `POST /api/pay/verify` (`web/src/app/api/pay/verify/route.ts`) : verification OTP Orange Money.
    - Webhook Orange `POST /api/webhooks/orange` (`web/src/app/api/webhooks/orange/route.ts`) avec securite signature HMAC ou allowlist IP.
    - Workflow centralise de finalisation paiement (`web/src/lib/payments/payment-workflow.ts`) pour mises a jour `transactions` + `tickets`.
    - Gestion des echec Orange (`markTransactionFailed`) et gestion idempotente webhook/verify.

---

## Phase 5 : Génération et Livraison du QR Code

- **Étape 5.1 : Génération sécurisée du QR Code**
  - Description : Fonction backend déclenchée à la transition `success` d’une transaction pour générer un `qr_code_hash` et le stocker dans `Tickets`.
  - Statut : Terminé
  - Livrables :
    - `qr_code_hash` genere uniquement sur succes paiement dans `finalizeSuccessfulPayment`.
    - Endpoint image QR `GET /api/qr/[ticketId]` (`web/src/app/api/qr/[ticketId]/route.ts`).

- **Étape 5.2 : Envoi par WhatsApp**
  - Description : Intégration API Wasender pour envoyer via WhatsApp un message de remerciement et le QR Code (image générée à la volée) au numéro de l’acheteur.
  - Statut : Terminé
  - Livrables :
    - Extension service `web/src/lib/wasender.ts` avec `sendTicketWhatsApp`.
    - Envoi automatique WhatsApp apres succes paiement (verify/webhook) avec lien QR et hash ticket.

---

## Phase 6 : Système de Scan (Contrôle d’accès)

- **Étape 6.1 : Interface de Scan (Caméra)**
  - Description : Interface PWA pour Scanneur/Organisateur qui accède à la caméra et lit les QR Codes.
  - Statut : À faire

- **Étape 6.2 : Logique de validation du Scan (En ligne)**
  - Description : Endpoint backend qui vérifie l’appartenance du ticket à l’événement, le statut `paid` et non `scanned`, puis met à jour en `scanned` et renvoie le bon message (vert/rouge).
  - Statut : À faire

---

## Phase 7 : Séquestre et Reversement (Admin)

- **Étape 7.1 : Tableau de bord de clôture (Admin)**
  - Description : Vue Admin listant les événements terminés, les montants séquestrés à reverser (somme des `organizer_amount` des tickets `paid`/`scanned`) et l’historique des demandes de payout (`Payouts`).
  - Statut : À faire

- **Étape 7.2 : Demandes de reversement (Organisateur)**
  - Description : Bouton "Demander le reversement" côté Organisateur qui crée une entrée `Payouts` avec `status = pending`.
  - Statut : À faire

- **Étape 7.3 : Traitement des reversements (Admin)**
  - Description : Processus où l’Admin marque un payout comme `paid` une fois le virement manuel effectué, en remplissant `paid_at`.
  - Statut : À faire


---

## Mise a jour produit - Paiement USSD manuel (MVP)

Decision metier appliquee:
- Le flux Orange Money API directe est abandonne pour le MVP.
- Le flux officiel est maintenant: paiement USSD assiste + validation manuelle admin.

Etat d'implementation:
- API acheteur: `POST /api/payments/initiate` cree transaction/ticket en `pending`.
- Notification WhatsApp client envoyee apres initiation.
- Notification WhatsApp admin envoyee si `ADMIN_ALERT_PHONE` est configure.
- Ecran attente acheteur: `/buyer/payment-pending`.
- API admin: `GET /api/admin/payments/pending`, `POST /api/admin/payments/validate`, `POST /api/admin/payments/reject`.
- Page admin de validation: `/admin/validate-payments`.
- Validation admin -> transaction `success`, ticket `paid`, QR genere + WhatsApp ticket.
- Rejet admin -> transaction `failed`, ticket `cancelled`.
- Routes OM direct supprimees: `/api/pay/*`, `/api/webhooks/orange`, `src/lib/orange-money.ts`.

Verification technique:
- `npm run lint` OK
- `npm run build` OK

## Mise a jour execution - Phase 6.1

- Etape 6.1 (Interface de Scan Camera): **Termine**
- Livrables implementes:
  - `web/src/components/scanner/scanner-camera-panel.tsx`
  - `web/src/app/scanner/scan/page.tsx`
- Capacites livrees:
  - Demande de permission camera (getUserMedia)
  - Affichage flux video en direct
  - Boutons: activer, couper, basculer camera avant/arriere
  - Restriction d'acces UI aux roles `scanner`, `organizer`, `admin`
- Verification technique:
  - `npm run lint` OK
  - `npm run build` OK
- Suite logique: etape 6.2 (validation QR en ligne + statut ticket).

## Mise a jour execution - Phase 6.2

- Etape 6.2 (Validation scan en ligne): **Termine**
- APIs ajoutees:
  - `web/src/app/api/scanner/events/route.ts`
  - `web/src/app/api/scanner/validate/route.ts`
- Regles backend implementees:
  - verification droits scanner/organizer/admin
  - verification appartenance evenement (assignment scanner ou ownership organizer)
  - controle ticket par `qr_code_hash` + evenement
  - cas metier couverts: ticket introuvable, mauvais evenement, deja scanne, non paye, valide
  - sur succes: `tickets.status` passe a `scanned` + `scanned_at` renseigne
- UI scanneur mise a jour:
  - `web/src/components/scanner/scanner-camera-panel.tsx`
  - selection evenement + saisie hash ticket + action "Valider le scan"
  - retour visuel vert (valide) / rouge (invalide)
- Verification technique:
  - `npm run lint` OK
  - `npm run build` OK
- Suite logique: Phase 7.1 (dashboard admin de cloture et montant a reverser).

## Mise a jour execution - Phase 7.1

- Etape 7.1 (Dashboard admin de cloture): **Termine**
- API ajoutee:
  - `web/src/app/api/admin/closure/route.ts`
- Fonctionnalites backend livrees:
  - calcul des evenements termines avec regle `effective_end_at` (`end_date` sinon `date + 24h`)
  - calcul des fonds sequestrés par evenement (somme `transactions.organizer_amount` en `success` liees a tickets `paid/scanned`)
  - recuperation historique des demandes `payouts`
  - agregats globaux: total sequestre et total reversements en attente
- UI admin livree:
  - `web/src/components/admin/closure-dashboard-panel.tsx`
  - integration dans `web/src/app/admin/dashboard/page.tsx`
  - tableaux: montants a reverser par evenement + historique payouts
  - securisation page admin via `requireAdminServerSession`
- Verification technique:
  - `npm run lint` OK
  - `npm run build` OK
- Suite logique: phase 7.2 (demande de reversement cote organisateur).

## Mise a jour execution - Phase 7.2

- Etape 7.2 (Demande de reversement organisateur): **Termine**
- API ajoutee:
  - `web/src/app/api/organizer/payouts/route.ts` (`POST`)
- Regles backend implementees:
  - verification session + role organizer/admin
  - verification proprietaire evenement (sauf admin)
  - verification evenement termine (`end_date` sinon `date + 24h`)
  - calcul montant demandable = fonds sequestres - reversements pending - reversements paid
  - creation `payout` avec `status = pending`
- Evolutions dashboard organisateur:
  - `web/src/app/api/organizer/dashboard/route.ts` enrichi avec:
    - `payoutPendingAmount`, `payoutPaidAmount`, `payoutRequestableAmount`, `canRequestPayout`
  - `web/src/components/organizer/events-overview.tsx`:
    - bouton `Demander reversement` par evenement eligible
    - affichage montants reversement (en attente/deja reverse/disponible)
  - `web/src/components/organizer/organizer-dashboard-content.tsx`:
    - refresh auto apres creation demande
- Verification technique:
  - `npm run lint` OK
  - `npm run build` OK
- Suite logique: phase 7.3 (traitement admin des reversements en `paid`).
