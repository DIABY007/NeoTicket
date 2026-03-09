## Architecture Globale - MVP Billetterie (Next.js + Supabase)

Ce document fige les choix techniques et l’architecture cible pour le MVP décrit dans le PRD et `implementation.md`.
Le code ne doit pas être écrit tant que l’étape 1.1 n’a pas été explicitement validée.

Decisions validees de cadrage:
- Stack figee: Next.js PWA + Supabase.
- OTP login: flux custom serveur avec Wasender (pas Supabase Auth OTP natif).
- Ticketing V1: un achat = un ticket.
- Telephone: E.164 strict.
- Arrondi commission: mathematique standard a l'unite FCFA.
- Payout: uniquement apres `end_date`.
- Locale: francais + fuseau `Africa/Ouagadougou`.
- OTP securite: TTL 5 minutes, 5 tentatives max, renvoi OTP cooldown 60s, max 3 renvois/heure/numero.
- Webhook Orange Money: verification signature/HMAC obligatoire (ou IP whitelist Orange si indisponible).
- Regle payout fallback: si `end_date` absent, considerer `date + 24h`.

---

## 1. Stack Technique

### 1.1 Frontend
- **Framework** : `Next.js` (PWA, orientation mobile-first).
- **Langage** : TypeScript.
- **Rendu** : App Router, pages principalement côté serveur (SSR) pour les vues publiques, côté client pour les écrans d’app (dashboard, scan, etc.).
- **UI** : Librairie de composants (ex. Tailwind CSS + composants maison) avec design simple, efficace, 100 % français.
- **PWA** : Manifest PWA + Service Worker pour installation sur mobile (icône, splash screen, etc.).

### 1.2 Backend / Base de données
- **BaaS** : `Supabase` (Postgres managé + Auth + Storage + Edge Functions).
- **Base de données** : Postgres (hébergé par Supabase).
- **APIs backend** :
  - `Supabase Edge Functions` pour la logique sensible (paiement Orange Money, webhooks, génération QR, envoi WhatsApp).
  - Eventuellement `Route Handlers` Next.js pour quelques endpoints internes non sensibles.

### 1.3 Intégrations externes
- **Paiement** : API Orange Money (Burkina Faso, XOF).
  - Variables d’environnement : `OM_CLIENT_ID`, `OM_CLIENT_SECRET`, `OM_MERCHANT_KEY`, `OM_BASE_URL`, `OM_WEBHOOK_URL`.
  - Pour le moment, ces variables sont des placeholders, le code sera prêt à les recevoir.
- **WhatsApp** : API `Wasender` (envoi de messages WhatsApp avec image du QR Code).
  - Variables d’environnement : `WASENDER_API_URL`, `WASENDER_API_KEY`, `WASENDER_SENDER_ID` (selon le format exigé par Wasender).

---

## 2. Modèle de Données (Schéma BDD)

Toutes les dates sont stockées en **UTC** en base, puis converties côté frontend en **GMT (Afrique de l’Ouest)** pour l’affichage.
La monnaie est le **FCFA (XOF)**, affichée sous la forme `10 000 F CFA`.

### 2.1 Table `Users`
- `id` (UUID, PK)
- `phone` (string unique, format numéro local/international)
- `roles` (array de strings ou JSONB, ex. `["buyer", "organizer"]`)
- `status` (enum : `active`, `invited`, `blocked`)
- `created_at` (timestamp UTC)
- `updated_at` (timestamp UTC)

**Remarques :**
- Multi-rôles : un utilisateur peut cumuler les rôles `buyer`, `organizer`, `scanner`, `admin`.
- Pour un utilisateur invité par numéro (Scanneur), on crée un `User` minimal avec `status = invited`. Il s’activera lors de sa première connexion par OTP.

### 2.2 Table `Events`
- `id` (UUID, PK)
- `organizer_id` (FK → `Users.id`)
- `title` (string)
- `description` (text)
- `date` (timestamp UTC de début de l’événement)
- `end_date` (timestamp UTC facultatif, fin de l’événement)
- `price` (numeric, montant total par ticket en XOF)
- `image_url` (string, URL vers l’affiche stockée dans Supabase Storage)
- `status` (enum : `draft`, `published`, `ended`, `cancelled`)
- `created_at` (timestamp UTC)
- `updated_at` (timestamp UTC)

