const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Service de messagerie pour l'Incubateur Digital Solidaire (IDS)
 * Harmonisé avec le style clair de l'application (Charte IDS : Bleu Navy #0c87eb, Ambre #f59e0b, Ardoise #0f172a / #f8fafc)
 * Gère l'envoi d'emails transactionnels (réservations, RDV, formations, assiduité, bienvenue)
 */

// Configuration du transporteur SMTP
const getTransporter = () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const user = process.env.EMAIL_USER || process.env.MAIL_USERNAME;
  const pass = process.env.EMAIL_PASS || process.env.MAIL_PASSWORD;
  const isSecure = process.env.EMAIL_SECURE === 'true' || port === 465;

  if (user && pass) {
    return nodemailer.createTransport({
      service: 'gmail',
      host,
      port,
      secure: isSecure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
  }

  // Si non configuré, transporteur de test / simulation pour ne pas faire crasher l'app
  return null;
};

/**
 * Échappement des caractères spéciaux HTML pour sécuriser les templates emails
 */
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Gabarit HTML moderne, épuré et responsive harmonisé avec le style clair de l'application IDS
 */
const renderEmailTemplate = ({ title, preheader, badgeText, badgeColor = '#0c87eb', contentHtml, ctaText, ctaUrl }) => {
  const accentColor = badgeColor;
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const actionButton = ctaText && ctaUrl ? `
    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${ctaUrl}" style="background: linear-gradient(135deg, #0c87eb 0%, #006ac9 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(12, 135, 235, 0.28); letter-spacing: 0.2px;">
        ${escapeHtml(ctaText)} →
      </a>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0; }
    .top-accent { height: 4px; background: linear-gradient(90deg, #0c87eb 0%, #36a3f7 50%, #f59e0b 100%); }
    .header { background: #ffffff; padding: 28px 28px 22px 28px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .header h1 { margin: 0; color: #00254d; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
    .header .subtitle-pill { display: inline-block; margin-top: 8px; background: #f0f7ff; color: #0c87eb; border: 1px solid #b9ddfd; padding: 3px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    .body { padding: 32px 28px; background: #ffffff; line-height: 1.6; font-size: 14px; color: #334155; }
    .badge { display: inline-block; padding: 5px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 18px; letter-spacing: 0.3px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 22px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Barre d'accentuation IDS (Bleu Navy -> Cyan -> Ambre Or) -->
    <div class="top-accent"></div>

    <!-- En-tête style clair IDS -->
    <div class="header">
      <h1>Incubateur Digital Solidaire</h1>
      <span class="subtitle-pill">Fablab & Innovation • Plateforme IDS</span>
    </div>

    <!-- Contenu -->
    <div class="body">
      ${badgeText ? `<div style="text-align: left;"><span class="badge" style="background: ${accentColor}15; color: ${accentColor}; border: 1px solid ${accentColor}35;">${escapeHtml(badgeText)}</span></div>` : ''}
      ${contentHtml}
      ${actionButton}
    </div>

    <!-- Pied de page style clair -->
    <div class="footer">
      <p style="margin: 0 0 6px 0; font-weight: 700; color: #00254d;">Incubateur Digital Solidaire (IDS) & Fablab</p>
      <p style="margin: 0 0 6px 0;">Cet email automatique a été généré par la plateforme de gestion de l'incubateur.</p>
      <p style="margin: 0; font-size: 10px; color: #94a3b8;">Pour toute question, contactez votre chargé d'accompagnement ou l'administration IDS.</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Fonction générique d'envoi d'email
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM_ADDRESS
    ? `"${process.env.MAIL_FROM_NAME || 'Incubateur Digital Solidaire'}" <${process.env.MAIL_FROM_ADDRESS}>`
    : '"Incubateur Digital Solidaire" <incubateur.ids.contact@gmail.com>';

  const recipient = to || process.env.ADMIN_NOTIFY_EMAIL || 'contact@ids-incubateur.ma';

  if (!transporter) {
    console.log(`\n======================================================`);
    console.log(`📧 [SIMULATION EMAIL IDS] (SMTP non configuré dans .env)`);
    console.log(`➡️ Destinataire : ${recipient}`);
    console.log(`📌 Sujet        : ${subject}`);
    console.log(`💬 Message brut : ${text || 'Contenu HTML généré'}`);
    console.log(`======================================================\n`);
    return { success: true, simulated: true, recipient, subject };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject,
      text: text || '',
      html
    });
    console.log(`✅ [EMAIL ENVOYÉ RÉELLEMENT] ID: ${info.messageId} vers ${recipient}`);
    return { success: true, simulated: false, messageId: info.messageId, recipient, subject };
  } catch (error) {
    console.error(`❌ [ERREUR SMTP ENVOI EMAIL] vers ${recipient}:`, error.message);
    return { success: false, error: error.message, recipient, subject };
  }
};

/**
 * 1. Notification de statut de Réservation d'Espace
 */
const sendReservationStatusEmail = async (reservation, statut, motifRefus = '') => {
  const isValide = statut === 'valide';
  const recipient = reservation.emailIncube || reservation.email || 'incubé@ids.ma';
  const nomIncube = reservation.nomIncube || reservation.nomComplet || 'Incubé';
  const precisionSalle = reservation.salleSpecifique ? ` (${reservation.salleSpecifique})` : '';
  const espace = `${(reservation.espace || 'Espace').toUpperCase()}${precisionSalle}`;
  const dateStr = reservation.dateReservation || 'Date non précisée';
  const horaire = `${reservation.heureDebut || '—'} à ${reservation.heureFin || '—'}`;

  const subject = isValide
    ? `✅ Confirmation de votre réservation : ${espace}`
    : `❌ Information concernant votre réservation : ${espace}`;

  const badgeText = isValide ? 'Réservation Validée' : 'Réservation Non Retenue';
  const badgeColor = isValide ? '#059669' : '#dc2626';

  const safeNom = escapeHtml(nomIncube);
  const safeEspace = escapeHtml(espace);
  const safeDate = escapeHtml(dateStr);
  const safeHoraire = escapeHtml(horaire);
  const safeMotif = escapeHtml(motifRefus || 'Créneau indisponible ou maintenance planifiée');

  const contentHtml = isValide ? `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Nous avons le plaisir de vous informer que votre demande de réservation d'espace a été <strong>VALIDÉE</strong> par l'équipe d'administration de l'incubateur.</p>
    
    <div class="card">
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Espace réservé :</td><td style="padding: 6px 0; font-weight: 800; color: #00254d;">${safeEspace}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date :</td><td style="padding: 6px 0; font-weight: 700; color: #0c87eb;">${safeDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Créneau horaire :</td><td style="padding: 6px 0; font-weight: 700; color: #00254d;">${safeHoraire}</td></tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #475569;">⚠️ <strong>Consignes d'accès :</strong> Merci d'arriver à l'heure, de respecter le matériel mis à votre disposition et d'enregistrer la fiche d'état des lieux avant et après votre séance.</p>
  ` : `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Nous vous informons que votre demande de réservation pour l'espace <strong>${safeEspace}</strong> le <strong>${safeDate}</strong> (${safeHoraire}) n'a pas pu être validée pour le motif suivant :</p>
    
    <div class="card" style="border-left: 4px solid #dc2626; background: #fef2f2; border-top: 1px solid #fee2e2; border-right: 1px solid #fee2e2; border-bottom: 1px solid #fee2e2;">
      <p style="margin: 0; color: #991b1b; font-weight: 600; font-size: 13px;">« ${safeMotif} »</p>
    </div>

    <p style="font-size: 13px;">Nous vous invitons à vous reconnecter sur la plateforme pour choisir un autre créneau ou réserver un espace alternatif.</p>
  `;

  const html = renderEmailTemplate({
    title: isValide ? 'Réservation Validée' : 'Réservation Non Retenue',
    preheader: `${safeEspace} - ${safeDate}`,
    badgeText,
    badgeColor,
    contentHtml,
    ctaText: "Accéder à l'Espace Booking",
    ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking`
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomIncube}, votre réservation pour ${espace} le ${dateStr} (${horaire}) est ${isValide ? 'VALIDÉE' : 'REFUSÉE'}.${motifRefus ? ` Motif : ${motifRefus}` : ''}`
  });
};

/**
 * 2. Notification de Confirmation de Rendez-vous d'accompagnement / Mentoring
 */
const sendRdvConfirmationEmail = async (rdv, incube = {}) => {
  const recipient = incube.email || rdv.emailIncube || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || rdv.incubeNoms || 'Porteur de Projet';
  const accompagnateur = rdv.accompagnateurNom || 'Accompagnateur IDS';
  const sujet = rdv.sujet || 'Point d’étape & Diagnostic';
  const dateStr = rdv.dateRdv || 'Date à définir';
  const heureStr = rdv.heureRdv || '—';
  const duree = rdv.duree || '1h';
  const lieu = rdv.lieu || 'Bureaux Incubateur IDS / Fablab';

  const subject = `📅 Rendez-vous d'accompagnement : ${sujet}`;

  const safeNom = escapeHtml(nomIncube);
  const safeSujet = escapeHtml(sujet);
  const safeAccomp = escapeHtml(accompagnateur);
  const safeDate = escapeHtml(dateStr);
  const safeHeure = escapeHtml(heureStr);
  const safeDuree = escapeHtml(duree);
  const safeLieu = escapeHtml(lieu);
  const safeCommentaire = escapeHtml(rdv.commentaireEmail || '');

  const contentHtml = `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Un rendez-vous de suivi et d'accompagnement personnalisé a été programmé avec votre référent.</p>
    
    <div class="card">
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600; width: 35%;">Objet :</td><td style="padding: 7px 0; font-weight: 800; color: #00254d;">${safeSujet}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Accompagnateur :</td><td style="padding: 7px 0; font-weight: 700; color: #0c87eb;">${safeAccomp}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Date de début :</td><td style="padding: 7px 0; font-weight: 800; color: #0c87eb;">${safeDate} à ${safeHeure}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Durée prévue :</td><td style="padding: 7px 0; font-weight: 700; color: #00254d;">${safeDuree}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Lieu / Visio :</td><td style="padding: 7px 0; font-weight: 700; color: #00254d;">${safeLieu}</td></tr>
      </table>
    </div>

    ${safeCommentaire ? `
      <div class="card" style="border-left: 4px solid #0c87eb; background: #f0f7ff; border-top: 1px solid #e0effe; border-right: 1px solid #e0effe; border-bottom: 1px solid #e0effe; margin: 16px 0;">
        <strong style="color: #0054a3; font-size: 12px; display: block; margin-bottom: 4px;">Note de l'accompagnateur :</strong>
        <p style="margin: 0; color: #334155; font-size: 13px;">${safeCommentaire}</p>
      </div>
    ` : ''}

    <p style="font-size: 12px; color: #64748b; margin-top: 16px;">Merci de vous munir de votre plan d'action et de l'état d'avancement de vos livrables.</p>
  `;

  const html = renderEmailTemplate({
    title: `Point de Suivi : ${safeSujet}`,
    preheader: `RDV programmé le ${safeDate} à ${safeHeure}`,
    badgeText: 'Rendez-vous de Suivi',
    badgeColor: '#0c87eb',
    contentHtml,
    ctaText: "Voir mes rendez-vous",
    ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomIncube}, votre rendez-vous "${sujet}" avec ${accompagnateur} est fixé le ${dateStr} à ${heureStr} (Durée : ${duree}) à ${lieu}.`
  });
};

/**
 * 3. Invitation & Convocation à une Formation / Atelier obligatoire
 */
const sendFormationInvitationEmail = async (evenement, incube) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || 'Porteur de Projet';
  const titre = evenement.titre || 'Atelier & Formation IDS';
  const formateur = evenement.formateur || 'Intervenant Expert';
  const dateStr = evenement.date || 'Prochainement';
  const heureDebutStr = evenement.heureDebut || '09:30';
  const heureFinStr = evenement.heureFin || '12:30';
  const duree = evenement.duree || '3h00';
  const description = evenement.description || '';
  const emargementUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/presence/${evenement.id}?nom_atelier=${encodeURIComponent(titre)}&date=${encodeURIComponent(dateStr)}&heureDebut=${encodeURIComponent(heureDebutStr)}&heureFin=${encodeURIComponent(heureFinStr)}&duree=${encodeURIComponent(duree)}`;

  const subject = `🎓 Convocation Atelier : ${titre}`;

  const safeNom = escapeHtml(nomIncube);
  const safeTitre = escapeHtml(titre);
  const safeFormateur = escapeHtml(formateur);
  const safeDate = escapeHtml(dateStr);
  const safeHeureDebut = escapeHtml(heureDebutStr);
  const safeHeureFin = escapeHtml(heureFinStr);
  const safeDuree = escapeHtml(duree);
  const safeDesc = escapeHtml(description);

  const contentHtml = `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Vous êtes officiellement invité(e) et convoqué(e) à la session de formation suivante organisée au sein de l'incubateur :</p>
    
    <div class="card">
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600; width: 35%;">Atelier :</td><td style="padding: 7px 0; font-weight: 800; color: #00254d;">${safeTitre}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Intervenant :</td><td style="padding: 7px 0; font-weight: 700; color: #0c87eb;">${safeFormateur}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Date de début :</td><td style="padding: 7px 0; font-weight: 800; color: #0c87eb;">${safeDate} à ${safeHeureDebut}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Horaires & Durée :</td><td style="padding: 7px 0; font-weight: 700; color: #00254d;">${safeHeureDebut} - ${safeHeureFin} (${safeDuree})</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Émargement :</td><td style="padding: 7px 0; font-weight: 700; color: #00254d;">Feuille de présence numérique obligatoire</td></tr>
      </table>
    </div>

    ${description ? `
      <div class="card" style="border-left: 4px solid #0c87eb; background: #f0f7ff; border-top: 1px solid #e0effe; border-right: 1px solid #e0effe; border-bottom: 1px solid #e0effe; margin: 16px 0;">
        <strong style="color: #0054a3; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Description de l'Atelier :</strong>
        <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.6; white-space: pre-line;">${safeDesc}</p>
      </div>
    ` : ''}

    <p style="font-size: 12px; color: #64748b; margin-top: 14px;">ℹ️ L'assiduité aux ateliers est requise dans le cadre du programme d'accompagnement de l'incubateur.</p>
  `;

  const html = renderEmailTemplate({
    title: `Convocation Atelier : ${safeTitre}`,
    preheader: `Atelier le ${safeDate} à ${safeHeureDebut} avec ${safeFormateur}`,
    badgeText: 'Session de Formation',
    badgeColor: '#0c87eb',
    contentHtml,
    ctaText: "Confirmer ma présence & Émargement",
    ctaUrl: emargementUrl
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomIncube}, vous êtes invité(e) à l'atelier "${titre}" animé par ${formateur} le ${dateStr} à ${heureDebutStr} (Horaires : ${heureDebutStr} - ${heureFinStr}, Durée : ${duree}). Lien : ${emargementUrl}`
  });
};

/**
 * 4. Alerte d'Assiduité / Heures de Présence Insuffisantes
 */
const sendAlerteAssiduiteEmail = async (incube, { tauxPresence = 0, moyenneHeures = 0, annee = 2026 } = {}) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || 'Porteur de Projet';
  const safeNom = escapeHtml(nomIncube);

  const subject = `⚠️ Alerte Suivi d'Engagement & Assiduité — Année ${annee}`;

  const contentHtml = `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>L'équipe pédagogique et administrative de l'Incubateur Digital Solidaire a procédé à l'analyse de votre assiduité et de votre engagement pour l'année <strong>${Number(annee)}</strong>.</p>
    
    <div class="card" style="border-left: 4px solid #f59e0b; background: #fffbeb; border-top: 1px solid #fef3c7; border-right: 1px solid #fef3c7; border-bottom: 1px solid #fef3c7;">
      <h3 style="margin: 0 0 10px 0; color: #b45309; font-size: 14px;">Indicateurs Actuels enregistrés :</h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #78350f;">
        <li style="margin-bottom: 6px;">Taux de présence aux formations : <strong>${Number(tauxPresence)}%</strong> (Objectif contractuel minimal : 80%)</li>
        <li>Présence hebdomadaire moyenne : <strong>${Number(moyenneHeures)}h / sem</strong> (Engagement attendu : 15h / sem)</li>
      </ul>
    </div>

    <p style="font-size: 13px; color: #334155;">
      Nous vous rappelons que l'assiduité aux ateliers et la présence active au sein du Fablab / Coworking sont indispensables pour bénéficier du soutien financier, technique et matériel de l'incubateur.
    </p>

    <p style="font-size: 13px; font-weight: 600; color: #00254d;">
      👉 Merci de contacter rapidement votre accompagnateur pour faire le point ou régulariser vos déclarations de présence.
    </p>
  `;

  const html = renderEmailTemplate({
    title: `Point d'Assiduité & Engagement`,
    preheader: `Rappel d'assiduité : taux actuel à ${tauxPresence}%`,
    badgeText: 'Alerte Assiduité',
    badgeColor: '#d97706',
    contentHtml,
    ctaText: "Consulter mon Suivi d'Engagement",
    ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/incubes/${incube.id}?tab=engagement`
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomIncube}, votre taux d'assiduité actuel (${tauxPresence}%) ou vos heures de présence (${moyenneHeures}h) nécessitent une régularisation auprès de l'administration.`
  });
};

