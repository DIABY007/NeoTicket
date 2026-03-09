# NeoTicket Web (MVP)

Socle etape 1.1 du plan d'implementation: application Next.js (App Router) avec base PWA et configuration Supabase par variables d'environnement.

## Prerequis

- Node.js 20+
- npm 10+

## Installation

```bash
npm install
cp .env.example .env.local
```

Renseigner ensuite les variables dans `.env.local`.

## Variables d'environnement

Variables minimales pour le lien frontend/backend:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Variables deja preparees pour les etapes suivantes:

- `OTP_SIGNING_SECRET`
- `WASENDER_API_URL`
- `WASENDER_API_KEY`
- `NEXT_PUBLIC_OM_MERCHANT_NUMBER`
- `SUPPORT_PHONE`
- `NEXT_PUBLIC_SUPPORT_PHONE`
- `ADMIN_ALERT_PHONE`

## Lancer le projet

```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Verification etape 1.1

```bash
npm run lint
npm run build
```

Comportement attendu:

- l'application demarre sans erreur,
- la page d'accueil est volontairement vide,
- le manifest PWA est servi,
- le service worker se registre cote client.