### 2.3 Table `Tickets`
- `id` (UUID, PK)
- `event_id` (FK → `Events.id`)
- `buyer_id` (FK → `Users.id`, nullable si achat par simple numéro sans compte complet)
- `buyer_phone` (string, numéro utilisé pour le paiement / envoi WhatsApp)
- `qr_code_hash` (string unique, généré uniquement après succès du paiement)
- `status` (enum : `pending`, `paid`, `scanned`, `cancelled`)
- `created_at` (timestamp UTC)
- `updated_at` (timestamp UTC)

### 2.4 Table `Transactions`
- `id` (UUID, PK)
- `ticket_id` (FK → `Tickets.id`)
- `event_id` (FK → `Events.id` pour faciliter les requêtes)
- `buyer_phone` (string)
- `total_amount` (numeric, prix du ticket)
- `commission_amount` (numeric, 10 % du `total_amount`)
- `organizer_amount` (numeric, 90 % du `total_amount`)
- `provider_reference` (string, référence Orange Money / transaction externe)
- `status` (enum : `pending`, `success`, `failed`)
- `created_at` (timestamp UTC)
- `updated_at` (timestamp UTC)

### 2.5 Table `EventScanners`
- `id` (UUID, PK)
- `event_id` (FK → `Events.id`)
- `user_id` (FK → `Users.id`)
- `created_at` (timestamp UTC)

**Règles :**
- Un `Scanneur` peut être lié à plusieurs événements (plusieurs lignes dans `EventScanners`).
- Un `Organisateur` peut aussi être Scanneur ou Acheteur (via son tableau `roles`).

### 2.6 Table `Payouts`
- `id` (UUID, PK)
- `event_id` (FK → `Events.id`)
- `amount` (numeric, montant à reverser à l’organisateur en XOF)
- `status` (enum : `pending`, `paid`)
- `requested_at` (timestamp UTC, date de demande de reversement par l’organisateur)
- `paid_at` (timestamp UTC, rempli par l’Admin quand le reversement a été effectué manuellement)

---

## 3. Authentification OTP par Numéro (Mobile First)

### 3.1 Principe général
- Pas de mot de passe.
- L’utilisateur entre son **numéro de téléphone** → reçoit un **OTP** → saisit le code → est connecté.
- Si le numéro n’existe pas, le compte est créé **à la volée** (statut `active` ou `invited` selon le contexte).

### 3.2 Implémentation technique
- Utilisation d'un **flux OTP custom cote serveur** (voir `guide-integration-otp-reutilisable.md`) :
  - Generation OTP cote backend.
  - Envoi OTP via **Wasender**.
  - Stockage et verification de l'etat OTP via cookie httpOnly signe et expire.
  - Verification OTP cote serveur, puis creation de session applicative.
  - Parametres de securite: TTL 5 minutes, invalidation apres 5 tentatives, cooldown de renvoi 60 secondes, limite 3 renvois/heure/numero.
- Le flux precise (helpers OTP, routes `send-otp`/`verify-otp`, cookies, guards) s'inspire des patterns de projets internes references dans le guide OTP.

### 3.3 Gestion des rôles & redirections
- Au login, on récupère les `roles` de l’utilisateur depuis `Users.roles`.
- Un **state global** (contexte React ou store) conserve :
  - utilisateur courant,
  - ses rôles,
  - et éventuellement la sélection de rôle actif (si plusieurs).
- Redirections :
  - `Acheteur` → liste des événements / page d’accueil.
  - `Organisateur` → dashboard organisateur.
  - `Scanneur` → interface de scan.
  - `Admin` → dashboard admin.

---

## 4. Flux Paiement Orange Money (Burkina Faso)

### 4.1 Initialisation du paiement
1. L’acheteur ouvre la page de détails d’un événement et clique sur **"Acheter un ticket"**.
2. Une modale demande le **numéro Orange Money**.
3. Le frontend envoie au backend (Edge Function Supabase ou route Next.js sécurisée) :
   - `event_id`
   - `buyer_phone`