/**
 * 5. Email de Bienvenue & Accès à la Plateforme (Création de compte incubé)
 */
const sendWelcomeEmail = async (incube, passwordInitial = null) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || 'Porteur de Projet';
  const projet = incube.raison_sociale || 'Votre Projet d\'Incubation';

  // Génération d'un mot de passe sécurisé et unique si aucun mot de passe explicite n'est fourni
  const resolvedPassword = passwordInitial || (crypto.randomBytes(4).toString('hex').toUpperCase() + '@Ids' + Math.floor(10 + Math.random() * 90));

  const safeNom = escapeHtml(nomIncube);
  const safeProjet = escapeHtml(projet);
  const safeRecipient = escapeHtml(recipient);
  const safePassword = escapeHtml(resolvedPassword);

  const subject = `🚀 Bienvenue au sein de l'Incubateur Digital Solidaire ! Vos Accès Plateforme`;

  const contentHtml = `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Toute l'équipe de l'<strong>Incubateur Digital Solidaire (IDS)</strong> est ravie de vous accueillir dans le programme d'accompagnement pour le projet <strong>${safeProjet}</strong>.</p>
    
    <p>Votre espace incubé personnel a été créé. Il vous permet de suivre vos formations, vos rendez-vous de mentoring, vos plans d'action et de réserver vos espaces de travail (coworking, fablab, studio vidéo).</p>

    <div class="card" style="border: 1px solid #b9ddfd; background: #f0f7ff;">
      <h3 style="margin: 0 0 10px 0; color: #0054a3; font-size: 14px;">Vos Identifiants de Connexion :</h3>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 5px 0; color: #64748b;">Identifiant / Email :</td><td style="padding: 5px 0; font-weight: 800; color: #00254d;">${safeRecipient}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Mot de passe temporaire :</td><td style="padding: 5px 0; font-family: monospace; font-weight: 800; color: #0c87eb; font-size: 14px;">${safePassword}</td></tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #64748b;">🔒 Pour des raisons de sécurité, nous vous recommandons de modifier ce mot de passe dès votre première connexion.</p>
  `;

  const html = renderEmailTemplate({
    title: `Bienvenue à l'Incubateur Digital Solidaire`,
    preheader: `Vos identifiants d'accès au portail incubateur`,
    badgeText: 'Nouveau Compte Incubé',
    badgeColor: '#0c87eb',
    contentHtml,
    ctaText: "Se connecter à mon espace",
    ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login${recipient ? `?email=${encodeURIComponent(recipient)}` : ''}`
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomIncube}, bienvenue à l'Incubateur Digital Solidaire ! Vos identifiants : Email: ${recipient} | Mot de passe: ${resolvedPassword}`
  });
};

