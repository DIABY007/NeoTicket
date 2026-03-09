# NeoTicket — Description Complète de la Plateforme

## 1. Présentation Générale

**NeoTicket** est une plateforme de billetterie événementielle conçue sous forme de **PWA (Progressive Web App) mobile-first** pour le marché du **Burkina Faso** (Afrique de l'Ouest). Elle permet aux organisateurs de créer et vendre des billets, aux acheteurs de payer via **Orange Money** et de recevoir un **QR code par WhatsApp**, et aux staffs (scanners) de valider les entrées le jour de l'événement.

- **Devise** : XOF (Franc CFA)
- **Langue** : Français
- **Fuseau horaire** : Africa/Ouagadougou
- **Commission plateforme** : 10 % sur chaque transaction
- **Modèle** : Les fonds sont séquestrés jusqu'à la clôture de l'événement

---

## 2. Stack Technique

### Frontend
| Technologie | Version / Détail |
|---|---|
| Next.js (App Router) | 16.1.6 |
| React | 19.2.3 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| PWA | Service Worker + Manifest (installable, cache-first) |
| QR Scanner | html5-qrcode (caméra du téléphone) |
| QR Generator | qrcode (génération côté serveur, PNG 512×512) |

### Backend & Infrastructure
| Technologie | Rôle |
|---|---|
| Supabase | BaaS — PostgreSQL, Auth, Storage (bucket `event-posters`) |
| HMAC-SHA256 (JWT custom) | Gestion de sessions (cookies httpOnly) |
| Wasender API | Envoi OTP + QR codes via WhatsApp |
| Orange Money API | Paiement USSD (Burkina Faso) |
| PostCSS | Compilation CSS |
| ESLint 9 | Linting |

### Polices & Design
- **Geist Sans** (principale), **Geist Mono** (code)
- Fond : `#f8f7f4`, Texte : `#111111`
- Coins arrondis (`rounded-xl`), style épuré mobile-first

---

## 3. Rôles Utilisateurs

Chaque utilisateur peut avoir plusieurs rôles. Un nouvel inscrit reçoit automatiquement les rôles **buyer** et **organizer**.

| Rôle | Priorité | Description |
|---|---|---|
| **Admin** | 1 (max) | Contrôle total : validation des paiements, clôture, reversements, paramètres |
| **Organizer** | 2 | Crée des événements, gère les scanners, demande les reversements |
| **Scanner** | 3 | Scanne les QR codes des billets pour les événements assignés |
| **Buyer** | 4 | Parcourt les événements, achète des billets, consulte son portefeuille |

Le super-admin est le numéro `+22656636039` (hardcodé en base).

---

## 4. Base de Données (PostgreSQL via Supabase)

### 4.1 Tables Principales

#### `users`
| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| phone | TEXT (unique) | Numéro E.164 (+226XXXXXXXX) |
| roles | TEXT[] | Tableau de rôles (buyer, organizer, scanner, admin) |
| status | ENUM | active, invited, blocked |
| display_name | TEXT | Nom affiché (2–80 caractères) |
| created_at / updated_at | TIMESTAMPTZ | Horodatage auto |

#### `events`
| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| organizer_id | UUID (FK → users) | Créateur de l'événement |
| title | TEXT | Titre de l'événement |
| description | TEXT | Description détaillée |
| date | TIMESTAMPTZ | Date/heure de début |
| end_date | TIMESTAMPTZ | Date/heure de fin (optionnel) |
| city | TEXT | Ville de l'événement |
| venue | TEXT | Lieu précis (1–200 car., optionnel) |
| price | INTEGER | Prix affiché (legacy) |
| official_price | INTEGER | Prix officiel complet |
| organizer_price | INTEGER | Prix réduit par l'organisateur |
| image_url | TEXT | URL de l'affiche (Supabase Storage) |
| om_receiver_phone | TEXT | Numéro Orange Money de l'organisateur (E.164) |
| status | ENUM | draft, published, ended, cancelled |
| created_at / updated_at | TIMESTAMPTZ | Horodatage auto |

#### `tickets`
| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| event_id | UUID (FK → events) | Événement lié |
| buyer_id | UUID (FK → users) | Acheteur |
| buyer_phone | TEXT | Téléphone de l'acheteur |
| qr_code_hash | TEXT | Hash unique du QR code |
| status | ENUM | pending, paid, scanned, cancelled |
| payment_confirmed_at | TIMESTAMPTZ | Date de confirmation du paiement |
| scanned_at | TIMESTAMPTZ | Date du scan à l'entrée |
| qr_generated_at | TIMESTAMPTZ | Date de génération du QR |
| qr_delivered_at | TIMESTAMPTZ | Date de livraison WhatsApp |
| qr_delivery_error | TEXT | Erreur éventuelle d'envoi |
| created_at / updated_at | TIMESTAMPTZ | Horodatage auto |

#### `transactions`
| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant unique |
| ticket_id | UUID (FK → tickets) | Billet associé |
| event_id | UUID (FK → events) | Événement |
| buyer_phone | TEXT | Téléphone de l'acheteur |
| total_amount | INTEGER | Montant total payé |
| commission_amount | INTEGER | Commission plateforme (10 %) |
| organizer_amount | INTEGER | Part organisateur |
| currency | TEXT | XOF |
| om_order_id | TEXT | ID commande Orange Money |
| om_payment_id | TEXT | ID paiement Orange Money |
| provider_reference | TEXT | Référence fournisseur |
| status | ENUM | pending, success, failed |
| payment_initiated_at | TIMESTAMPTZ | Initiation du paiement |
| paid_at | TIMESTAMPTZ | Confirmation du paiement |
| failed_at | TIMESTAMPTZ | Échec éventuel |
| failure_reason | TEXT | Motif d'échec |
| webhook_received_at | TIMESTAMPTZ | Réception du webhook |
| webhook_verified | BOOLEAN | Signature vérifiée |
| idempotency_key | TEXT | Clé d'idempotence |
| created_at / updated_at | TIMESTAMPTZ | Horodatage auto |

#### `event_scanners`
| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant |
| event_id | UUID (FK → events) | Événement |
| user_id | UUID (FK → users) | Scanner assigné |
| created_at | TIMESTAMPTZ | Date d'ajout |

#### `payouts` (Reversements)
| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant |
| event_id | UUID (FK → events) | Événement clôturé |
| amount | INTEGER | Montant à reverser |
| amount_currency | TEXT | Devise (XOF) |
| status | ENUM | pending, paid, rejected |
| requested_at / paid_at | TIMESTAMPTZ | Dates |
| requested_by / approved_by | UUID | Demandeur / Valideur |
| receiver_name | TEXT | Nom du bénéficiaire |
| receiver_phone | TEXT | Téléphone du bénéficiaire |
| payment_reference | TEXT | Référence du virement |
| payment_channel | TEXT | Canal utilisé |
| notes | TEXT | Notes |

#### `platform_settings`
| Colonne | Type | Description |
|---|---|---|
| id | UUID (PK) | Identifiant |
| platform_discount_percent | INTEGER | Remise globale appliquée aux prix |

### 4.2 Vue
- **`v_events_with_effective_end`** : Calcule la date de fin effective comme `COALESCE(end_date, date + 24h)` pour déterminer l'éligibilité aux reversements.

### 4.3 Contraintes Clés
- Téléphone : format **E.164 strict** (`^\+[1-9][0-9]{6,14}$`)
- Prix : `official_price >= organizer_price > 0`
- Lieu : entre 1 et 200 caractères (si renseigné)
- Commission : `ROUND(total * 0.10)`, `organizer = total - commission`
- Triggers : `updated_at` mis à jour automatiquement sur toutes les tables

### 4.4 Migrations
| Fichier | Contenu |
|---|---|
| `20260307_120000_init_schema.sql` | Tables de base (users, events, tickets, transactions, event_scanners, payouts) |
| `20260307_230000_orange_money_schema_phase.sql` | Champs Orange Money, webhooks, indexes |
| `20260308_030000_set_admin_phone_22656636039.sql` | Super-admin hardcodé |
| `20260308_040000_default_users_buyer_organizer.sql` | Rôles par défaut buyer + organizer |
| `20260308_050000_publish_existing_draft_events.sql` | Publication des brouillons existants |
| `20260308_060000_add_users_display_name.sql` | Champ nom affiché (2–80 car.) |
| `20260308_070000_add_events_city.sql` | Champ ville |
| `20260308_080000_add_stacked_promotions.sql` | Prix officiel / organisateur + table platform_settings |
| `20260308_090000_payout_receiver_and_rejected_status.sql` | Champs bénéficiaire + statut rejected |
| `20260308_100000_add_venue_and_om_phone.sql` | Lieu + numéro OM de l'organisateur |

---

## 5. Authentification & Sessions

### 5.1 Flux OTP par WhatsApp

```
1. L'utilisateur saisit son numéro de téléphone
2. POST /api/auth/send-otp
   → Normalisation : format local (8 chiffres) → +226XXXXXXXX
   → Rate limiting : 3 envois/heure, 60s entre chaque
   → Génération : code 6 chiffres (crypto)
   → Envoi via Wasender (WhatsApp)
   → Token OTP signé HMAC-SHA256 dans cookie httpOnly (5 min TTL)

3. L'utilisateur saisit le code reçu
4. POST /api/auth/verify-otp
   → Vérification du hash, max 5 tentatives, contrôle TTL
   → Première connexion : création du compte (nom requis, 2–80 car.)
   → Rôles par défaut : ["buyer", "organizer"]
   → Session : JWT signé HMAC dans cookie httpOnly (7 jours TTL)

5. GET /api/auth/me → Retourne l'utilisateur courant
6. POST /api/auth/logout → Supprime le cookie de session
```

### 5.2 Constantes de Sécurité

| Paramètre | Valeur |
|---|---|
| Validité OTP | 5 minutes |
| Tentatives max | 5 |
| Cooldown renvoi | 60 secondes |
| Renvois max/heure | 7 |
| Durée session | 7 jours |
| Cookie OTP | `neoticket_otp_state` (httpOnly, secure, sameSite=lax) |
| Cookie session | `neoticket_session` (httpOnly, secure, sameSite=lax) |
| Signature | HMAC-SHA256 via `OTP_SIGNING_SECRET` |

---

## 6. API — Endpoints Complets

### 6.1 Authentification
| Route | Méthode | Description |
|---|---|---|
| `/api/auth/send-otp` | POST | Envoyer un OTP par WhatsApp |
| `/api/auth/verify-otp` | POST | Vérifier l'OTP, créer/connecter l'utilisateur |
| `/api/auth/me` | GET | Récupérer l'utilisateur connecté |
| `/api/auth/logout` | POST | Déconnexion |

### 6.2 Événements
| Route | Méthode | Description |
|---|---|---|
| `/api/events` | GET | Liste des événements publiés avec tarifs |
| `/api/organizer/events` | POST | Créer un événement (FormData : titre, description, ville, dates, prix, image) |
| `/api/organizer/events/[id]` | GET, PATCH | Consulter / modifier un événement |
| `/api/organizer/dashboard` | GET | Métriques du tableau de bord organisateur |

### 6.3 Billets & Paiements
| Route | Méthode | Description |
|---|---|---|
| `/api/payments/initiate` | POST | Créer transaction + billet pending, initier paiement OM |
| `/api/buyer/portfolio` | GET | Billets achetés par l'utilisateur |
| `/api/qr/[ticketId]` | GET | Générer le QR code PNG à la volée |

### 6.4 Scanner
| Route | Méthode | Description |
|---|---|---|
| `/api/scanner/events` | GET | Événements assignés au scanner |
| `/api/scanner/validate` | POST | Valider un QR (doublon, événement, statut) |
| `/api/scanner/stats` | GET | Statistiques de scan |

### 6.5 Gestion Scanners (Organisateur)
| Route | Méthode | Description |
|---|---|---|
| `/api/organizer/scanners` | GET, POST | Lister / ajouter des scanners à un événement |

### 6.6 Administration
| Route | Méthode | Description |
|---|---|---|
| `/api/admin/closure` | GET | Événements éligibles au reversement |
| `/api/admin/payments/pending` | GET | Transactions en attente de validation |
| `/api/admin/payments/validate` | PUT | Approuver une transaction pending |
| `/api/admin/payments/reject` | PUT | Rejeter une transaction |
| `/api/admin/payouts/validate` | PUT | Marquer un reversement comme payé |
| `/api/admin/payouts/reject` | PUT | Rejeter un reversement |
| `/api/admin/platform-discount` | PATCH | Modifier la remise plateforme (%) |
| `/api/admin/whatsapp` | POST | Test envoi WhatsApp admin |

### 6.7 Webhook
| Route | Méthode | Description |
|---|---|---|
| `/api/webhooks/orange` | POST | Callback Orange Money (signature HMAC vérifiée) |

---

## 7. Pages & Navigation

### 7.1 Pages Publiques
| Route | Description |
|---|---|
| `/` | Page d'accueil — feed d'événements, redirection par rôle |
| `/events/[id]` | Détail d'un événement + bouton d'achat |

### 7.2 Pages Acheteur (Buyer)
| Route | Description |
|---|---|
| `/buyer` | Catalogue des événements publiés |
| `/buyer/payment-pending` | Écran d'attente de confirmation de paiement |
| `/buyer/tickets` | Portefeuille de billets avec QR codes |

### 7.3 Pages Organisateur (Organizer)
| Route | Description |
|---|---|
| `/organizer/dashboard` | Tableau de bord avec métriques |
| `/organizer/new` | Formulaire de création d'événement |
| `/organizer/events/[id]/edit` | Formulaire de modification d'événement |

### 7.4 Page Scanner
| Route | Description |
|---|---|
| `/scanner/scan` | Interface de scan QR (caméra) — accessible aux rôles Scanner et Organizer |

### 7.5 Pages Admin
| Route | Description |
|---|---|
| `/admin/dashboard` | Clôture d'événements, reversements, paramètres plateforme |
| `/admin/validate-payments` | Interface de validation manuelle des paiements |

---

## 8. Flux de Paiement (Orange Money — MVP)

Le MVP utilise un **flux USSD assisté avec validation manuelle** par l'admin :

```
┌──────────────┐     POST /api/payments/initiate     ┌──────────────────┐
│   Acheteur   │ ──────────────────────────────────→  │   Serveur        │
│   (modale)   │                                      │   Crée ticket    │
│              │  ← Transaction ID + infos USSD ────  │   + transaction  │
│              │                                      │   (status:pending│
│ Compose USSD │                                      └──────────────────┘
│ Orange Money │
└──────┬───────┘
       │
       │  L'acheteur paie via USSD
       │
       ▼
┌──────────────┐     Alerte WhatsApp                  ┌──────────────────┐
│   Admin      │ ← ──────────────────────────────────  │   Serveur        │
│              │                                      └──────────────────┘
│ Vérifie SMS  │
│ Orange reçu  │
│              │     PUT /api/admin/payments/validate
│   Valide ────│──────────────────────────────────→   ┌──────────────────┐
│              │                                      │ Transaction →    │
│   ou         │     PUT /api/admin/payments/reject   │ success          │
│   Rejette ───│──────────────────────────────────→   │ Ticket → paid    │
│              │                                      │ QR généré        │
└──────────────┘                                      │ WhatsApp envoyé  │
                                                      └──────────────────┘
       │
       ▼
┌──────────────┐
│   Acheteur   │  Reçoit QR code par WhatsApp
│              │  + visible dans /buyer/tickets
└──────────────┘
```

### Cycle de vie d'une transaction
1. **pending** → Paiement initié, en attente de validation
2. **success** → Validé par l'admin (ou webhook OM) → QR généré, WhatsApp envoyé
3. **failed** → Rejeté par l'admin → billet annulé

---

## 9. Modèle de Tarification & Commission

### Calcul des prix (remises empilées)

```
prix_officiel (prix plein annoncé par l'organisateur)
    ↓
prix_organisateur (remise décidée par l'organisateur)
    ↓
prix_final = prix_organisateur × (1 − remise_plateforme% / 100)
```

### Exemple concret

| Élément | Montant |
|---|---|
| Prix officiel | 10 000 F CFA |
| Prix organisateur (−20 %) | 8 000 F CFA |
| Remise plateforme (10 %) | −800 F CFA |
| **Prix final acheteur** | **7 200 F CFA** |
| Commission NeoTicket (10 %) | 720 F CFA |
| **Part organisateur** | **6 480 F CFA** |

### Formules
```
commission = ROUND(prix_final × 0.10)
part_organisateur = prix_final − commission
```

---

## 10. Système QR Code

| Aspect | Détail |
|---|---|
| **Déclenchement** | Uniquement après `transaction.status = success` |
| **Génération** | Hash unique via `crypto` → stocké dans `tickets.qr_code_hash` |
| **Rendu** | PNG à la volée via `GET /api/qr/[ticketId]` (512×512, correction M) |
| **Cache** | 5 minutes (public) |
| **Livraison** | Image envoyée par WhatsApp (Wasender) avec titre de l'événement |
| **Scan** | Caméra du téléphone via `html5-qrcode` |
| **Validation** | `POST /api/scanner/validate` → vérifie doublon, événement, met à jour `scanned` |

---

## 11. Intégration WhatsApp (Wasender)

### Fonctions disponibles
| Fonction | Usage |
|---|---|
| `sendOtpWhatsApp(to, code)` | Envoi du code OTP 6 chiffres |
| `sendWhatsAppTextMessage(to, text)` | Message texte simple |
| `sendWhatsAppImageMessage(to, text, imageUrl)` | Message avec image (QR code) |

### Configuration
- **API** : `https://www.wasenderapi.com/api/send-message`
- **Clé** : Variable `WASENDER_API_KEY`
- **Validation** : Les URLs d'images doivent être publiques (pas de localhost/IP privée)

---

## 12. Parcours Utilisateur par Rôle

### Acheteur
1. Se connecte via OTP WhatsApp
2. Parcourt les événements publiés (titre, prix, date, ville, lieu, affiche)
3. Consulte le détail d'un événement avec la décomposition de prix
4. Achète un billet via Orange Money (modale USSD)
5. Attend la validation admin
6. Reçoit le QR code par WhatsApp
7. Consulte ses billets dans `/buyer/tickets`
8. Présente le QR code le jour J

### Organisateur
1. Se connecte (rôle attribué automatiquement)
2. Crée un événement (titre, description, ville, lieu, dates, prix officiel, prix organisateur, affiche)
3. Publie l'événement (draft → published)
4. Consulte le dashboard (billets vendus, fonds totaux, part organisateur)
5. Ajoute des scanners par numéro de téléphone
6. Demande un reversement après clôture de l'événement
7. Peut aussi scanner des billets

### Scanner
1. Se connecte via OTP
2. Sélectionne l'événement assigné
3. Ouvre la caméra et scanne les QR codes
4. Voit le résultat en temps réel : ✅ Valide / ⚠️ Déjà scanné / ❌ Mauvais événement
5. Le billet passe en statut `scanned`

### Administrateur
1. Se connecte (numéro admin hardcodé)
2. **Validation des paiements** : voit les transactions pending, approuve ou rejette
3. **Clôture & Reversements** : voit les événements terminés, approuve/rejette les demandes de reversement
4. **Paramètres** : ajuste la remise plateforme globale (%)
5. Reçoit des alertes WhatsApp pour les nouveaux paiements

---

## 13. Composants Principaux

### Auth
- `AuthProvider.tsx` — Contexte React, gestion de la session
- `LoginPhoneForm.tsx` — Formulaire 2 étapes (téléphone → code OTP)
- `HomeEntry.tsx` — Redirection par rôle après connexion

### Buyer
- `EventCatalog.tsx` — Grille d'événements avec filtres
- `BuyTicketButton.tsx` — Modale d'achat (téléphone, nom, USSD)
- `EventPageActions.tsx` — Boutons partage/retour

### Organizer
- `CreateEventForm.tsx` — Formulaire création d'événement
- `EditEventForm.tsx` — Formulaire modification
- `OrganizerDashboardContent.tsx` — Layout dashboard + métriques
- `EventsOverview.tsx` — Cartes événements avec stats
- `ScannerManagement.tsx` — Gestion des scanners

### Scanner
- `ScannerCameraPanel.tsx` — Interface scan QR + modales résultat

### Admin
- `ClosureDashboardPanel.tsx` — Clôture et reversements
- `ValidatePaymentsPanel.tsx` — Validation manuelle des paiements
- `PlatformDiscountPanel.tsx` — Paramètres remise plateforme

### App
- `MainHomeShell.tsx` — Page d'accueil principale
- `GlobalPlatformNav.tsx` — Barre de navigation en bas de l'écran

### PWA
- `pwa-register.tsx` — Enregistrement du Service Worker

---

## 14. Variables d'Environnement

### Publiques (client)
```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
NEXT_PUBLIC_OM_MERCHANT_NUMBER=[numéro-marchand-affiché]
NEXT_PUBLIC_SUPPORT_PHONE=[téléphone-support]
NEXT_PUBLIC_APP_URL=https://neoticket.app
```

### Serveur
```env
OTP_SIGNING_SECRET=[secret-32+-caractères-HMAC]
WASENDER_API_URL=https://www.wasenderapi.com/api/send-message
WASENDER_API_KEY=[clé-wasender]
SUPPORT_PHONE=[téléphone-support-serveur]
ADMIN_ALERT_PHONE=[téléphone-alertes-admin]
OM_CLIENT_ID=[client-id-orange-money]
OM_CLIENT_SECRET=[secret-orange-money]
OM_MERCHANT_KEY=[clé-marchand-orange-money]
OM_BASE_URL=[url-api-orange-money]
OM_WEBHOOK_URL=[url-webhook]
PLATFORM_DISCOUNT_PERCENT=0
```

---

## 15. PWA & Offline

| Élément | Détail |
|---|---|
| Manifest | `public/manifest.webmanifest` — nom, icônes, scope |
| Service Worker | `public/sw.js` — stratégie cache-first avec fallback réseau |
| Pré-cache | Page d'accueil + manifest |
| Installable | Oui, sur l'écran d'accueil du téléphone |

---

## 16. Architecture des Fichiers

```
web/
├── public/
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── app/
│   │   ├── page.tsx                          # Accueil
│   │   ├── events/[id]/page.tsx              # Détail événement
│   │   ├── buyer/
│   │   │   ├── page.tsx                      # Catalogue
│   │   │   ├── payment-pending/page.tsx      # Attente paiement
│   │   │   └── tickets/page.tsx              # Portefeuille
│   │   ├── organizer/
│   │   │   ├── dashboard/page.tsx            # Dashboard
│   │   │   ├── new/page.tsx                  # Créer événement
│   │   │   └── events/[id]/edit/page.tsx     # Modifier événement
│   │   ├── scanner/
│   │   │   └── scan/page.tsx                 # Interface scan
│   │   ├── admin/
│   │   │   ├── dashboard/page.tsx            # Admin dashboard
│   │   │   └── validate-payments/page.tsx    # Validation paiements
│   │   └── api/
│   │       ├── auth/                         # OTP, session, logout
│   │       ├── events/                       # Liste événements
│   │       ├── payments/                     # Initiation paiement
│   │       ├── buyer/                        # Portefeuille
│   │       ├── qr/                           # Génération QR
│   │       ├── scanner/                      # Validation scan
│   │       ├── organizer/                    # CRUD événements, scanners
│   │       ├── admin/                        # Validation, clôture, paramètres
│   │       └── webhooks/                     # Callback Orange Money
│   ├── components/
│   │   ├── auth/                             # AuthProvider, LoginForm
│   │   ├── buyer/                            # Catalogue, achat
│   │   ├── organizer/                        # Dashboard, formulaires
│   │   ├── scanner/                          # Caméra QR
│   │   ├── admin/                            # Panels admin
│   │   ├── app/                              # Shell, navigation
│   │   └── pwa-register.tsx                  # Service Worker
│   └── lib/
│       ├── auth/                             # OTP, sessions, rôles, rate-limit
│       ├── supabase/                         # Clients Supabase (client/server)
│       ├── payments/                         # Workflow Orange Money
│       ├── wasender.ts                       # Intégration WhatsApp
│       └── pricing.ts                        # Calculs commission/remises
└── supabase/
    └── migrations/                           # 10 fichiers de migration SQL
```

---

## 17. Résumé des Fonctionnalités MVP

| Fonctionnalité | Statut |
|---|---|
| Inscription/connexion OTP WhatsApp | ✅ |
| Catalogue d'événements publié | ✅ |
| Détail événement + décomposition prix | ✅ |
| Création/modification d'événement (organisateur) | ✅ |
| Upload d'affiche (Supabase Storage) | ✅ |
| Achat de billet via Orange Money (USSD) | ✅ |
| Validation manuelle admin des paiements | ✅ |
| Génération QR code unique par billet | ✅ |
| Envoi QR par WhatsApp | ✅ |
| Portefeuille de billets acheteur | ✅ |
| Scan QR à l'entrée (caméra) | ✅ |
| Gestion des scanners par événement | ✅ |
| Dashboard organisateur (métriques) | ✅ |
| Clôture d'événement + reversements | ✅ |
| Remise plateforme configurable | ✅ |
| Remise organisateur empilable | ✅ |
| Alertes WhatsApp admin | ✅ |
| PWA installable + offline | ✅ |
| Webhook Orange Money (signature HMAC) | ✅ |
| Multi-rôles utilisateur | ✅ |
