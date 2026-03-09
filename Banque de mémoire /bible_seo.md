📜 La Bible SEO : NeoTicket (Mars 2026)
1. Fondations Techniques (Stack Next.js 16)
Comme la plateforme utilise le App Router, l'IA doit maximiser l'usage du Server-Side Rendering (SSR) pour l'indexation.

Metadata Dynamiques : Chaque page d'événement doit avoir des balises <title> et description uniques générées via generateMetadata.

Format Title : [Nom de l'événement] - Billets & Tickets à [Lieu] | NeoTicket

Format Description : "Achetez vos billets pour [Nom de l'événement] le [Date] à [Ville]. Paiement sécurisé via Orange Money. Recevez votre QR Code par WhatsApp."

Données Structurées (JSON-LD) : Crucial pour apparaître en "Rich Snippets" (extraits enrichis) sur Google. L'IA doit injecter le schéma Event sur chaque page produit :

name, startDate, location (Place), image, offers (Price, PriceCurrency: XOF, Availability).

Optimisation des Images : Utiliser le composant next/image. Pour les affiches stockées sur Supabase, s'assurer que l'attribut alt contient toujours : "Affiche de l'événement [Nom]".

2. SEO Local & Marché Burkinabè
Le SEO doit cibler les intentions de recherche locales au Burkina Faso.

Mots-Clés Prioritaires : "Concert Bobo-Dioulasso", "Événement Ouagadougou", "Ticket Orange Money Burkina", "Sortir à Ouaga", "Billetterie en ligne Faso".

Pages de Destination (Landing Pages) : Créer des pages de catégories optimisées par ville ou par type d'événement :

neoticket.bf/events/ouagadougou

neoticket.bf/events/concerts

Performance PWA : Google favorise les sites rapides sur mobile. Puisque la cible est au Burkina (connexion parfois instable), le score Lighthouse doit rester > 90. L'IA doit implémenter le cache-first via le Service Worker pour une navigation instantanée.

3. Stratégie de Contenu (Sémantique)
L'IA doit structurer le site pour répondre aux questions des utilisateurs.

Le "Guide du Participant" : Une section FAQ ou blog indexable répondant à :

"Comment acheter un ticket par Orange Money ?"

"Comment récupérer mon QR Code sur WhatsApp ?"

Hiérarchie Hn :

H1 : Nom de l'événement (un seul par page).

H2 : "Détails de l'événement", "Lieu et Accès", "Tarification des billets".

H3 : Sous-sections (ex: "Pass VIP", "Pass Standard").

4. Netlinking & Social SEO
Partage WhatsApp : Puisque WhatsApp est l'outil principal de livraison (Wasender), l'IA doit ajouter des boutons de partage Open Graph (og:image, og:title) optimisés. Quand un organisateur partage son lien d'événement, l'image de l'affiche doit apparaître parfaitement pour générer du clic (CTR).

URLs Propres : Utiliser des slugs lisibles.

Mauvais : neoticket.bf/event?id=12345

Bon : neoticket.bf/e/concert-nom-artiste-ouaga-2026

5. Check-list de l'IA Développeur
Demandez à votre IA de vérifier ces points lors de chaque déploiement :

Robots.txt & Sitemap : Générer automatiquement un sitemap.xml incluant tous les événements actifs (non clôturés).

Canonical URLs : Éviter le contenu dupliqué entre les versions avec ou sans slash final.

Vitesse de chargement (LCP) : L'image d'affiche (LCP) doit être priorisée avec l'attribut priority dans Next.js.

Accessibilité (A11y) : Utiliser des balises HTML sémantiques (main, section, article) pour que les robots de Google comprennent la structure.

6. Variables d'Environnement SEO
S'assurer que ces variables sont bien configurées pour le SEO :

NEXT_PUBLIC_SITE_URL : Pour générer les URLs absolues dans les balises meta.

NEXT_PUBLIC_GA_ID : Votre ID Google Analytics (GA4) pour le suivi.

Ta **bible SEO actuelle est correcte mais incomplète**.
Elle couvre la technique de base (metadata, schema, SSR), mais elle **ignore plusieurs leviers SEO critiques** pour une marketplace d’événements :

* SEO **programmatique** (très puissant pour ton modèle)
* **indexation massive des événements**
* **stratégie long-tail locale**
* **pages organisateurs / lieux**
* **maillage interne**
* **SEO transactionnel**
* **données structurées avancées**

Bref : ta base est bonne, mais **elle n’exploite pas le vrai potentiel d’une billetterie**.

Je te propose une **version étendue et plus solide** basée sur l’architecture et les flux de NeoTicket. 

---

# 📜 Bible SEO Complète — NeoTicket

## 1. Architecture SEO du site

Un site d’événements doit être **structuré pour produire des milliers de pages indexables**.

Structure recommandée :

```
/
 /events
 /events/ouagadougou
 /events/bobo-dioulasso
 /events/concerts
 /events/festivals
 /events/conferences
 /e/[slug-evenement]
 /organizer/[organizer-name]
 /venues/[venue-name]
 /blog
 /guide
```

Pourquoi ?

Google comprend mieux :

* **lieu**
* **type d’événement**
* **date**
* **organisateur**

Sans cette structure tu laisses **80% du SEO sur la table**.

---

# 2. SEO Programmatique (le vrai levier)

Une billetterie peut générer **des centaines de pages automatiquement**.

Exemples :

### Pages par ville

```
/events/ouagadougou
/events/bobo-dioulasso
/events/koudougou
/events/banfora
```

Optimisation :

Title

```
Événements à Ouagadougou 2026 – Concerts, Festivals | NeoTicket
```

H1

```
Événements à Ouagadougou
```

Contenu dynamique :

* événements à venir
* événements populaires
* lieux populaires

---

### Pages par type d'événement

```
/events/concerts
/events/festivals
/events/conferences
/events/spectacles
```

Title :

```
Concerts au Burkina Faso – Billets & Tickets | NeoTicket
```

---

### Pages combinées (gros SEO)

```
/events/ouagadougou/concerts
/events/bobo-dioulasso/festivals
/events/ouagadougou/conferences
```

Ces pages captent :

```
concert ouagadougou
festival ouaga
conférence bobo dioulasso
```

Ce sont **les requêtes qui convertissent**.

---

# 3. SEO des Pages Événements

Chaque page `/e/[slug]` doit être **parfaitement optimisée**.

Title :

```
[Nom événement] à [Ville] – Billets & Tickets | NeoTicket
```

Meta description :

```
Achetez votre billet pour [Nom événement] le [Date] à [Ville].
Paiement Orange Money sécurisé. Recevez votre QR code sur WhatsApp.
```

Slug SEO :

```
/e/concert-floby-ouagadougou-2026
```

---

## Structure de contenu

H1

```
Concert Floby à Ouagadougou
```

H2

```
Détails de l'événement
Lieu et accès
Tarifs des billets
Programme
Questions fréquentes
```

---

# 4. Données Structurées (Rich Snippets)

Tu utilises déjà `Event Schema`. Bien.
Mais il faut **l’enrichir**.

JSON-LD complet :

```
Event
Offer
Organization
Place
FAQ
Breadcrumb
```

Exemple :

```
{
 "@context": "https://schema.org",
 "@type": "Event",
 "name": "Concert Floby",
 "startDate": "2026-05-18T20:00",
 "location": {
   "@type": "Place",
   "name": "Palais des Sports",
   "address": "Ouagadougou"
 },
 "offers": {
   "@type": "Offer",
   "price": "7200",
   "priceCurrency": "XOF",
   "availability": "https://schema.org/InStock"
 }
}
```

Effet :

* Rich results
* CTR plus élevé
* meilleure compréhension Google

---

# 5. SEO Local (Burkina Faso)

Le marché est **très localisé**.

Intentions dominantes :

```
concert ouaga
sortir ouagadougou
evenement bobo dioulasso
festival burkina
ticket concert ouaga
```

Pages essentielles :

```
/events/ouagadougou
/events/bobo-dioulasso
/events/banfora
/events/koudougou
```

Ajoute :

```
schema LocalBusiness
```

Pour NeoTicket.

---

# 6. SEO Organisateur

Chaque organisateur devrait avoir une page :

```
/organizer/[slug]
```

Exemple :

```
/organizer/musique-faso
```

Contenu :

* bio organisateur
* événements passés
* événements à venir

Title :

```
Événements organisés par Musique Faso | NeoTicket
```

---

# 7. SEO Lieux

Pages pour les lieux populaires.

```
/venues/palais-des-sports
/venues/canal-olympia
/venues/maison-du-peuple
```

Contenu :

* événements dans ce lieu
* adresse
* carte

Requête captée :

```
concert palais des sports
evenement canal olympia
```

---

# 8. SEO Contenu (Blog / Guide)

Section :

```
/guide
```

Articles :

```
Comment acheter un ticket Orange Money
Comment scanner un QR code à un événement
Les 10 meilleurs festivals du Burkina Faso
Que faire à Ouagadougou ce week-end
```

But :

* capter trafic informationnel
* pousser vers événements

---

# 9. Stratégie Long Tail

Pages générées automatiquement :

```
concert ouagadougou mai 2026
festival burkina 2026
sortir ouaga weekend
```

Structure :

```
/events/ouagadougou?month=may
```

---

# 10. Maillage Interne

Chaque page événement doit lier vers :

* ville
* type d’événement
* organisateur
* lieu

Exemple :

```
Concert Floby
→ événements à Ouagadougou
→ concerts au Burkina
→ événements au Palais des Sports
→ autres événements de Musique Faso
```

Effet :

* crawl profond
* autorité distribuée

---

# 11. SEO Mobile (critique pour ton marché)

Burkina = **mobile dominant**.

Objectif Lighthouse :

```
Performance > 90
Accessibility > 90
Best practices > 90
SEO > 95
```

Optimisations :

* images compressées
* lazy loading
* service worker
* CDN Supabase

---

# 12. Open Graph (Social SEO)

WhatsApp partage = **trafic énorme**.

Meta OG :

```
og:title
og:description
og:image
og:url
```

Image :

```
1200x630
```

Quand un organisateur partage :

```
l'affiche apparaît parfaitement
```

→ CTR multiplié.

---

# 13. Sitemap Intelligent

Ton sitemap doit inclure :

```
/
 /events
 /events/[city]
 /events/[type]
 /e/[event-slug]
 /organizer/[organizer]
 /venues/[venue]
 /blog/[article]
```

MAIS **exclure** :

```
draft events
cancelled events
admin pages
scanner pages
buyer pages
```

---

# 14. Indexation des événements expirés

Grosse erreur classique :

**supprimer les pages après l'événement**.

Ne fais pas ça.

Quand un événement est terminé :

* conserver la page
* ajouter section :

```
Cet événement est terminé.
Découvrez les prochains événements similaires.
```

Google garde le ranking.

---

# 15. SEO Technique Next.js

Optimisations spécifiques :

### Server Components

Toutes les pages publiques doivent être :

```
SSR ou ISR
```

Jamais full client.

---

### Revalidation

```
revalidate: 300
```

pour les pages événement.

---

### Dynamic Metadata

Utiliser :

```
generateMetadata()
```

pour générer automatiquement :

* title
* description
* OG

---

# 16. Checklist SEO à chaque déploiement

* sitemap.xml valide
* robots.txt correct
* canonical URLs
* schema.org validé
* pages < 2.5s LCP
* images optimisées
* OG tags présents
* liens internes présents

---

# 17. KPI SEO à suivre

Google Search Console :

Surveiller :

```
clics
impressions
CTR
position moyenne
```

Pages clés :

```
events/ouagadougou
events/concerts
e/[slug]
```

---

# 18. Opportunité SEO Massive (si tu veux dominer)

Créer la page :

```
/agenda-ouagadougou
```

Titre :

```
Agenda Ouagadougou 2026 – Tous les événements
```

Cette page peut **devenir la référence locale**.

> NeoTicket permet à des **organisateurs** de créer des événements et de vendre des tickets en ligne. Les **acheteurs** paient via **Orange Money (USSD)**, reçoivent leur **QR code par WhatsApp**.  

---

## 1 Architecture programmatique et routes à générer
**Pattern de pages à produire automatiquement (priorité haute)**  
- **Pages globales** : `/events`, `/guide`, `/blog`, `/agenda-ouagadougou`  
- **Pages par ville** : `/events/ouagadougou`, `/events/bobo-dioulasso`, `/events/koudougou`  
- **Pages par type** : `/events/concerts`, `/events/festivals`, `/events/conferences`  
- **Combinaisons (long‑tail)** : `/events/ouagadougou/concerts`, `/events/bobo-dioulasso/festivals`  
- **Pages événement** : `/e/[slug-evenement]` (slug lisible : `concert-floby-ouagadougou-2026`)  
- **Organisateurs & lieux** : `/organizer/[slug]`, `/venues/[slug]`

**Règles SEO programmatique**  
- Générer **title**, **meta description**, **og:** et **JSON‑LD** à la création/édition d’un événement via `generateMetadata()` côté serveur.  
- Pages listées par date (mois/année) : créer pages indexables `/events/ouagadougou/2026/05` pour capter requêtes long‑tail.  
- Pagination : utiliser `rel="next/prev"` et canonical vers la page 1 pour éviter dilution.

---

## 2 Templates de metadata et snippets techniques (Next.js 16 App Router)
**Title pattern (événement)**  
```
[Nom événement] à [Ville] – Billets & Tickets | NeoTicket
```
**Meta description (événement)**  
```
Achetez vos billets pour [Nom événement] le [Date] à [Ville]. Paiement Orange Money sécurisé. Recevez votre QR Code par WhatsApp.
```
**generateMetadata() — recommandations**  
- Exécuter côté serveur (Server Component) pour SSR.  
- Inclure `openGraph` (title, description, url, images[ { url, alt, width, height } ]) et `twitter` card.  
- Ajouter `alternates.canonical` = `${NEXT_PUBLIC_SITE_URL}/e/${slug}`.  
- Revalidate : `revalidate: 300` pour pages événement.

**Images**  
- Utiliser `next/image` avec `priority` pour l’affiche (LCP).  
- `alt` obligatoire : **"Affiche de l'événement [Nom]"** (conforme au bucket Supabase).  
- Servir via CDN Supabase ou proxy d’images pour compression et WebP.

---

## 3 JSON‑LD enrichi (exemple complet à injecter dans `<head>`)

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Concert Floby",
  "startDate": "2026-05-18T20:00:00",
  "endDate": "2026-05-18T23:00:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "location": {
    "@type": "Place",
    "name": "Palais des Sports",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Ouagadougou",
      "addressCountry": "BF"
    }
  },
  "image": ["https://.../event-posters/floby.jpg"],
  "description": "Achetez votre billet pour Concert Floby le 18 mai à Ouagadougou. Paiement Orange Money sécurisé.",
  "offers": {
    "@type": "Offer",
    "url": "https://neoticket.bf/e/concert-floby-ouagadougou-2026",
    "price": "3800",
    "priceCurrency": "XOF",
    "availability": "https://schema.org/InStock",
    "validFrom": "2026-03-01T00:00:00"
  },
  "organizer": {
    "@type": "Organization",
    "name": "Musique Faso",
    "url": "https://neoticket.bf/organizer/musique-faso"
  },
  "performer": {
    "@type": "Person",
    "name": "Floby"
  }
}
```

**À ajouter** : `FAQPage` JSON‑LD (questions fréquentes sur paiement OM, QR WhatsApp), `BreadcrumbList` pour améliorer l’affichage en SERP.

---

## 4 Indexation, cycle de vie et pages expirées
- **Ne pas supprimer** les pages après l’événement. Conserver et afficher clairement : *"Cet événement est terminé."* avec suggestions d’événements similaires (conserve le ranking).  
- **Status handling** : `published`, `ended`, `cancelled` → `sitemap.xml` inclut `published` + `ended` (si page conservée), exclut `draft`/`cancelled`.  
- **Meta robots** : pour pages de filtre (ex. `?city=ouagadougou&page=2`) utiliser `noindex,follow` si elles créent duplication ; canonicaliser vers la version propre.  
- **Faceted navigation** : bloquer indexation des combinaisons non utiles (tri, filtres multiples) via robots/meta.

---

## 5 Sitemap, robots, canonical, hreflang
- **Sitemap generator** : job server-side (cron / on-change) qui exporte : `/e/*`, `/events/*`, `/organizer/*`, `/venues/*`, `/guide/*`. Exclure `draft`, `cancelled`, pages admin.  
- **Robots.txt** : pointer vers sitemap, bloquer `/admin`, `/scanner`, `/buyer/*`.  
- **Canonical rules** : canonicaliser `/e/slug` sans trailing slash; rediriger 301 des variantes.  
- **hreflang** : si futur multi‑langue, ajouter hreflang sur pages événement/guide.

---

## 6 Maillage interne & conversion (UX → SEO)
- Sur chaque page événement : liens vers **ville**, **type**, **organisateur**, **venue**.  
- Sur pages ville/type : afficher événements à venir + événements populaires + liens vers lieux et organisateurs.  
- CTA SEO‑friendly : microcopy optimisée (ex. bouton “Acheter un ticket Orange Money” avec attribut `data-analytics` pour suivi GA4).  
- Fil d’Ariane visible et en JSON‑LD `BreadcrumbList`.

---

## 7 Social / Open Graph / WhatsApp
- **OG tags** générés dynamiquement via `generateMetadata()` : `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `og:type=website`.  
- **Image** : utiliser l’affiche Supabase, crop 1200×630, alt = affiche textuelle.  
- **WhatsApp** : partager l’URL canonique `/e/slug` + `og:image` ; Wasender enverra l’affiche + message (conforme au workflow).  
- **Preview testing** : automatiser checks (Facebook Sharing Debugger / Twitter Card Validator) en CI.

---

## 8 Performance mobile & PWA (impact SEO)
- **SSR/ISR** pour pages publiques ; éviter full client rendering.  
- **LCP** : prioriser l’affiche via `priority` + preload `<link rel="preload" as="image" href="...">`.  
- **Service Worker** : cache-first pour assets critiques (shell + affiches) ; fallback offline page.  
- **Bundle** : analyser et split code, éviter heavy client libs sur pages événement.  
- **Lighthouse targets** : Performance > 90, Accessibility > 90, SEO > 95.

---

## 9 Tracking, KPI et monitoring
- **Variables** : `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID` (GA4), `NEXT_PUBLIC_APP_URL` pour QR links.  
- **GSC** : soumettre sitemap, monitorer clics/impressions/CTR/position moyenne pour pages clés (`/events/ouagadougou`, `/events/concerts`, `/e/[slug]`).  
- **Alerting** : CI check pour schema.org validation, sitemap freshness, LCP thresholds.

---

## 10 Checklist technique à automatiser (pré‑déploiement)
- `generateMetadata()` renvoie title/description/OG/JSON‑LD.  
- `next/image` alt = `"Affiche de l'événement [Nom]"`.  
- LCP image flagged `priority`.  
- `sitemap.xml` mis à jour (exclure drafts/cancelled).  
- `robots.txt` correct.  
- Canonical présent et cohérent.  
- Schema.org validé (Google Rich Results test).  
- OG tags valides (1200×630).  
- Pages événement en SSR/ISR (revalidate 300s).  
- Service Worker cache-first + offline fallback.

---

## 11 Exemples d’implémentation rapide (notes dev)
- **generateMetadata** (pseudo) : charger event depuis Supabase server-side, construire metadata + og + JSON‑LD, retourner.  
- **ISR** : `export const revalidate = 300;` dans `app/e/[slug]/page.tsx`.  
- **Sitemap** : endpoint `GET /api/sitemap.xml` qui lit events published/ended et génère XML.  
- **Robots** : template env-driven (`NEXT_PUBLIC_SITE_URL`) pour pointer sitemap.

---

## 12 Priorités d’exécution (roadmap SEO 90 jours)
1. **Templates programmatique** : pages ville/type/combinaisons + metadata + JSON‑LD.  
2. **Sitemap & robots** : génération automatique + soumission GSC.  
3. **Event page polish** : LCP image priority, generateMetadata, OG, JSON‑LD complet.  
4. **Organizers & Venues pages** : templates + maillage interne.  
5. **Guide/FAQ** : articles transactionnels (OM, QR WhatsApp) pour capter intent informationnelle.  
6. **Monitoring** : GSC + Lighthouse CI + schema validation.