/**
 * 6. Rappel Automatique d'Atelier (24h ou 2h avant la session)
 */
const sendWorkshopReminderEmail = async (evenement, incube) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || 'Porteur de Projet';
  const titre = evenement.titre || 'Atelier IDS';
  const formateur = evenement.formateur || 'Intervenant Expert';
  const dateStr = evenement.date || 'Aujourd\'hui';
  const heureDebutStr = evenement.heureDebut || '09:30';
  const heureFinStr = evenement.heureFin || '12:30';
  const duree = evenement.duree || '3h00';
  const emargementUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/presence/${evenement.id}?nom_atelier=${encodeURIComponent(titre)}&date=${encodeURIComponent(dateStr)}&heureDebut=${encodeURIComponent(heureDebutStr)}&heureFin=${encodeURIComponent(heureFinStr)}&duree=${encodeURIComponent(duree)}`;

  const subject = `🔔 RAPPEL : Votre atelier "${titre}" approche !`;

  const safeNom = escapeHtml(nomIncube);
  const safeTitre = escapeHtml(titre);
  const safeFormateur = escapeHtml(formateur);
  const safeDate = escapeHtml(dateStr);
  const safeHeureDebut = escapeHtml(heureDebutStr);
  const safeHeureFin = escapeHtml(heureFinStr);
  const safeDuree = escapeHtml(duree);

  const contentHtml = `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Ceci est un rappel amical concernant l'atelier de formation auquel vous êtes convié(e) :</p>
    
    <div class="card">
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600; width: 35%;">Formation :</td><td style="padding: 7px 0; font-weight: 800; color: #00254d;">${safeTitre}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Intervenant :</td><td style="padding: 7px 0; font-weight: 700; color: #0c87eb;">${safeFormateur}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Date de début :</td><td style="padding: 7px 0; font-weight: 800; color: #0c87eb;">${safeDate} à ${safeHeureDebut}</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Horaires & Durée :</td><td style="padding: 7px 0; font-weight: 700; color: #00254d;">${safeHeureDebut} - ${safeHeureFin} (${safeDuree})</td></tr>
        <tr><td style="padding: 7px 0; color: #64748b; font-weight: 600;">Lieu :</td><td style="padding: 7px 0; font-weight: 700; color: #00254d;">Incubateur IDS — Salle de formation</td></tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 14px;">
      💡 Pensez à vous munir de votre smartphone pour scanner le QR Code de présence à l'entrée de la salle ou utiliser le lien ci-dessous.
    </p>
  `;

  const html = renderEmailTemplate({
    title: `Rappel Atelier : ${safeTitre}`,
    preheader: `Votre session "${safeTitre}" commence à ${safeHeureDebut}`,
    badgeText: 'Rappel de Session',
    badgeColor: '#0c87eb',
    contentHtml,
    ctaText: "Voir le détail & Émarger",
    ctaUrl: emargementUrl
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomIncube}, rappel pour l'atelier "${titre}" animé par ${formateur} le ${dateStr} (${duree}). Lien d'émargement : ${emargementUrl}`
  });
};

