# 📱 Guide Officiel des Liens & QR Codes de Réservation des Espaces (IDS)

Ce document répertorie **tous les liens officiels et QR Codes de réservation d'espaces** de l'Incubateur Digital Solidaire (IDS), hébergés sur le relais Cloud public 24h/24 :
🔗 **https://ids-production-app-6aba82b6af10.herokuapp.com**

Ce portail est spécialement conçu pour être **partagé avec les incubés**, scanné par **QR Code sur place**, ou **intégré dans un site web / une autre plateforme**.

---

## 🌐 1. Le Portail Général de Réservation

Il s'agit du lien d'entrée principal qui présente les 3 espaces avec un bouton direct pour chacun :

| Intitulé | URL Publique Officielle | Utilisation recommandée |
| :--- | :--- | :--- |
| **Portail Global IDS** | `https://ids-production-app-6aba82b6af10.herokuapp.com/` | À partager dans les emails de bienvenue, WhatsApp des incubés, ou bouton "Réserver" sur le site web officiel |

Sur cette page d'accueil :
- **Aucune mention de la formation / émargement** (dédiée uniquement à la présence physique lors des ateliers).
- Uniquement les **3 boutons et fiches détaillées** pour réserver immédiatement un espace.

---

## 📍 2. Liens Directs par Espace (Correspondance exacte avec les QR Codes)

Chaque QR Code affiché dans votre interface locale (*Gestion des Espaces*) ou imprimé sur les portes correspond exactement à l'une de ces 3 adresses :

### 🛠️ A. Espace FabLab
- **URL Directe du QR Code :**  
  `https://ids-production-app-6aba82b6af10.herokuapp.com/booking/fablab`
- **Zones & Ateliers :**
  - *Fablab 1 (Étage)* : Prototypage, Impression 3D (Creality/Bambu), Découpeuse Laser.
  - *Sous-sol* : Fraiseuse CNC, thermoformage, mécanique lourde.
- **Créneaux :** 8 créneaux de 1 heure (de 08h à 16h).

---

### 🎙️ B. Studio Média / Photo
- **URL Directe du QR Code :**  
  `https://ids-production-app-6aba82b6af10.herokuapp.com/booking/studio`
- **Zones & Ateliers :**
  - *Studio Média* : Plateau vidéo 4K, Podcasts, Photographie de produits.
- **Créneaux :** 2 créneaux de 4 heures (09h - 13h et 13h - 17h).

---

### 👥 C. Salles de Réunion & Formation
- **URL Directe du QR Code :**  
  `https://ids-production-app-6aba82b6af10.herokuapp.com/booking/salle_reunion`
- **Zones & Ateliers :**
  - *Salle 1 (6-8 personnes)* : Réunions partenaires, entretiens.
  - *Salle 2 (6-8 personnes)* : Brainstorming, travail collaboratif.
  - *Salle de Formation (20+ personnes)* : Ateliers collectifs, masterclasses.
- **Créneaux :** 7 créneaux de 2 heures (de 08h à 22h).

---

## 💻 3. Comment Intégrer ce Module sur une Autre Plateforme ?

Vous pouvez intégrer la réservation des espaces sur n'importe quel site web (WordPress, Webflow, intranet, application mobile web) de deux manières :

### Option 1 : Bouton d'action direct (Recommandé)
Insérez ce code HTML sur votre site pour ouvrir le formulaire de réservation dans un nouvel onglet :

```html
<!-- Bouton Portail Général -->
<a href="https://ids-production-app-6aba82b6af10.herokuapp.com" 
   target="_blank" 
   style="display:inline-block; padding:12px 24px; background:#f59e0b; color:#ffffff; font-weight:bold; border-radius:12px; text-decoration:none;">
   📅 Réserver un Espace IDS
</a>

<!-- Ou Bouton FabLab spécifique -->
<a href="https://ids-production-app-6aba82b6af10.herokuapp.com/booking/fablab" 
   target="_blank" 
   style="display:inline-block; padding:12px 24px; background:#ea580c; color:#ffffff; font-weight:bold; border-radius:12px; text-decoration:none;">
   🛠️ Réserver le FabLab
</a>
```

### Option 2 : Intégration en Iframe (Directement incrusté dans la page)
Pour que le formulaire apparaisse directement au cœur de votre page web externe sans redirection :

```html
<iframe 
  src="https://ids-production-app-6aba82b6af10.herokuapp.com" 
  width="100%" 
  height="850px" 
  style="border:none; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.15);"
  title="Réservation des Espaces IDS">
</iframe>
```

---

## 🔒 4. Sécurité et Liste Blanche (Rappel)

- Tout incubé ou membre de l'équipe IDS souhaitant réserver doit saisir son **adresse email** ou son **numéro de projet (PP)**.
- Le Cloud Heroku vérifie automatiquement si l'email existe dans la **liste blanche synchronisée**.
- Les réservations sont automatiquement enregistrées sur Heroku puis **aspirées toutes les 10 minutes** par le serveur physique local du FabLab (`10.0.5.126`).