4. Le backend :
   - vérifie que l’événement est `published` et encore ouvert (date non passée),
   - crée un `Ticket` en `pending`,
   - crée une `Transaction` en `pending` avec :
     - `total_amount` = `Events.price`,
     - `commission_amount` = 10 % de `total_amount`,
     - `organizer_amount` = 90 % de `total_amount`.
  - appelle l’API Orange Money pour initier la demande de paiement (USSD/validation cote utilisateur Orange Money).

### 4.2 Webhook Orange Money
1. Orange Money appelle l’URL de **webhook** configurée avec le statut final de la transaction.
2. Le webhook backend :
  - verifie la signature/HMAC de la requete webhook (ou applique un filtrage strict par IP whitelist Orange si la signature n'est pas disponible),
   - identifie la `Transaction` via la référence `provider_reference`,
   - met à jour `Transactions.status` (`success` ou `failed`),
   - si `success` :
     - met à jour `Tickets.status` → `paid`,
     - déclenche la **génération du `qr_code_hash`** (section 5),
     - déclenche l’envoi WhatsApp (section 6).

### 4.3 Bouton "Vérifier mon paiement"
- Si aucune confirmation n’a été reçue dans les 30 secondes :
  - Le frontend affiche un bouton **"Vérifier mon paiement"**.
  - Ce bouton appelle un endpoint backend qui :
    - interroge l’API Orange Money sur le statut de la transaction (polling manuel),
    - synchronise le statut en base (`Transactions` + `Tickets`),
    - si `success`, suit le même flux que le webhook (QR + WhatsApp).

---

## 5. Génération et Gestion du QR Code

### 5.1 Stratégie de stockage
- On stocke uniquement un **`qr_code_hash`** dans la table `Tickets`.
- L’**image QR** est générée **a la volee** par un endpoint (ou cote client a partir du hash, selon besoin UX) :
  - URL de type `/api/qr/[ticketId]` ou Edge Function dédiée.
  - Le hash est encodé en QR côté backend.
  - L’endpoint renvoie soit une image (PNG/SVG), soit un flux binaire.

### 5.2 Génération du hash
- A la première transition de la `Transaction` vers `success` :
  - Génération d’un identifiant unique (UUID v4 ou hash dérivé : `hash(ticket_id + secret)`).
  - Enregistrement dans `Tickets.qr_code_hash`.
  - Le contenu du QR Code est ce hash (et non un ID lisible).

### 5.3 Sécurité
- Le QR Code ne contient aucune donnée sensible directement (pas de données personnelles, pas de montant).
- La validation se fait toujours côté backend en vérifiant :
  - que le `qr_code_hash` existe,
  - qu’il est bien relié à cet événement,
  - que le ticket est `paid` et non encore `scanned`.

---

## 6. Envoi des Tickets via WhatsApp (Wasender)

### 6.1 Flux d’envoi
1. Après confirmation de paiement (`success`), le backend :
   - génère ou récupère le `qr_code_hash`,
   - génère l’image du QR à la volée (ou via un endpoint interne),
   - prépare un message standard : titre de l’événement, date, message de remerciement.
2. Le backend appelle l’API `Wasender` en `POST` :
   - `to` = `buyer_phone`,
   - `message` = texte,
   - `media` = image du QR (URL ou base64 selon l’API Wasender).

### 6.2 Phase de test
- Au début, les tickets sont envoyés vers **un seul numéro de test** (configuré en variable d’environnement).
- Plus tard, on ouvrira vers tous les numéros des acheteurs une fois le flux validé.

---

## 7. Système de Scan et Contrôle d’Accès

### 7.1 Interface de scan (Web/PWA)
- Accessible aux rôles `scanner` et `organizer`.
- Utilisation de l’API `getUserMedia` (caméra) dans le navigateur.
- Composant de lecture de QR Code côté frontend (librairie JS) qui renvoie le contenu (le `qr_code_hash`).

### 7.2 Validation côté backend
1. Le frontend envoie au backend :
   - `qr_code_hash`,
   - `event_id` courant (sélectionné par le scanneur/organisateur).
2. Le backend :
   - recherche le ticket correspondant,
   - vérifie :
     - que le ticket est lié à **cet événement**,
     - que le statut du ticket est `paid`,
     - qu’il n’a pas déjà le statut `scanned`.
   - met à jour le statut à `scanned` si tout est valide.
3. Le backend renvoie un code de résultat :
   - **OK** → "Validé" (vert).
   - **Déjà scanné** → "Ce code a déjà été validé" (rouge).
   - **Mauvais événement** → "Ce code n'est pas lié à cet événement" (rouge).

---

## 8. Escrow, Dashboard Organisateur et Admin

### 8.1 Logique d’escrow
- Chaque transaction `success` augmente :
  - le total global (commission 10 %),
  - le **solde séquestré** de l’événement pour l’organisateur (`organizer_amount`).
- Les fonds réels sont sur le compte marchand de la plateforme ; l’app n’expose que les montants **virtuels**.
- Calcul financier impose :
  - `commission_amount = round(total_amount * 0.10)`
  - `organizer_amount = total_amount - commission_amount`

### 8.2 Dashboard Organisateur
- Vue listant ses événements avec :
  - nombre de tickets vendus,
  - total des ventes,
  - montant disponible (somme des `organizer_amount` des tickets `paid` ou `scanned`),
  - statut de l’événement (`draft`, `published`, `ended`).
- Bouton **"Demander le reversement"** quand l’événement est terminé (date passée).
  - Regle de fin evenement: si `end_date` existe, l'utiliser; sinon considerer l'evenement termine a `date + 24h`.
  - Crée une entrée dans `Payouts` avec `status = pending` et `requested_at`.

### 8.3 Dashboard Admin
- Vue listant :
  - les événements terminés,
  - les demandes de reversement (`Payouts`).
- L’Admin traite manuellement les reversements (virement hors plateforme).
- Une fois le reversement effectué, l’Admin passe `Payouts.status` à `paid` et renseigne `paid_at`.

---

## 9. Résumé des Décisions Clés

- **Frontend** : Next.js PWA (mobile-first), 100 % français.
- **Backend** : Supabase (Postgres + Auth + Functions).
- **Auth** : OTP par téléphone, sans mot de passe, inspiré de `NeoLove`.
- **Multi-rôles** : gérés via `Users.roles` + table de liaison `EventScanners`.
- **Paiement** : Orange Money (Burkina Faso), webhook + polling manuel "Vérifier mon paiement".
- **Tickets** : QR Code sécurisé basé sur `qr_code_hash`, génération d’image à la volée.
- **WhatsApp** : envoi via API Wasender, d’abord vers un numéro de test.
- **Escrow** : commission 10 %, reversement manuel tracé par la table `Payouts`.

---

## 10. Fichiers de Reference (Etape 1)

Cette section decrit le role des fichiers crees pendant la phase d'initialisation pour accelerer l'onboarding des futurs developpeurs.

### 10.1 Dossier application web
- `web/package.json` : dependances et scripts du projet (`dev`, `build`, `start`, `lint`).
- `web/src/app/layout.tsx` : layout racine, metadata globale, declaration PWA et enregistrement du service worker.
- `web/src/app/page.tsx` : page d'accueil minimale (coquille vide) pour valider le boot sans logique metier.
- `web/src/components/auth/login-phone-form.tsx` : formulaire de connexion etape 2.1 (champ numero, validation frontend chiffres uniquement, CTA `Recevoir le code`).
- `web/src/app/page.tsx` : point d'entree UI courant affichant l'ecran de connexion etape 2.1.
- `web/src/app/globals.css` : styles globaux de base pour le shell mobile-first.
- `web/src/app/manifest.ts` : manifest web PWA (nom app, theme, icones, mode standalone).
- `web/public/sw.js` : service worker minimal pour precache de base et cache runtime same-origin.
- `web/src/components/pwa-register.tsx` : composant client qui enregistre `sw.js` au chargement.

### 10.2 Variables et integration backend
- `web/.env.example` : liste canonique des variables d'environnement (Supabase, OTP, Wasender, Orange Money).
- `web/src/lib/supabase/client.ts` : creation du client Supabase cote navigateur (variables publiques).
- `web/src/lib/supabase/server.ts` : creation du client Supabase cote serveur (service role key, session non persistante).

### 10.2.1 OTP et session (Phase 2.2)
- `web/src/app/api/auth/send-otp/route.ts` : endpoint d'envoi OTP (validation numero, controle anti-abus, envoi Wasender, cookie OTP).
- `web/src/app/api/auth/verify-otp/route.ts` : endpoint de verification OTP (tentatives max, creation user, session app, nettoyage cookie OTP).
- `web/src/lib/auth/constants.ts` : constantes de securite OTP/session (TTL, cooldown, limites).
- `web/src/lib/auth/phone.ts` : normalisation et validation E.164 des numeros.
- `web/src/lib/auth/otp.ts` : generation OTP, token OTP signe HMAC, verification et gestion des tentatives.
- `web/src/lib/auth/rate-limit.ts` : controle anti-abus pour envoi OTP (memoire process).
- `web/src/lib/auth/session.ts` : creation token de session applicative signe.
- `web/src/lib/wasender.ts` : integration provider Wasender pour envoi WhatsApp du code OTP.

### 10.2.2 Gestion des roles et redirections (Phase 2.3)
- `web/src/components/auth/auth-provider.tsx` : state global client pour utilisateur connecte, roles et role actif.
- `web/src/app/api/auth/me/route.ts` : endpoint qui lit/verifie le cookie de session et retourne le profil minimal.
- `web/src/lib/auth/roles.ts` : normalisation des roles et mapping role -> route.
- `web/src/components/auth/home-entry.tsx` : gate de la page `/` (redirige un utilisateur connecte vers sa route role).
- `web/src/app/buyer/page.tsx` : ecran cible role `buyer`.
- `web/src/app/organizer/dashboard/page.tsx` : ecran cible role `organizer`.
- `web/src/app/scanner/scan/page.tsx` : ecran cible role `scanner`.
- `web/src/app/admin/dashboard/page.tsx` : ecran cible role `admin`.

### 10.3 Creation d'evenement organisateur (Phase 3.1)
- `web/src/app/organizer/dashboard/page.tsx` : ecran organisateur contenant le formulaire de creation d'evenement.
- `web/src/components/organizer/create-event-form.tsx` : formulaire client multipart (texte + image) et affichage des retours API.
- `web/src/app/api/organizer/events/route.ts` : endpoint backend securise (session/role), validation des champs, upload image Storage, insertion SQL dans `events`.
- `web/.env.example` : variable `SUPABASE_STORAGE_EVENTS_BUCKET` pour configurer le bucket d'images evenement.

### 10.4 Dashboard organisateur (Phase 3.2)
- `web/src/app/api/organizer/dashboard/route.ts` : endpoint de synthese organisateur (liste events + metriques tickets/fonds + statut calcule).
- `web/src/components/organizer/events-overview.tsx` : tableau frontend des evenements avec tickets vendus, fonds et statut.
- `web/src/components/organizer/organizer-dashboard-content.tsx` : orchestration dashboard (synthese + formulaire de creation + refresh).
- `web/src/components/organizer/create-event-form.tsx` : expose un callback `onCreated` pour recharger la synthese apres soumission reussie.

### 10.5 Gestion des scanneurs (Phase 3.3)
- `web/src/app/api/organizer/scanners/route.ts` :
  - `POST` pour inviter un scanneur par numero (creation user invite si absent + role scanner + liaison `event_scanners`).
  - `GET` pour lister les scanneurs assignes a un evenement.
- `web/src/components/organizer/scanner-management.tsx` : interface d'invitation scanneur (selection evenement + numero) et liste des scanneurs deja assignes.
- `web/src/components/organizer/organizer-dashboard-content.tsx` : integre le module scanneurs dans le dashboard organisateur.

### 10.6 Vue acheteur et demarrage achat (Phase 4.1)
- `web/src/app/buyer/page.tsx` : page acheteur qui charge les evenements publies.
- `web/src/components/buyer/event-catalog.tsx` :
  - affichage catalogue + detail d'un evenement,
  - bouton `Acheter un ticket`,
  - modale Orange Money demandant le numero de paiement et affichant le prix exact.
- `web/src/app/api/events/route.ts` : endpoint de lecture des evenements publies pour consommation frontend.

### 10.7 Paiement Orange Money et livraison ticket (Phases 4.2 -> 5.2)
- `web/src/lib/orange-money.ts` : classe `OrangeMoneyService` (OAuth2, initiation paiement, verification OTP, verification signature webhook).
- `web/src/app/api/pay/initiate/route.ts` : initialise un paiement OM, cree `ticket`/`transaction` en `pending`, applique la commission 10%.
- `web/src/app/api/pay/verify/route.ts` : verifie le code OTP OM et finalise le paiement localement en `success`.
- `web/src/app/api/webhooks/orange/route.ts` : reception webhook Orange avec securite (HMAC ou IP allowlist) puis finalisation/annulation.
- `web/src/lib/payments/payment-workflow.ts` : logique centrale de transition `pending -> success/failed`, generation `qr_code_hash`, mise a jour tables et envoi WhatsApp.
- `web/src/app/api/qr/[ticketId]/route.ts` : generation image PNG du QR a la volee depuis `tickets.qr_code_hash`.
- `web/src/lib/wasender.ts` : envoi OTP + envoi ticket WhatsApp apres paiement valide.
- `web/.env.example` : variables Orange Money et webhook (`OM_*`) + `NEXT_PUBLIC_APP_URL` pour construire le lien QR envoye.

### 10.3 Schema base de donnees (Phase 1.2)
- `web/supabase/migrations/20260307_120000_init_schema.sql` : migration initiale Postgres/Supabase contenant :
  - enums metier (`user_status`, `event_status`, `ticket_status`, `transaction_status`, `payout_status`),
  - tables `users`, `events`, `tickets`, `transactions`, `event_scanners`, `payouts`,
  - cles etrangeres, contraintes de coherence et format E.164,
  - trigger commun `set_updated_at` + triggers par table,
  - indexes principaux pour les parcours MVP,
  - vue `v_events_with_effective_end` pour appliquer la regle de fin d'evenement (`end_date` sinon `date + 24h`).

### 10.4 Documentation projet
- `web/README.md` : guide de demarrage local, variables attendues et commandes de verification de l'etape 1.1.
- `Banque de mémoire /implementation.md` : plan d'implementation maitre par phases/etapes.
- `Banque de mémoire /progress.md` : suivi d'avancement operationnel et statut des etapes.


---

## Addendum MVP - Paiement USSD assiste + validation manuelle

Flux retenu (unique pour MVP):
1. Acheteur initie depuis la modale et compose le code USSD Orange.
2. Backend cree transaction/ticket `pending` via `/api/payments/initiate`.
3. Admin recoit alerte WhatsApp et verifie les SMS Orange recu.
4. Admin valide/rejette depuis `/admin/validate-payments`.
5. Validation -> transaction `success`, ticket `paid`, QR envoye par WhatsApp.
6. Rejet -> transaction `failed`, ticket `cancelled`.

Composants/API principaux:
- `web/src/components/buyer/event-catalog.tsx`
- `web/src/app/buyer/payment-pending/page.tsx`
- `web/src/app/api/payments/initiate/route.ts`
- `web/src/app/api/admin/payments/pending/route.ts`
- `web/src/app/api/admin/payments/validate/route.ts`
- `web/src/app/api/admin/payments/reject/route.ts`
- `web/src/app/admin/validate-payments/page.tsx`
- `web/src/components/admin/validate-payments-panel.tsx`

Variables d'environnement associees:
- `NEXT_PUBLIC_OM_MERCHANT_NUMBER`
- `SUPPORT_PHONE`
- `NEXT_PUBLIC_SUPPORT_PHONE`
- `ADMIN_ALERT_PHONE`
