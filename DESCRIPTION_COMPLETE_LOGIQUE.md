# NeoTicket — Description Complète de la Logique du Site

**Version** : MVP  
**Date** : Mars 2026  
**Stack** : Next.js 16 (PWA) + Supabase (Postgres + Storage) + Wasender (WhatsApp) + Tailwind CSS 4

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Rôles utilisateurs](#2-rôles-utilisateurs)
3. [Authentification OTP](#3-authentification-otp)
4. [Gestion des événements](#4-gestion-des-événements)
5. [Système de tarification](#5-système-de-tarification)
6. [Flux d'achat et paiement](#6-flux-dachat-et-paiement)
7. [Génération et livraison du QR Code](#7-génération-et-livraison-du-qr-code)
8. [Système de scan (contrôle d'accès)](#8-système-de-scan-contrôle-daccès)
9. [Tableau de bord organisateur](#9-tableau-de-bord-organisateur)
10. [Administration plateforme](#10-administration-plateforme)
11. [Séquestre et reversements (Payouts)](#11-séquestre-et-reversements-payouts)
12. [Notifications WhatsApp](#12-notifications-whatsapp)
13. [Structure de la base de données](#13-structure-de-la-base-de-données)
14. [Arborescence des fichiers clés](#14-arborescence-des-fichiers-clés)
15. [Variables d'environnement](#15-variables-denvironnement)

---

## 1. Vue d'ensemble

NeoTicket est une **plateforme de billetterie mobile-first** (PWA) ciblant le **Burkina Faso**. Elle permet :

- Aux **organisateurs** de créer des événements et vendre des tickets.
- Aux **acheteurs** de payer via **Orange Money (USSD)** et recevoir un **QR Code par WhatsApp**.
- Aux **scanneurs** de valider les entrées via la caméra du téléphone.
- À l'**administrateur** de valider les paiements manuellement et gérer les reversements.

**Modèle économique** : Commission fixe de **10%** prélevée sur chaque vente.

**Monnaie** : FCFA (XOF). **Locale** : Français. **Fuseau** : `Africa/Ouagadougou`.

---

## 2. Rôles utilisateurs

| Rôle | Description | Route par défaut |
|------|-------------|-----------------|
| `buyer` | Achète des tickets, consulte ses billets | `/buyer` |
| `organizer` | Crée des événements, suit les ventes, demande les reversements | `/organizer/dashboard` |
| `scanner` | Scanne les QR Codes pour valider les entrées | `/scanner/scan` |
| `admin` | Valide les paiements, gère les reversements, configure la plateforme | `/admin/dashboard` |

**Règles** :
- Un utilisateur peut cumuler **plusieurs rôles** (stockés dans un tableau JSON `users.roles`).
- Par défaut, tout nouveau compte reçoit les rôles `["buyer", "organizer"]`.
- Le rôle de **plus haute priorité** détermine la redirection après connexion (`admin > scanner > organizer > buyer`).
- L'utilisateur peut changer de rôle actif depuis le menu profil (switch de rôle).

---

## 3. Authentification OTP

### Principe
Pas de mot de passe. L'utilisateur se connecte avec son **numéro de téléphone** et reçoit un **code OTP à 6 chiffres par WhatsApp** (via Wasender). Si le numéro n'existe pas en base, le compte est créé automatiquement.

### Flux détaillé

```
┌─────────────┐     POST /api/auth/send-otp      ┌──────────────┐
│  Formulaire  │ ──────────────────────────────▶  │   Serveur     │
│  Numéro +226 │                                  │  - Valide E.164│
└─────────────┘                                   │  - Rate-limit  │
                                                  │  - Génère OTP  │
                                                  │  - Envoi WhatsApp│
                                                  │  - Cookie signé │
                                                  └──────────────┘
                                                         │
┌─────────────┐     POST /api/auth/verify-otp     ┌──────────────┐
│  Saisie OTP  │ ──────────────────────────────▶  │   Serveur     │
│  6 chiffres  │                                  │  - Vérifie cookie│
└─────────────┘                                   │  - Compare code │
                                                  │  - Upsert user  │
                                                  │  - Session 7j   │
                                                  │  - Redirige     │
                                                  └──────────────┘
```

### Sécurité OTP
| Paramètre | Valeur |
|-----------|--------|
| Durée de vie OTP | 5 minutes |
| Tentatives max avant invalidation | 5 |
| Cooldown entre envois | 60 secondes |
| Envois max par heure par numéro | 7 |

### Mécanisme technique
- **Cookie OTP** : cookie `httpOnly` signé HMAC-SHA256 contenant le hash du code, le numéro, le compteur de tentatives et l'expiration.
- **Cookie de session** : cookie `httpOnly` signé HMAC-SHA256 (7 jours) contenant `userId`, `phone`, `displayName`, `roles`.
- **Rate-limiting** : en mémoire (Map par numéro de téléphone).
- **Comparaison OTP** : timing-safe pour éviter les attaques par timing.

### Fichiers impliqués
- `web/src/app/api/auth/send-otp/route.ts`
- `web/src/app/api/auth/verify-otp/route.ts`
- `web/src/app/api/auth/me/route.ts`
- `web/src/app/api/auth/logout/route.ts`
- `web/src/app/api/auth/profile/route.ts`
- `web/src/lib/auth/otp.ts` — Génération et vérification OTP
- `web/src/lib/auth/session.ts` — Tokens de session
- `web/src/lib/auth/rate-limit.ts` — Rate-limiting
- `web/src/lib/auth/phone.ts` — Normalisation E.164
- `web/src/lib/auth/roles.ts` — Gestion des rôles et redirections
- `web/src/components/auth/login-phone-form.tsx` — UI du formulaire

---

## 4. Gestion des événements

### Création d'événement (Organisateur)

L'organisateur remplit un formulaire en 3 sections :

1. **Quoi** : Titre, description
2. **Où & Quand** : Ville (pilules rapides : Ouagadougou, Bobo-Dioulasso, Koudougou + saisie libre), lieu (venue), date de début, date de fin (optionnelle)
3. **Combien** : Prix officiel, prix organisateur, numéro Orange Money de réception (`om_receiver_phone`)

**Upload d'image** : L'affiche est uploadée vers Supabase Storage (bucket `event-posters`) et l'URL publique est stockée dans `events.image_url`.

**Statut initial** : `published` (l'événement est immédiatement visible).

### Édition d'événement

L'organisateur peut modifier tous les champs d'un événement existant, y compris changer le statut (`draft`, `published`, `ended`, `cancelled`). Seul le propriétaire ou un admin peut modifier un événement.

### Cycle de vie des statuts

```
draft ──▶ published ──▶ ended
                    ──▶ cancelled
```

### Fichiers impliqués
- `web/src/app/api/organizer/events/route.ts` — POST (création)
- `web/src/app/api/organizer/events/[id]/route.ts` — GET/PATCH (lecture/édition)
- `web/src/app/api/events/route.ts` — GET public (catalogue)
- `web/src/components/organizer/create-event-form.tsx`
- `web/src/components/organizer/edit-event-form.tsx`

---

## 5. Système de tarification

NeoTicket utilise un système de **tarification empilée à 3 niveaux** :

```
Prix officiel ──(remise organisateur)──▶ Prix organisateur ──(remise plateforme)──▶ Prix final client
```

### Calculs

| Donnée | Formule |
|--------|---------|
| Remise organisateur (%) | `(official - organizer) / official × 100` |
| Remise plateforme (%) | Configurée par l'admin (table `platform_settings`) |
| Prix final client | `Math.round(organizer_price × (1 - platform_discount / 100))` |
| Commission plateforme | `round(prix_final × 0.10)` |
| Part organisateur | `prix_final - commission` |

### Exemple concret

| Champ | Valeur |
|-------|--------|
| Prix officiel | 5 000 FCFA |
| Prix organisateur | 4 000 FCFA (remise orga : 20%) |
| Remise plateforme | 5% |
| Prix final client | `round(4 000 × 0.95)` = **3 800 FCFA** |
| Commission (10%) | `round(3 800 × 0.10)` = **380 FCFA** |
| Part organisateur | 3 800 - 380 = **3 420 FCFA** |

### Affichage prix

Sur la page de détail d'un événement, le client voit :
- Le prix officiel barré
- Le label "-X% Organisateur" si remise orga
- Le label "-Y% Promo plateforme" si remise plateforme
- Le **prix final** mis en avant

### Fichiers impliqués
- `web/src/lib/pricing.ts` — Moteur de calcul
- `web/src/app/api/admin/platform-discount/route.ts` — GET/PUT remise plateforme

---

## 6. Flux d'achat et paiement

### Flux USSD assisté + validation manuelle (MVP)

Le paiement **ne passe pas** par l'API Orange Money directement. L'acheteur compose lui-même le code USSD, et l'administrateur valide manuellement.

```
┌────────────┐         ┌────────────┐          ┌────────────┐
│  ACHETEUR   │         │   SERVEUR   │          │   ADMIN     │
└────────────┘         └────────────┘          └────────────┘
      │                       │                       │
      │  1. Clique "Acheter"  │                       │
      │  Saisit nom + tel OM  │                       │
      │──────────────────────▶│                       │
      │                       │  2. Crée ticket +     │
      │                       │     transaction       │
      │                       │     (status: pending)  │
      │                       │                       │
      │                       │  3. Envoie WhatsApp   │
      │                       │     au client (USSD)  │
      │  ◀────────────────────│                       │
      │                       │  4. Envoie alerte     │
      │                       │     WhatsApp admin    │
      │                       │──────────────────────▶│
      │                       │                       │
      │  5. Compose USSD      │                       │
      │  *144*2*1*XXXX*YYYY#  │                       │
      │  (sur son téléphone)  │                       │
      │                       │                       │
      │  6. Redirigé vers     │                       │
      │  /buyer/payment-pending│                      │
      │                       │                       │
      │                       │  7. Admin vérifie     │
      │                       │     les SMS Orange    │
      │                       │  ◀────────────────────│
      │                       │                       │
      │                       │  8a. VALIDÉ :         │
      │                       │  tx → success         │
      │                       │  ticket → paid        │
      │                       │  QR généré + envoyé   │
      │  ◀────────────────────│                       │
      │  (reçoit QR WhatsApp) │                       │
      │                       │                       │
      │                       │  8b. REJETÉ :         │
      │                       │  tx → failed          │
      │                       │  ticket → cancelled   │
      │  ◀────────────────────│                       │
      │  (message d'échec)    │                       │
```

### Détail des étapes

1. **Initiation** (`POST /api/payments/initiate`) :
   - Vérifie que l'événement est `published` et la date n'est pas passée.
   - Crée un `ticket` en `pending` et une `transaction` en `pending`.
   - Calcule les montants : `commission = round(total × 0.10)`, `organizer_amount = total - commission`.
   - Envoie un WhatsApp au client avec le code USSD à composer.
   - Envoie une alerte WhatsApp à l'admin (`ADMIN_ALERT_PHONE`).
   - Déclenche l'appel USSD via le protocole `tel:` sur mobile.
   - Redirige vers `/buyer/payment-pending`.

2. **Page d'attente** (`/buyer/payment-pending`) :
   - Affiche "Paiement en cours de traitement" avec animation spinner.
   - Affiche le numéro de support pour assistance.

3. **Validation admin** (`POST /api/admin/payments/validate`) :
   - Met la transaction en `success` et le ticket en `paid`.
   - Génère un `qr_code_hash` (UUID unique).
   - Envoie l'image QR par WhatsApp au client (avec retry + fallback texte).
   - Notifie l'organisateur de la vente.

4. **Rejet admin** (`POST /api/admin/payments/reject`) :
   - Met la transaction en `failed` et le ticket en `cancelled`.
   - Envoie un message de rejet au client par WhatsApp avec le numéro de support.

### Fichiers impliqués
- `web/src/app/api/payments/initiate/route.ts`
- `web/src/app/api/admin/payments/pending/route.ts`
- `web/src/app/api/admin/payments/validate/route.ts`
- `web/src/app/api/admin/payments/reject/route.ts`
- `web/src/lib/payments/payment-workflow.ts`
- `web/src/components/buyer/buy-ticket-button.tsx`
- `web/src/app/buyer/payment-pending/page.tsx`

---

## 7. Génération et livraison du QR Code

### Génération
- Le `qr_code_hash` est un **UUID v4** généré uniquement lors de la validation réussie du paiement.
- Stocké dans `tickets.qr_code_hash`.
- **Aucune image QR n'est stockée** : elle est générée à la volée.

### Endpoint image
`GET /api/qr/[ticketId]` :
- Récupère le `qr_code_hash` du ticket.
- Génère un QR Code PNG via la librairie `qrcode`.
- Retourne l'image en `image/png`.

### Livraison
- Après validation du paiement, l'image QR est envoyée **par WhatsApp** au numéro de l'acheteur via Wasender.
- **Mécanisme de résilience** : si l'envoi d'image échoue, un message texte de secours est envoyé avec le lien vers le QR.

### Visualisation in-app
- Les tickets sont consultables dans le profil de l'utilisateur (onglet Profil > section "Mes billets").
- Clic sur un ticket → modale affichant le QR Code généré côté client à partir du hash.

---

## 8. Système de scan (contrôle d'accès)

### Interface scanner
- Page `/scanner/scan` — accessible aux rôles `scanner`, `organizer`, `admin`.
- **Sélecteur d'événement** : dropdown pour choisir l'événement à scanner.
- **Caméra** : utilise la librairie `html5-qrcode` pour ouvrir la caméra et lire les QR Codes.
- **Compteur en temps réel** : affiche `X/Y scannés` (`GET /api/scanner/stats`).

### Logique de validation (`POST /api/scanner/validate`)

Le serveur reçoit le `qr_code_hash` scanné et l'`event_id`, puis évalue :

| Cas | Condition | Résultat UI |
|-----|-----------|-------------|
| ✅ Valide | Ticket trouvé, bon événement, status `paid` | Overlay **vert** + bip sonore + "Validé" |
| ❌ Déjà scanné | Ticket status `scanned` | Overlay **rouge** + "Ce code a déjà été validé" + horodatage du scan |
| ❌ Mauvais événement | Ticket existe mais lié à un autre event | Overlay **rouge** + "Ce code n'est pas lié à cet événement" |
| ❌ Non payé | Ticket status ≠ `paid` | Overlay **rouge** + "Ce ticket n'est pas payé" |
| ❌ Introuvable | Aucun ticket avec ce hash | Overlay **rouge** + "Code invalide" |

Quand un ticket est validé, son statut passe de `paid` à `scanned` avec horodatage `scanned_at`.

### Gestion des scanneurs
- L'organisateur invite des scanneurs par numéro de téléphone (`POST /api/organizer/scanners`).
- Si le numéro n'existe pas en base, un utilisateur est créé avec `status = invited` et `roles = ["scanner"]`.
- Un scanneur peut être assigné à plusieurs événements.
- Le scanneur n'a **aucun accès aux données financières**.

### Événements visibles par le scanner (`GET /api/scanner/events`)
- `admin` → tous les événements publiés
- `organizer` → ses propres événements
- `scanner` → événements assignés via la table `event_scanners`

### Fichiers impliqués
- `web/src/app/api/scanner/validate/route.ts`
- `web/src/app/api/scanner/events/route.ts`
- `web/src/app/api/scanner/stats/route.ts`
- `web/src/app/api/organizer/scanners/route.ts`
- `web/src/components/scanner/scanner-camera-panel.tsx`
- `web/src/components/organizer/scanner-management.tsx`
- `web/src/app/scanner/scan/page.tsx`

---

## 9. Tableau de bord organisateur

### Page dashboard (`/organizer/dashboard`)

Affiche pour l'organisateur connecté :

- **Liste de ses événements** avec pour chacun :
  - Nombre de tickets vendus (payés + scannés)
  - Fonds générés (somme des `organizer_amount` des transactions en `success`)
  - Statut de l'événement (en cours / terminé)
  - Statut des reversements (payé / en attente / demandable)
  - Bouton modifier → `/organizer/events/[id]/edit`
  - Bouton demander un reversement → modale payout

- **Gestion des scanneurs** : sélecteur d'événement + ajout par numéro + liste des scanneurs assignés.

- **Bouton "+ Nouvel événement"** → `/organizer/new`

### API dashboard (`GET /api/organizer/dashboard`)
Agrège les métriques par événement :
- Tickets : total, payés, scannés
- Fonds : somme `organizer_amount` des transactions `success`
- Payouts : sommes pending, paid, rejected + montant restant demandable
- Statut cycle de vie : basé sur la date effective de fin

### Fichiers impliqués
- `web/src/app/api/organizer/dashboard/route.ts`
- `web/src/components/organizer/organizer-dashboard-content.tsx`
- `web/src/components/organizer/events-overview.tsx`
- `web/src/app/organizer/dashboard/page.tsx`

---

## 10. Administration plateforme

### Dashboard admin (`/admin/dashboard`)

3 sections :

1. **Remise plateforme** (`PlatformDiscountPanel`) :
   - Champ numérique pour configurer le % de remise plateforme globale (0–100%).
   - Stocké dans la table `platform_settings` (singleton id=1).
   - Fallback vers la variable d'env `NEXT_PUBLIC_PLATFORM_DISCOUNT_PERCENT`.

2. **Tableau de clôture** (`ClosureDashboardPanel`) :
   - Cartes résumé : Total séquestre, Reversements en attente, Gain plateforme
   - Tableau des événements avec montants séquestrés par événement
   - Historique des demandes de payout avec boutons Valider/Rejeter

3. **Lien vers la validation des paiements** → `/admin/validate-payments`

### Validation des paiements (`/admin/validate-payments`)

- Tableau listant toutes les transactions en `pending`.
- Colonnes : nom acheteur, téléphone, événement, montant.
- Boutons **Valider** (vert) et **Rejeter** (rouge) par ligne.
- Appelle `POST /api/admin/payments/validate` ou `/reject`.

### Fichiers impliqués
- `web/src/app/admin/dashboard/page.tsx`
- `web/src/app/admin/validate-payments/page.tsx`
- `web/src/components/admin/validate-payments-panel.tsx`
- `web/src/components/admin/closure-dashboard-panel.tsx`
- `web/src/components/admin/platform-discount-panel.tsx`
- `web/src/app/api/admin/payments/pending/route.ts`
- `web/src/app/api/admin/payments/validate/route.ts`
- `web/src/app/api/admin/payments/reject/route.ts`
- `web/src/app/api/admin/closure/route.ts`
- `web/src/app/api/admin/platform-discount/route.ts`
- `web/src/app/api/admin/payouts/validate/route.ts`
- `web/src/app/api/admin/payouts/reject/route.ts`

---

## 11. Séquestre et reversements (Payouts)

### Principe
L'argent est **séquestré** sur le compte marchand de la plateforme. L'organisateur ne peut demander un reversement qu'**après la fin de l'événement**.

### Règle de fin d'événement
- Si `end_date` existe → l'événement est terminé quand `end_date` est passée.
- Si `end_date` est absent → fallback `date + 24h`.

### Flux de reversement

```
Organisateur                    Admin
     │                            │
     │  Demande payout            │
     │  (montant + nom + tel OM)  │
     │───────────────────────────▶│
     │                            │  Vérifie et effectue
     │                            │  le virement manuellement
     │                            │
     │                            │  Valide le payout
     │  ◀────────────────────────│  (status → paid)
     │                            │
     │                     OU     │
     │                            │  Rejette le payout
     │  ◀────────────────────────│  (status → rejected + raison)
```

### Calcul du montant demandable
```
requestable = escrow_total − payouts_pending − payouts_paid
```
Où `escrow_total` = somme des `organizer_amount` de toutes les transactions `success` de l'événement.

### API
- `POST /api/organizer/payouts` — Créer une demande (montant, `receiver_name`, `receiver_phone` E.164)
- `POST /api/admin/payouts/validate` — Valider (status → `paid`, `paid_at` rempli)
- `POST /api/admin/payouts/reject` — Rejeter (status → `rejected`, raison enregistrée)

---

## 12. Notifications WhatsApp

Toutes les notifications passent par l'API **Wasender**.

| Événement | Destinataire | Contenu |
|-----------|-------------|---------|
| Envoi OTP | Utilisateur | Code à 6 chiffres |
| Initiation achat | Acheteur | Code USSD à composer + instructions |
| Initiation achat | Admin | Alerte nouveau paiement en attente |
| Validation paiement | Acheteur | Image QR Code + message de remerciement |
| Validation paiement | Organisateur | Notification de vente (titre événement + montant) |
| Rejet paiement | Acheteur | Message d'échec + numéro de support |

### Résilience
- Si l'envoi d'image QR échoue → retry automatique.
- Si le retry échoue → envoi d'un message texte avec le lien vers le QR en fallback.

### Fichiers
- `web/src/lib/wasender.ts` — Fonctions `sendWhatsAppTextMessage`, `sendWhatsAppImageMessage`, `sendOtpWhatsApp`, `sendTicketWhatsApp`

---

## 13. Structure de la base de données

### Tables

| Table | Description |
|-------|-------------|
| `users` | Comptes utilisateurs (phone E.164, roles[], display_name, status) |
| `events` | Événements (titre, dates, prix, image, ville, lieu, om_receiver_phone, statut) |
| `tickets` | Billets (event_id, buyer_id, buyer_phone, qr_code_hash, statut) |
| `transactions` | Paiements (ticket_id, event_id, montants, statut, colonnes Orange Money) |
| `event_scanners` | Liaison scanneur ↔ événement |
| `payouts` | Demandes de reversement (event_id, montant, statut, receiver_name/phone) |
| `platform_settings` | Paramètres globaux (platform_discount_percent) |

### Enums

| Enum | Valeurs |
|------|---------|
| `user_status` | `active`, `invited`, `blocked` |
| `event_status` | `draft`, `published`, `ended`, `cancelled` |
| `ticket_status` | `pending`, `paid`, `scanned`, `cancelled` |
| `transaction_status` | `pending`, `success`, `failed` |
| `payout_status` | `pending`, `paid`, `rejected` |

### Contraintes clés
- Téléphone : format E.164 (`^\+[1-9][0-9]{6,14}$`)
- Prix : `official_price >= organizer_price > 0`
- Commission : `commission_amount = round(total_amount × 0.10)` (vérifiée en base)
- Intégrité montants : `total_amount = commission_amount + organizer_amount`
- Dates : `end_date >= date` (quand end_date n'est pas null)
- Lieu : 1–200 caractères
- Ville : 2–120 caractères
- Nom d'affichage : 2–80 caractères

### Vue utilitaire
- `v_events_with_effective_end` : calcule la date effective de fin (`end_date` ou `date + 24h`)

### Migrations (ordre chronologique)
1. `20260307_120000_init_schema.sql` — Schéma initial complet
2. `20260307_230000_orange_money_schema_phase.sql` — Colonnes Orange Money + traçabilité
3. `20260308_030000_set_admin_phone_22656636039.sql` — Création compte admin
4. `20260308_040000_default_users_buyer_organizer.sql` — Rôles par défaut buyer+organizer
5. `20260308_050000_publish_existing_draft_events.sql` — Publication des drafts existants
6. `20260308_060000_add_users_display_name.sql` — Ajout display_name
7. `20260308_070000_add_events_city.sql` — Ajout champ ville
8. `20260308_080000_add_stacked_promotions.sql` — Prix empilés + platform_settings
9. `20260308_090000_payout_receiver_and_rejected_status.sql` — Infos bénéficiaire payout + statut rejeté
10. `20260308_100000_add_venue_and_om_phone.sql` — Ajout lieu et téléphone OM organisateur

---

## 14. Arborescence des fichiers clés

```
web/src/
├── app/
│   ├── layout.tsx                          # Layout racine (AuthProvider, GlobalPlatformNav, PWA)
│   ├── page.tsx                            # Page d'accueil (catalogue événements)
│   ├── manifest.ts                         # Manifest PWA
│   ├── globals.css                         # Styles globaux + Tailwind
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── send-otp/route.ts           # Envoi OTP
│   │   │   ├── verify-otp/route.ts         # Vérification OTP
│   │   │   ├── me/route.ts                 # Session utilisateur
│   │   │   ├── logout/route.ts             # Déconnexion
│   │   │   └── profile/route.ts            # Mise à jour profil
│   │   ├── events/route.ts                 # Catalogue public
│   │   ├── payments/
│   │   │   └── initiate/route.ts           # Initier un achat
│   │   ├── admin/
│   │   │   ├── payments/pending/route.ts   # Paiements en attente
│   │   │   ├── payments/validate/route.ts  # Valider un paiement
│   │   │   ├── payments/reject/route.ts    # Rejeter un paiement
│   │   │   ├── closure/route.ts            # Tableau de clôture
│   │   │   ├── platform-discount/route.ts  # Config remise plateforme
│   │   │   ├── payouts/validate/route.ts   # Valider un payout
│   │   │   └── payouts/reject/route.ts     # Rejeter un payout
│   │   ├── organizer/
│   │   │   ├── events/route.ts             # Créer événement
│   │   │   ├── events/[id]/route.ts        # Lire/modifier événement
│   │   │   ├── dashboard/route.ts          # Métriques dashboard
│   │   │   ├── payouts/route.ts            # Demander un reversement
│   │   │   └── scanners/route.ts           # Gérer les scanneurs
│   │   ├── scanner/
│   │   │   ├── validate/route.ts           # Valider un scan QR
│   │   │   ├── events/route.ts             # Événements du scanneur
│   │   │   └── stats/route.ts              # Stats de scan
│   │   └── qr/[ticketId]/route.ts          # Image QR à la volée
│   │
│   ├── buyer/
│   │   ├── page.tsx                        # Catalogue acheteur
│   │   ├── payment-pending/page.tsx        # Page d'attente paiement
│   │   └── tickets/page.tsx                # Mes billets
│   ├── organizer/
│   │   ├── dashboard/page.tsx              # Dashboard organisateur
│   │   ├── new/page.tsx                    # Créer un événement
│   │   └── events/[id]/edit/page.tsx       # Modifier un événement
│   ├── scanner/
│   │   └── scan/page.tsx                   # Interface de scan
│   ├── admin/
│   │   ├── dashboard/page.tsx              # Dashboard admin
│   │   └── validate-payments/page.tsx      # Valider les paiements
│   └── events/
│       └── [id]/page.tsx                   # Détail d'un événement
│
├── components/
│   ├── auth/
│   │   └── login-phone-form.tsx            # Formulaire OTP 2 étapes
│   ├── app/
│   │   ├── auth-provider.tsx               # Contexte auth global
│   │   ├── global-platform-nav.tsx         # Barre de nav fixe en bas
│   │   ├── main-home-shell.tsx             # Shell principal (feed + profil)
│   │   ├── home-entry.tsx                  # Point d'entrée accueil
│   │   └── pwa-register.tsx                # Enregistrement service worker
│   ├── buyer/
│   │   ├── event-catalog.tsx               # Catalogue avec recherche/filtres
│   │   ├── buy-ticket-button.tsx           # Bouton + modale d'achat
│   │   └── event-page-actions.tsx          # Actions page événement (retour/partage)
│   ├── organizer/
│   │   ├── create-event-form.tsx           # Formulaire création événement
│   │   ├── edit-event-form.tsx             # Formulaire édition événement
│   │   ├── events-overview.tsx             # Vue événements + métriques
│   │   ├── organizer-dashboard-content.tsx # Contenu dashboard orga
│   │   └── scanner-management.tsx          # Gestion des scanneurs
│   ├── admin/
│   │   ├── validate-payments-panel.tsx     # Panel validation paiements
│   │   ├── closure-dashboard-panel.tsx     # Panel clôture/reversements
│   │   └── platform-discount-panel.tsx     # Panel config remise
│   └── scanner/
│       └── scanner-camera-panel.tsx        # Caméra + logique scan QR
│
├── lib/
│   ├── auth/
│   │   ├── constants.ts                    # Constantes auth (TTL, limites)
│   │   ├── phone.ts                        # Normalisation téléphone E.164
│   │   ├── otp.ts                          # Génération/vérification OTP
│   │   ├── rate-limit.ts                   # Rate-limiting en mémoire
│   │   ├── roles.ts                        # Rôles, priorités, routes
│   │   ├── session.ts                      # Tokens de session HMAC
│   │   ├── server-session.ts               # Extraction session côté serveur
│   │   └── admin-guard.ts                  # Guard admin
│   ├── payments/
│   │   └── payment-workflow.ts             # Finalisation/rejet paiement
│   ├── supabase/
│   │   ├── client.ts                       # Client Supabase navigateur
│   │   └── server.ts                       # Client Supabase serveur
│   ├── pricing.ts                          # Calculs de prix empilés
│   └── wasender.ts                         # API WhatsApp Wasender
│
└── public/
    └── sw.js                               # Service Worker PWA
```

---

## 15. Variables d'environnement

| Variable | Usage |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase (côté client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase (côté serveur) |
| `SUPABASE_STORAGE_EVENTS_BUCKET` | Nom du bucket Storage (défaut : `event-posters`) |
| `APP_SECRET` | Clé secrète pour signer les cookies HMAC-SHA256 |
| `WASENDER_API_KEY` | Clé API Wasender |
| `WASENDER_DEVICE_ID` | ID appareil Wasender |
| `NEXT_PUBLIC_OM_MERCHANT_NUMBER` | Numéro marchand Orange Money |
| `SUPPORT_PHONE` | Numéro de support (côté serveur) |
| `NEXT_PUBLIC_SUPPORT_PHONE` | Numéro de support (côté client) |
| `ADMIN_ALERT_PHONE` | Numéro admin pour les alertes WhatsApp |
| `NEXT_PUBLIC_PLATFORM_DISCOUNT_PERCENT` | Remise plateforme par défaut (fallback) |
| `NEXT_PUBLIC_APP_URL` | URL de base de l'application |