/**
 * 7. Rappel Automatique de Réservation d'Espace (2h avant le créneau)
 */
const sendReservationReminderEmail = async (reservation) => {
  const recipient = reservation.emailIncube || reservation.email || 'incubé@ids.ma';
  const nomIncube = reservation.nomIncube || reservation.nomComplet || 'Incubé';
  const precisionSalle = reservation.salleSpecifique ? ` (${reservation.salleSpecifique})` : '';
  const espace = `${(reservation.espace || 'Espace').toUpperCase()}${precisionSalle}`;
  const dateStr = reservation.dateReservation ? new Date(reservation.dateReservation).toLocaleDateString('fr-FR') : 'Aujourd\'hui';
  const horaire = `${reservation.heureDebut || '—'} à ${reservation.heureFin || '—'}`;
  const materiel = reservation.equipementsUtilises || 'Général';

  const subject = `🔔 RAPPEL : Votre créneau ${espace} commence dans 2h !`;

  const safeNom = escapeHtml(nomIncube);
  const safeEspace = escapeHtml(espace);
  const safeDate = escapeHtml(dateStr);
  const safeHoraire = escapeHtml(horaire);
  const safeMateriel = escapeHtml(materiel);

  const contentHtml = `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Votre créneau de réservation d'espace au sein du Fablab / Incubateur commence dans <strong>2 heures</strong> :</p>
    
    <div class="card" style="border-left: 4px solid #059669; background: #f0fdf4; border-top: 1px solid #dcfce7; border-right: 1px solid #dcfce7; border-bottom: 1px solid #dcfce7;">
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Espace réservé :</td><td style="padding: 6px 0; font-weight: 800; color: #00254d;">${safeEspace}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date :</td><td style="padding: 6px 0; font-weight: 700; color: #0c87eb;">${safeDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Créneau horaire :</td><td style="padding: 6px 0; font-weight: 700; color: #00254d;">${safeHoraire}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Matériel alloué :</td><td style="padding: 6px 0; font-weight: 700; color: #b45309;">${safeMateriel}</td></tr>
      </table>
    </div>

    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px; margin: 16px 0; font-size: 12px; color: #92400e;">
      <strong>⚠️ Consignes de sécurité et restitution :</strong>
      <ul style="margin: 6px 0 0 0; padding-left: 18px; line-height: 1.5;">
        <li>Vérifiez l'état de la machine avant utilisation avec le responsable.</li>
        <li>Nettoyez et remettez en ordre votre poste de travail avant de quitter les lieux.</li>
        <li>Signalez tout incident ou anomalie immédiatement sur la plateforme.</li>
      </ul>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Rappel de Réservation : ${safeEspace}`,
    preheader: `Votre créneau débute à ${reservation.heureDebut}`,
    badgeText: 'Rappel de Créneau',
    badgeColor: '#059669',
    contentHtml,
    ctaText: "Voir mes Réservations",
    ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking`
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomIncube}, rappel : votre réservation pour ${espace} (${materiel}) a lieu aujourd'hui de ${horaire}.`
  });
};

