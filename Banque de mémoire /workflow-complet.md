# NeoTicket — Description Complète du Workflow de la Plateforme

> Plateforme de billetterie mobile-first pour le marché ouest-africain (Burkina Faso).  
> Stack : **Next.js 16 (PWA)** + **Supabase (Postgres)** + **Tailwind CSS 4** + **TypeScript**  
> Monnaie : **FCFA (XOF)** — Locale : **français** — Fuseau : `Africa/Ouagadougou`

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Rôles utilisateurs](#2-rôles-utilisateurs)
3. [Flux d'authentification (OTP WhatsApp)](#3-flux-dauthentification-otp-whatsapp)
4. [Flux Organisateur — Création et gestion d'événement](#4-flux-organisateur--création-et-gestion-dévénement)
5. [Flux Acheteur — Découverte et achat de ticket](#5-flux-acheteur--découverte-et-achat-de-ticket)
6. [Flux de paiement USSD assisté + validation manuelle](#6-flux-de-paiement-ussd-assisté--validation-manuelle)
7. [Génération et livraison du QR Code](#7-génération-et-livraison-du-qr-code)
8. [Flux Scanner — Contrôle d'accès](#8-flux-scanner--contrôle-daccès)
9. [Flux Organisateur — Reversement (Payout)](#9-flux-organisateur--reversement-payout)
10. [Flux Admin — Gestion de la plateforme](#10-flux-admin--gestion-de-la-plateforme)
11. [Système de tarification (promotions empilées)](#11-système-de-tarification-promotions-empilées)
12. [Modèle de données](#12-modèle-de-données)
13. [Architecture technique et fichiers clés](#13-architecture-technique-et-fichiers-clés)

---

## 1. Vue d'ensemble

NeoTicket permet à des **organisateurs** de créer des événements et de vendre des tickets en ligne. Les **acheteurs** paient via **Orange Money (USSD)**, reçoivent leur **QR code par WhatsApp**, puis présentent ce QR à l'entrée de l'événement pour validation par un **scanneur**. Les fonds sont séquestrés sur le compte marchand de la plateforme et reversés à l'organisateur après la fin de l'événement, via validation manuelle par l'**admin**. La plateforme prélève une **commission de 10 %** sur chaque vente.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Acheteur   │     │ Organisateur │     │   Scanneur   │     │    Admin     │
│              │     │              │     │              │     │              │
│ • Découvre   │     │ • Crée       │     │ • Scanne QR  │     │ • Valide     │
│   événements │     │   événements │     │   à l'entrée │     │   paiements  │
│ • Achète     │     │ • Suit       │     │              │     │ • Gère       │
│   tickets    │     │   ventes     │     │              │     │   reversemts │
│ • Reçoit QR  │     │ • Demande    │     │              │     │ • Configure  │
│   WhatsApp   │     │   reversemts │     │              │     │   plateforme │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       └────────────────────┴────────────────────┴────────────────────┘
                              NeoTicket (PWA)
```

---

## 2. Rôles utilisateurs

| Rôle | Description | Routes principales |
|------|-------------|-------------------|
| **Acheteur (buyer)** | Consulte les événements, achète des tickets, reçoit le QR code par WhatsApp | `/` (feed), `/events/[id]`, `/buyer/tickets` |
| **Organisateur (organizer)** | Crée/édite des événements, suit les ventes et les fonds, invite des scanneurs, demande le reversement des fonds | `/organizer/dashboard`, `/organizer/new`, `/organizer/events/[id]/edit` |
| **Scanneur (scanner)** | Scanne les QR codes à l'entrée d'un événement pour valider les tickets | `/scanner/scan` |
| **Admin** | Valide les paiements en attente, gère le séquestre et les reversements, configure la remise plateforme | `/admin/dashboard`, `/admin/validate-payments` |

**Règles de rôles :**
- Un utilisateur peut cumuler plusieurs rôles (multi-rôles via `Users.roles[]`).
- À la création de compte, chaque utilisateur reçoit automatiquement les rôles `['buyer', 'organizer']`.
- Le rôle `scanner` est ajouté par invitation d'un organisateur.
- Le rôle `admin` est attribué manuellement en base de données.
- La redirection post-login se fait selon le rôle de priorité la plus haute : `admin > organizer > scanner > buyer`.

---

## 3. Flux d'authentification (OTP WhatsApp)

L'authentification se fait **sans mot de passe**, via un code OTP à 6 chiffres envoyé par WhatsApp (Wasender).

### Étapes détaillées

```
Utilisateur                    Frontend                   Backend                    WhatsApp (Wasender)
    │                             │                          │                              │
    │  1. Saisit numéro (8 chif) │                          │                              │
    │  + nom d'affichage         │                          │                              │
    │ ──────────────────────────>│                          │                              │
    │                             │  2. POST /api/auth/      │                              │
    │                             │     send-otp             │                              │
    │                             │ ────────────────────────>│                              │
    │                             │                          │  3. Normalise +226XXXXXXXX   │
    │                             │                          │     Vérifie rate-limit        │
    │                             │                          │     Génère OTP 6 chiffres     │
    │                             │                          │     Crée cookie HMAC signé    │
    │                             │                          │  4. Envoie OTP ──────────────>│
    │                             │                          │                              │
    │                             │  5. Cookie OTP httpOnly  │                              │
    │                             │ <────────────────────────│                              │
    │                             │                          │                              │
    │  6. Saisit code OTP        │                          │                              │
    │ ──────────────────────────>│                          │                              │
    │                             │  7. POST /api/auth/      │                              │
    │                             │     verify-otp           │                              │
    │                             │ ────────────────────────>│                              │
    │                             │                          │  8. Vérifie OTP + cookie      │
    │                             │                          │     Crée/met à jour User      │
    │                             │                          │     Crée cookie session 7j    │
    │                             │  9. Session active       │                              │
    │                             │ <────────────────────────│                              │
    │ 10. Redirigé selon rôle    │                          │                              │
    │ <──────────────────────────│                          │                              │
```

### Sécurité OTP
| Paramètre | Valeur |
|-----------|--------|
| TTL du code OTP | 5 minutes |
| Tentatives max de vérification | 5 (puis invalidation) |
| Cooldown de renvoi | 60 secondes |
| Limite de renvois | 7 par heure par numéro |
| Format téléphone | E.164 strict (`+226XXXXXXXX`) |
| Cookie OTP | `neoticket_otp_state` — httpOnly, signé HMAC-SHA256 |
| Cookie session | `neoticket_session` — httpOnly, signé HMAC-SHA256, TTL 7 jours |

### Fichiers impliqués
- `web/src/components/auth/login-phone-form.tsx` — Formulaire 2 étapes (numéro → OTP)
- `web/src/app/api/auth/send-otp/route.ts` — Envoi OTP
- `web/src/app/api/auth/verify-otp/route.ts` — Vérification OTP
- `web/src/app/api/auth/me/route.ts` — Récupération session
- `web/src/app/api/auth/logout/route.ts` — Déconnexion
- `web/src/lib/auth/` — Helpers (otp, session, phone, rate-limit, roles, constants)
- `web/src/lib/wasender.ts` — Envoi WhatsApp via API Wasender

---

## 4. Flux Organisateur — Création et gestion d'événement

### 4.1 Création d'événement

1. L'organisateur accède à `/organizer/new` ou via le dashboard `/organizer/dashboard`.
2. Il remplit un formulaire multi-sections :
   - **Section 1** : Titre, description, image (upload affiche)
   - **Section 2** : Ville (pills prédéfinies + saisie libre), lieu (venue), dates de début et fin
   - **Section 3** : Prix officiel, prix promotionnel organisateur, aperçu calcul commission, numéro OM de réception
3. L'image est uploadée vers **Supabase Storage** (bucket `event-posters`).
4. L'événement est inséré en base avec `status = 'published'`.
5. Le dashboard se rafraîchit automatiquement.

### 4.2 Modification d'événement

- Accessible via `/organizer/events/[id]/edit`.
- Tous les champs sont éditables (titre, description, ville, dates, prix, statut).
- Changement de statut possible : `draft → published → ended → cancelled`.
- Seul le propriétaire de l'événement (ou admin) peut modifier.

### 4.3 Dashboard organisateur

Le dashboard (`/organizer/dashboard`) affiche pour chaque événement :
- Nombre de tickets vendus (`paid` + `scanned`)
- Fonds organisateur (somme des `transactions.organizer_amount` en `success`)
- Montant reversement en attente / déjà reversé / demandable
- Statut de l'événement (En cours / Terminé)
- Bouton « Demander versement » si l'événement est terminé

### 4.4 Gestion des scanneurs (staff)

1. L'organisateur sélectionne un événement.
2. Il saisit le numéro de téléphone du scanneur à inviter.
3. Le backend :
   - Crée un utilisateur `invited` si le numéro n'existe pas.
   - Ajoute le rôle `scanner` si absent.
   - Crée une liaison dans `event_scanners`.
4. La liste des scanneurs assignés s'affiche sous le formulaire.

### Fichiers impliqués
- `web/src/components/organizer/create-event-form.tsx`
- `web/src/components/organizer/edit-event-form.tsx`
- `web/src/components/organizer/events-overview.tsx`
- `web/src/components/organizer/scanner-management.tsx`
- `web/src/components/organizer/organizer-dashboard-content.tsx`
- `web/src/app/api/organizer/events/route.ts` — POST création
- `web/src/app/api/organizer/events/[id]/route.ts` — GET/PATCH édition
- `web/src/app/api/organizer/dashboard/route.ts` — GET métriques
- `web/src/app/api/organizer/scanners/route.ts` — GET/POST scanneurs
- `web/src/app/api/organizer/payouts/route.ts` — POST demande reversement

---

## 5. Flux Acheteur — Découverte et achat de ticket

### 5.1 Découverte des événements

1. L'acheteur arrive sur la page d'accueil `/` (feed).
2. Seuls les événements `published` sont affichés.
3. **Filtres disponibles :**
   - Recherche textuelle (titre)
   - Filtre par ville
   - Filtre par date (aujourd'hui, ce week-end, plage de dates)
   - Filtre par prix maximum
4. Chaque carte événement affiche : affiche, titre, date, lieu, prix avec indicateur de réduction.

### 5.2 Détail d'un événement

- Page `/events/[id]` avec :
  - Image de l'affiche
  - Description complète
  - Informations tarification empilée (prix officiel → prix organisateur → prix final avec remise plateforme)
  - Bouton « Acheter un ticket »
  - Bouton de partage (Web Share API)

### 5.3 Mes tickets

- Page `/buyer/tickets` accessible depuis le profil.
- Affiche tous les tickets de l'utilisateur connecté (payés / scannés).
- Informations : nom de l'événement, statut du ticket, date d'achat.

### Fichiers impliqués
- `web/src/app/page.tsx` — Page d'accueil avec `MainHomeShell`
- `web/src/components/app/main-home-shell.tsx` — Shell avec onglets Feed / Profil
- `web/src/components/buyer/event-catalog.tsx` — Catalogue avec filtres
- `web/src/components/buyer/buy-ticket-button.tsx` — Bouton + modale d'achat
- `web/src/components/buyer/event-page-actions.tsx` — Actions (retour, partage)
- `web/src/app/events/[id]/page.tsx` — Détail événement
- `web/src/app/buyer/tickets/page.tsx` — Mes tickets

---

## 6. Flux de paiement USSD assisté + validation manuelle

C'est le **flux principal du MVP**. Pas d'intégration directe API Orange Money — le paiement se fait via composition USSD par l'acheteur, et la confirmation par l'admin manuellement.

### Diagramme complet

```
Acheteur                  Frontend                   Backend                  Admin (WhatsApp)
   │                         │                          │                          │
   │ 1. Clique "Acheter"     │                          │                          │
   │ ───────────────────────>│                          │                          │
   │                         │                          │                          │
   │ 2. Saisit nom +         │                          │                          │
   │    numéro OM            │                          │                          │
   │ ───────────────────────>│                          │                          │
   │                         │ 3. POST /api/payments/   │                          │
   │                         │    initiate               │                          │
   │                         │ ────────────────────────>│                          │
   │                         │                          │ 4. Crée ticket (pending)  │
   │                         │                          │    Crée transaction       │
   │                         │                          │    (pending)              │
   │                         │                          │    Commission = 10%       │
   │                         │                          │                          │
   │                         │                          │ 5. WhatsApp acheteur ──>  │
   │                         │                          │    "Paiement en cours     │
   │                         │                          │     de vérification"      │
   │                         │                          │                          │
   │                         │                          │ 6. WhatsApp admin ──────>│
   │                         │                          │    "Nouveau paiement      │
   │                         │                          │     en attente"           │
   │                         │                          │                          │
   │                         │ 7. Code USSD généré      │                          │
   │                         │ <────────────────────────│                          │
   │                         │                          │                          │
   │ 8. Ouvre composeur      │                          │                          │
   │    téléphone avec       │                          │                          │
   │    *144*2*1*{OM}*{prix}#│                          │                          │
   │ <───────────────────────│                          │                          │
   │                         │                          │                          │
   │ 9. Compose le code USSD │                          │                          │
   │    et confirme sur      │                          │                          │
   │    Orange Money         │                          │                          │
   │                         │                          │                          │
   │ 10. Redirigé vers       │                          │                          │
   │    /buyer/payment-      │                          │                          │
   │    pending              │                          │                          │
   │ <───────────────────────│                          │                          │
   │                         │                          │                          │
   │                         │                          │                   11. Admin
   │                         │                          │                   vérifie SMS
   │                         │                          │                   Orange reçu
   │                         │                          │                          │
   │                         │                          │ 12. POST /api/admin/     │
   │                         │                          │     payments/validate    │
   │                         │                          │ <─────────────────────────│
   │                         │                          │                          │
   │                         │                          │ 13. Transaction → success │
   │                         │                          │     Ticket → paid         │
   │                         │                          │     QR hash généré        │
   │                         │                          │                          │
   │ 14. WhatsApp ticket     │                          │                          │
   │     (QR code image)     │                          │                          │
   │ <─────────────────────────────────────────────────│                          │
   │                         │                          │                          │
```

### Calcul des montants

Pour chaque transaction :
```
total_amount       = prix final du ticket (après remises)
commission_amount  = round(total_amount × 0.10)     → part plateforme
organizer_amount   = total_amount - commission_amount → part organisateur
```

### En cas de rejet

Si l'admin constate que le paiement n'a pas été effectué :
1. `POST /api/admin/payments/reject`
2. Transaction → `failed`, Ticket → `cancelled`
3. WhatsApp envoyé à l'acheteur pour l'informer du rejet avec numéro de support

### Fichiers impliqués
- `web/src/components/buyer/buy-ticket-button.tsx` — Modale d'achat + USSD
- `web/src/app/api/payments/initiate/route.ts` — Création ticket/transaction pending
- `web/src/app/buyer/payment-pending/page.tsx` — Page d'attente
- `web/src/app/api/admin/payments/pending/route.ts` — Liste paiements en attente
- `web/src/app/api/admin/payments/validate/route.ts` — Validation admin
- `web/src/app/api/admin/payments/reject/route.ts` — Rejet admin
- `web/src/lib/payments/payment-workflow.ts` — Logique centrale (finalizeSuccessfulPayment, markTransactionFailed)
- `web/src/lib/wasender.ts` — Notifications WhatsApp

---

## 7. Génération et livraison du QR Code

### Génération

- Déclenchée **uniquement** lors de la finalisation d'un paiement réussi (`finalizeSuccessfulPayment`).
- Le `qr_code_hash` est un **UUID v4** unique stocké dans `tickets.qr_code_hash`.
- **Aucune image QR n'est stockée** en base — elle est générée à la volée.

### Endpoint image QR

- `GET /api/qr/[ticketId]` génère une image **PNG 512×512** à partir du `qr_code_hash` du ticket.
- Utilise la librairie Node.js `qrcode`.

### Livraison par WhatsApp

Après génération du QR hash :
1. Construction de l'URL de l'image QR : `{APP_URL}/api/qr/{ticketId}`
2. Envoi via Wasender : image avec légende contenant le titre de l'événement et un message de remerciement.
3. En cas d'échec de l'envoi d'image, **fallback** vers un message texte contenant le hash du ticket.
4. Notification envoyée également à l'organisateur (nouveau ticket vendu).

### Sécurité

- Le QR code ne contient aucune donnée personnelle — uniquement le `qr_code_hash`.
- La validation se fait toujours côté backend en vérifiant l'existence, l'appartenance à l'événement et le statut du ticket.

---

## 8. Flux Scanner — Contrôle d'accès

### Étapes détaillées

```
Scanneur/Organisateur          Frontend (Caméra)           Backend
       │                            │                         │
       │ 1. Ouvre /scanner/scan     │                         │
       │ ──────────────────────────>│                         │
       │                            │                         │
       │ 2. Sélectionne événement   │                         │
       │    (liste filtrée par rôle)│                         │
       │ ──────────────────────────>│                         │
       │                            │ GET /api/scanner/events │
       │                            │ ──────────────────────>│
       │                            │ <──────────────────────│
       │                            │                         │
       │ 3. Active caméra           │                         │
       │ ──────────────────────────>│                         │
       │                            │ (getUserMedia)          │
       │                            │                         │
       │ 4. Scanne QR code          │                         │
       │                            │ POST /api/scanner/      │
       │                            │ validate                │
       │                            │ ──────────────────────>│
       │                            │                         │ 5. Vérifie :
       │                            │                         │    - Ticket existe ?
       │                            │                         │    - Bon événement ?
       │                            │                         │    - Statut "paid" ?
       │                            │                         │    - Déjà scanné ?
       │                            │                         │
       │                            │ 6. Résultat             │
       │                            │ <──────────────────────│
       │                            │                         │
       │ 7. Overlay plein écran     │                         │
       │    + bip sonore            │                         │
       │ <──────────────────────────│                         │
```

### Résultats possibles

| Cas | Affichage | Couleur | Son |
|-----|-----------|---------|-----|
| Ticket valide, statut `paid` | « VALIDÉ » — nom de l'acheteur | 🟢 Vert | Bip aigu (880 Hz) |
| Ticket déjà scanné (`scanned`) | « DÉJÀ SCANNÉ » | 🔴 Rouge | Bip grave (300 Hz) |
| Ticket pas lié à cet événement | « MAUVAIS ÉVÉNEMENT » | 🔴 Rouge | Bip grave (300 Hz) |
| Ticket introuvable ou non payé | « INVALIDE » | 🔴 Rouge | Bip grave (300 Hz) |

### Droits d'accès au scanner

| Rôle | Événements accessibles |
|------|----------------------|
| Admin | Tous les événements |
| Organisateur | Ses propres événements |
| Scanneur | Événements auxquels il est assigné (via `event_scanners`) |

### Statistiques temps réel

- `GET /api/scanner/stats?eventId=...` retourne le compteur en direct :
  - Total tickets payés/scannés
  - Nombre de tickets déjà scannés
- Affiché en temps réel sur l'interface du scanner.

### Fichiers impliqués
- `web/src/components/scanner/scanner-camera-panel.tsx` — Interface caméra + résultats
- `web/src/app/scanner/scan/page.tsx` — Page scanner
- `web/src/app/api/scanner/validate/route.ts` — Validation QR
- `web/src/app/api/scanner/events/route.ts` — Événements accessibles
- `web/src/app/api/scanner/stats/route.ts` — Statistiques de scan

---

## 9. Flux Organisateur — Reversement (Payout)

Les fonds sont **séquestrés** sur le compte marchand de la plateforme jusqu'à la fin de l'événement.

### Règle de fin d'événement

- Si `end_date` est renseigné → l'événement est terminé quand `end_date` est dépassé.
- Si `end_date` est vide → fallback : `date + 24h`.

### Étapes du reversement

1. **L'organisateur** consulte son dashboard et voit le montant demandable par événement.
2. Il clique « Demander versement » et saisit :
   - Nom du bénéficiaire
   - Numéro de téléphone du bénéficiaire
3. `POST /api/organizer/payouts` :
   - Vérifie que l'événement est terminé.
   - Calcule le montant demandable = fonds séquestrés − reversements pending − reversements déjà payés.
   - Crée une entrée `payouts` avec `status = pending`.
4. **L'admin** voit la demande dans le tableau de bord de clôture (`/admin/dashboard`).
5. L'admin effectue le virement manuellement (hors plateforme).
6. L'admin valide (`POST /api/admin/payouts/validate`) → `status = paid`, `paid_at` renseigné.
   - Ou rejette (`POST /api/admin/payouts/reject`) → `status = rejected`.

### Calcul du montant séquestré

```
Fonds séquestrés par événement = SUM(transactions.organizer_amount)
  WHERE transactions.status = 'success'
    AND tickets.status IN ('paid', 'scanned')
    AND tickets.event_id = {event_id}

Montant demandable = Fonds séquestrés
                   - SUM(payouts.amount WHERE status = 'pending')
                   - SUM(payouts.amount WHERE status = 'paid')
```

---

## 10. Flux Admin — Gestion de la plateforme

### 10.1 Validation des paiements

- Page `/admin/validate-payments`
- Liste toutes les transactions `pending` avec : nom de l'événement, nom/numéro acheteur, montant, date.
- Actions : **Valider** (bouton vert) ou **Rejeter** (bouton rouge).
- Chaque action déclenche le workflow de finalisation ou d'annulation.

### 10.2 Tableau de bord de clôture

- Page `/admin/dashboard`
- **KPIs globaux** :
  - Total des fonds séquestrés
  - Reversements en attente
  - Reversements effectués
  - Gain plateforme (commissions)
- **Par événement** :
  - Fonds séquestrés
  - Montant en attente de reversement
  - Montant déjà reversé
- **Historique des payouts** avec actions valider/rejeter

### 10.3 Configuration de la remise plateforme

- Panneau de configuration de la **remise plateforme globale** (en %).
- Modifie la table `platform_settings`.
- Affecte le calcul du prix final pour tous les événements.

### Fichiers impliqués
- `web/src/components/admin/validate-payments-panel.tsx`
- `web/src/components/admin/closure-dashboard-panel.tsx`
- `web/src/components/admin/platform-discount-panel.tsx`
- `web/src/app/admin/dashboard/page.tsx`
- `web/src/app/admin/validate-payments/page.tsx`
- `web/src/app/api/admin/` — Toutes les routes admin

---

## 11. Système de tarification (promotions empilées)

La plateforme utilise un système de **remises empilées** (stacked discounts) :

```
Prix officiel (fixé par l'organisateur)
    │
    ▼   Remise organisateur (promo de l'organisateur)
Prix organisateur  ≤  Prix officiel
    │
    ▼   Remise plateforme (configurée par admin)
Prix final = Prix organisateur × (1 - remise_plateforme%)
```

### Formules

| Calcul | Formule |
|--------|---------|
| Remise organisateur (%) | `(officiel - organisateur) / officiel × 100` |
| Prix final | `organisateur × (1 - plateforme% / 100)` |
| Commission plateforme | `round(prix_final × 0.10)` |
| Part organisateur | `prix_final - commission` |

### Contraintes

- `official_price > 0`
- `organizer_price > 0`  
- `official_price ≥ organizer_price`
- Remise plateforme : 0 à 100 % (généralement 0 % sauf opération spéciale)

### Fichier impliqué
- `web/src/lib/pricing.ts`

---

## 12. Modèle de données

### Tables principales

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   users      │     │   events      │     │   tickets     │     │ transactions │
├─────────────┤     ├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (UUID)    │◄───│ organizer_id  │     │ event_id ────│────>│ ticket_id    │
│ phone (E164) │     │ title         │◄───│ buyer_id     │     │ event_id     │
│ display_name │     │ description   │     │ buyer_phone  │     │ buyer_phone  │
│ roles[]      │     │ city          │     │ qr_code_hash │     │ total_amount │
│ status       │     │ venue         │     │ status       │     │ commission   │
│              │     │ date          │     │              │     │ org_amount   │
│              │     │ end_date      │     │              │     │ status       │
│              │     │ official_price│     │              │     │              │
│              │     │ org_price     │     │              │     │              │
│              │     │ om_recv_phone │     │              │     │              │
│              │     │ image_url     │     │              │     │              │
│              │     │ status        │     │              │     │              │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────────┐
│ event_scanners│     │    payouts        │
├──────────────┤     ├──────────────────┤
│ event_id ────│──>  │ event_id          │
│ user_id  ────│──>  │ amount            │
│              │     │ status            │
│              │     │ receiver_name     │
│              │     │ receiver_phone    │
│              │     │ requested_at      │
│              │     │ paid_at           │
└──────────────┘     └──────────────────┘

┌──────────────────┐
│ platform_settings │  (singleton)
├──────────────────┤
│ key               │
│ value             │
│ (platform_discount│
│  _percent)        │
└──────────────────┘
```

### Enums

| Enum | Valeurs |
|------|---------|
| `user_status` | `active`, `invited`, `blocked` |
| `event_status` | `draft`, `published`, `ended`, `cancelled` |
| `ticket_status` | `pending`, `paid`, `scanned`, `cancelled` |
| `transaction_status` | `pending`, `success`, `failed` |
| `payout_status` | `pending`, `paid`, `rejected` |

---

## 13. Architecture technique et fichiers clés

### Arborescence complète

```
web/src/
├── app/
│   ├── layout.tsx                              # Layout racine (AuthProvider + nav)
│   ├── page.tsx                                # Accueil (feed + profil)
│   ├── manifest.ts                             # PWA manifest
│   ├── globals.css                             # Styles globaux
│   ├── admin/
│   │   ├── dashboard/page.tsx                  # Dashboard admin
│   │   └── validate-payments/page.tsx          # Validation paiements
│   ├── buyer/
│   │   ├── page.tsx                            # Catalogue événements
│   │   ├── payment-pending/page.tsx            # Attente paiement
│   │   └── tickets/page.tsx                    # Mes tickets
│   ├── events/[id]/page.tsx                    # Détail événement
│   ├── organizer/
│   │   ├── dashboard/page.tsx                  # Dashboard organisateur
│   │   ├── new/page.tsx                        # Créer événement
│   │   └── events/[id]/edit/page.tsx           # Modifier événement
│   ├── scanner/scan/page.tsx                   # Scanner QR
│   └── api/
│       ├── auth/{send-otp,verify-otp,me,logout,profile}/
│       ├── events/                             # Catalogue public
│       ├── buyer/portfolio/                    # Portfolio acheteur
│       ├── payments/initiate/                  # Initiation paiement USSD
│       ├── qr/[ticketId]/                      # Image QR à la volée
│       ├── scanner/{events,stats,validate}/    # APIs scanner
│       ├── organizer/{dashboard,events,payouts,scanners}/
│       └── admin/{closure,platform-discount,payments/*,payouts/*}/
├── components/
│   ├── app/        → main-home-shell, global-platform-nav
│   ├── auth/       → auth-provider, login-phone-form, home-entry
│   ├── buyer/      → event-catalog, buy-ticket-button, event-page-actions
│   ├── organizer/  → create/edit-event-form, events-overview, scanner-management
│   ├── scanner/    → scanner-camera-panel
│   ├── admin/      → validate-payments-panel, closure-dashboard-panel, platform-discount-panel
│   └── pwa-register.tsx
├── lib/
│   ├── supabase/{client,server}.ts
│   ├── auth/{constants,otp,phone,rate-limit,roles,session,server-session,admin-guard}.ts
│   ├── pricing.ts
│   ├── payments/payment-workflow.ts
│   └── wasender.ts
└── supabase/migrations/ (10 fichiers de migration)
```

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (serveur uniquement) |
| `OTP_HMAC_SECRET` | Secret pour signer les cookies OTP |
| `SESSION_HMAC_SECRET` | Secret pour signer les cookies de session |
| `WASENDER_API_KEY` | Clé API Wasender |
| `WASENDER_SENDER_ID` | ID de l'expéditeur Wasender |
| `NEXT_PUBLIC_OM_MERCHANT_NUMBER` | Numéro marchand Orange Money |
| `SUPPORT_PHONE` | Numéro de support (backend) |
| `NEXT_PUBLIC_SUPPORT_PHONE` | Numéro de support (frontend) |
| `ADMIN_ALERT_PHONE` | Numéro admin pour alertes WhatsApp |
| `NEXT_PUBLIC_APP_URL` | URL de l'application (pour liens QR) |
| `SUPABASE_STORAGE_EVENTS_BUCKET` | Nom du bucket pour les affiches |
| `NEXT_PUBLIC_PLATFORM_DISCOUNT_PERCENT` | Remise plateforme par défaut (fallback) |

---

*Document généré le 9 mars 2026 — NeoTicket MVP v1*