/**
 * 8. Email de Réinitialisation de Mot de Passe (Lien sécurisé)
 */
const sendForgotPasswordEmail = async (user, resetUrl) => {
  const recipient = user.email;
  const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur';

  const safeNom = escapeHtml(nomComplet);
  const subject = `🔐 Réinitialisation de votre mot de passe - Plateforme IDS`;

  const contentHtml = `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Une demande de réinitialisation de mot de passe a été initiée pour votre compte sur la plateforme de l'<strong>Incubateur Digital Solidaire</strong>.</p>
    
    <p>Pour définir un nouveau mot de passe sécurisé, veuillez cliquer sur le bouton ci-dessous :</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin: 16px 0; font-size: 13px; color: #475569;">
      ⏱️ <strong>Ce lien est sécurisé, à usage unique et expire dans 30 minutes.</strong><br/>
      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel restera inchangé.
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Réinitialisation de Mot de Passe`,
    preheader: `Lien sécurisé valable 30 minutes`,
    badgeText: 'Sécurité du Compte',
    badgeColor: '#0c87eb',
    contentHtml,
    ctaText: "Réinitialiser mon mot de passe",
    ctaUrl: resetUrl
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomComplet}, pour réinitialiser votre mot de passe IDS, cliquez sur ce lien (valable 30 minutes) : ${resetUrl}`
  });
};

/**
 * 9. Email de Confirmation de Réinitialisation par le Super Admin
 */
const sendPasswordResetByAdminEmail = async (user, newPassword) => {
  const recipient = user.email;
  const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur';

  const safeNom = escapeHtml(nomComplet);
  const safeEmail = escapeHtml(recipient);
  const safePassword = escapeHtml(newPassword);
  const subject = `🔑 Vos nouveaux identifiants de connexion - Plateforme IDS`;

  const contentHtml = `
    <p>Bonjour <strong>${safeNom}</strong>,</p>
    <p>Votre mot de passe d'accès à la plateforme de l'<strong>Incubateur Digital Solidaire</strong> a été réinitialisé par l'administration.</p>
    
    <div class="card" style="border: 1px solid #b9ddfd; background: #f0f7ff;">
      <h3 style="margin: 0 0 10px 0; color: #0054a3; font-size: 14px;">Vos Nouveaux Identifiants :</h3>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 5px 0; color: #64748b;">Identifiant / Email :</td><td style="padding: 5px 0; font-weight: 800; color: #00254d;">${safeEmail}</td></tr>
        <tr><td style="padding: 5px 0; color: #64748b;">Nouveau mot de passe :</td><td style="padding: 5px 0; font-family: monospace; font-weight: 800; color: #0c87eb; font-size: 15px;">${safePassword}</td></tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #64748b;">🔒 Pour votre sécurité, nous vous recommandons de personnaliser ce mot de passe dès votre prochaine connexion dans votre profil utilisateur.</p>
  `;

  const html = renderEmailTemplate({
    title: `Nouveaux Identifiants de Connexion`,
    preheader: `Votre mot de passe a été mis à jour`,
    badgeText: 'Administration IDS',
    badgeColor: '#10b981',
    contentHtml,
    ctaText: "Se connecter à la plateforme",
    ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login${recipient ? `?email=${encodeURIComponent(recipient)}` : ''}`
  });

  return await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Bonjour ${nomComplet}, votre mot de passe IDS a été réinitialisé. Identifiant : ${recipient} | Mot de passe : ${newPassword}`
  });
};

module.exports = {
  sendEmail,
  sendReservationStatusEmail,
  sendRdvConfirmationEmail,
  sendFormationInvitationEmail,
  sendAlerteAssiduiteEmail,
  sendWelcomeEmail,
  sendWorkshopReminderEmail,
  sendReservationReminderEmail,
  sendForgotPasswordEmail,
  sendPasswordResetByAdminEmail
};
