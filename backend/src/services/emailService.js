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
 * Formatage d'une date en français (ex: 2026-11-20 -> "20 novembre 2026")
 */
const formatDateFrench = (dateInput) => {
  if (!dateInput) return 'prochainement';
  try {
    if (typeof dateInput === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput.trim())) {
      const [d, m, y] = dateInput.trim().split('/');
      const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const mIdx = parseInt(m, 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${parseInt(d, 10)} ${mois[mIdx]} ${y}`;
      }
      return dateInput;
    }

    const isoDateOnly = String(dateInput).split('T')[0].split(' ')[0].trim();
    const parts = isoDateOnly.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const mois = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
      ];
      if (monthIdx >= 0 && monthIdx < 12 && day > 0 && !isNaN(year)) {
        return `${day} ${mois[monthIdx]} ${year}`;
      }
    }

    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  } catch (e) {}
  return String(dateInput);
};

/**
 * Formatage d'une date ou d'un intervalle de dates en français
 * - Si 1 seul jour : phrase = "le 25 novembre 2026", display = "25 novembre 2026"
 * - Si plusieurs jours : phrase = "du 25 au 27 novembre 2026", display = "Du 25 au 27 novembre 2026"
 */
const formatDateIntervalFrench = (dateStart, dateEnd) => {
  if (!dateStart) return { textPhrase: 'prochainement', display: 'Prochainement' };

  const startFormatted = formatDateFrench(dateStart);
  if (!dateEnd || dateEnd === dateStart) {
    return {
      textPhrase: `le ${startFormatted}`,
      display: startFormatted
    };
  }

  const sIso = String(dateStart).split('T')[0].split(' ')[0].trim();
  const eIso = String(dateEnd).split('T')[0].split(' ')[0].trim();
  const sParts = sIso.split('-');
  const eParts = eIso.split('-');

  if (sParts.length === 3 && eParts.length === 3) {
    const sYear = parseInt(sParts[0], 10);
    const sMonth = parseInt(sParts[1], 10) - 1;
    const sDay = parseInt(sParts[2], 10);

    const eYear = parseInt(eParts[0], 10);
    const eMonth = parseInt(eParts[1], 10) - 1;
    const eDay = parseInt(eParts[2], 10);

    const mois = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    if (sYear === eYear && sMonth === eMonth) {
      return {
        textPhrase: `du ${sDay} au ${eDay} ${mois[sMonth]} ${sYear}`,
        display: `Du ${sDay} au ${eDay} ${mois[sMonth]} ${sYear}`
      };
    } else if (sYear === eYear) {
      return {
        textPhrase: `du ${sDay} ${mois[sMonth]} au ${eDay} ${mois[eMonth]} ${sYear}`,
        display: `Du ${sDay} ${mois[sMonth]} au ${eDay} ${mois[eMonth]} ${sYear}`
      };
    } else {
      return {
        textPhrase: `du ${sDay} ${mois[sMonth]} ${sYear} au ${eDay} ${mois[eMonth]} ${eYear}`,
        display: `Du ${sDay} ${mois[sMonth]} ${sYear} au ${eDay} ${mois[eMonth]} ${eYear}`
      };
    }
  }

  const endFormatted = formatDateFrench(dateEnd);
  return {
    textPhrase: `du ${startFormatted} au ${endFormatted}`,
    display: `Du ${startFormatted} au ${endFormatted}`
  };
};

/**
 * Détection dynamique du type de parcours : "post-création" ou "pré-création"
 */
const detectFormationType = (evenement = {}, incube = {}) => {
  let rawText = '';
  if (evenement.description) {
    if (typeof evenement.description === 'object') {
      if (evenement.description.typeParcours === 'pre-creation') return 'pré-création';
      if (evenement.description.typeParcours === 'post-creation') return 'post-création';
    } else if (typeof evenement.description === 'string') {
      try {
        const parsed = JSON.parse(evenement.description);
        if (parsed.typeParcours === 'pre-creation') return 'pré-création';
        if (parsed.typeParcours === 'post-creation') return 'post-création';
      } catch (e) {
        rawText += ' ' + evenement.description;
      }
    }
  }

  if (evenement.typeParcours === 'pre-creation' || evenement.parcours === 'pre-creation') return 'pré-création';
  if (evenement.typeParcours === 'post-creation' || evenement.parcours === 'post-creation') return 'post-création';

  rawText += ' ' + (evenement.titre || '');

  const lower = rawText.toLowerCase();
  if (lower.includes('post-création') || lower.includes('post-creation') || lower.includes('post creation') || lower.includes('post_creation')) {
    return 'post-création';
  }
  if (lower.includes('pré-création') || lower.includes('pre-creation') || lower.includes('pre creation') || lower.includes('pre_creation')) {
    return 'pré-création';
  }

  if (incube && (incube.phase_projet || incube.phase)) {
    const ph = String(incube.phase_projet || incube.phase).toLowerCase();
    if (ph.includes('idéation') || ph.includes('ideation')) return 'pré-création';
    if (ph.includes('lancement') || ph.includes('croissance')) return 'post-création';
  }

  return 'post-création';
};

/**
 * Extraction dynamique et propre du thème de la session de formation
 */
const detectFormationTheme = (evenement = {}) => {
  if (evenement.description) {
    if (typeof evenement.description === 'object' && evenement.description.moduleName) {
      return String(evenement.description.moduleName).trim();
    }
    if (typeof evenement.description === 'string') {
      try {
        const parsed = JSON.parse(evenement.description);
        if (parsed.moduleName) return String(parsed.moduleName).trim();
        if (parsed.theme) return String(parsed.theme).trim();
      } catch (e) {}
    }
  }

  const rawTitre = (evenement.titre || '').trim();
  if (!rawTitre) return 'Gestion des Ressources Humaines';

  let clean = rawTitre.replace(/^\[[^\]]+\]\s*/g, '').trim();

  const codeRegex = /^[A-Za-z0-9_\-\.\/]+\s*[:–—\-]\s*(.+)$/i;
  const match = clean.match(codeRegex);
  if (match && match[1]) {
    clean = match[1].trim();
  }

  return clean || rawTitre || 'Gestion des Ressources Humaines';
};

/**
 * Détection automatique pour différencier une Formation académique d'un Atelier pratique / Événement
 */
const detectIsFormation = (evenement = {}) => {
  if (evenement.isFormation === true || evenement.type === 'formation') return true;
  if (evenement.isFormation === false || evenement.type === 'atelier' || evenement.type === 'evenement') return false;

  if (evenement.description) {
    if (typeof evenement.description === 'object' && evenement.description !== null) {
      if (evenement.description.moduleCode || evenement.description.typeParcours) return true;
    } else if (typeof evenement.description === 'string') {
      try {
        const parsed = JSON.parse(evenement.description);
        if (parsed.moduleCode || parsed.typeParcours) return true;
      } catch (e) {}
    }
  }

  if (evenement.typeParcours === 'pre-creation' || evenement.typeParcours === 'post-creation') return true;
  if (evenement.parcours === 'pre-creation' || evenement.parcours === 'post-creation') return true;

  const rawTitre = (evenement.titre || '').trim().toLowerCase();
  if (
    rawTitre.includes('[pré-création]') ||
    rawTitre.includes('[pre-creation]') ||
    rawTitre.includes('[post-création]') ||
    rawTitre.includes('[post-creation]') ||
    rawTitre.startsWith('[pre-') ||
    rawTitre.startsWith('[post-')
  ) {
    return true;
  }

  return false;
};

/**
 * Gabarit HTML moderne, épuré et responsive harmonisé avec le style officiel de l'Incubateur Digital Solidaire
 * Conforme au modèle visuel validé (fond blanc épuré, centrage, badge pill, boîte récapitulative claire, signature officielle)
 */
const renderEmailTemplate = ({ title, preheader, badgeText, badgeColor = '#0284c7', contentHtml, ctaText, ctaUrl }) => {
  const actionButton = ctaText && ctaUrl ? `
    <div style="text-align: center; margin: 28px 0 14px 0;">
      <a href="${ctaUrl}" style="background: linear-gradient(135deg, #0c87eb 0%, #006ac9 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(12, 135, 235, 0.28); letter-spacing: 0.2px;">
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
  <title>${escapeHtml(title || 'Incubateur Digital Solidaire')}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; }
    .container { max-width: 580px; margin: 30px auto; background: #ffffff; border-radius: 16px; padding: 36px 32px 28px 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05); }
    .title { margin: 0 0 12px 0; color: #0f172a; font-size: 26px; font-weight: 800; text-align: center; letter-spacing: -0.3px; }
    .badge-wrap { text-align: center; margin: 0 0 26px 0; }
    .badge-pill { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 6px 18px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    .body { font-size: 14px; line-height: 1.6; color: #1e293b; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0; }
    .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">Incubateur Digital Solidaire</h1>
    ${badgeText ? `<div class="badge-wrap"><span class="badge-pill">${escapeHtml(badgeText)}</span></div>` : ''}

    <div class="body">
      ${contentHtml}
      ${actionButton}
    </div>

    <div class="footer">
      <p style="margin: 0;">Plateforme Officielle • Incubateur Digital Solidaire Salé</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Helper de mise en forme des paragraphes pour un message personnalisé
 */
const formatCustomMessageHtml = (text) => {
  if (!text || !text.trim()) return '';
  const paragraphs = text.trim().split(/\n\s*\n/);
  return paragraphs
    .map(p => `<p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
};

/**
 * Fonction générique d'envoi d'email avec support du champ Copie (CC)
 */
const sendEmail = async ({ to, cc, subject, text, html }) => {
  const transporter = getTransporter();
  const rawFromName = process.env.MAIL_FROM_NAME || 'Incubateur Digital Solidaire';
  const cleanFromName = rawFromName.replace(/^["']|["']$/g, '').trim() || 'Incubateur Digital Solidaire';
  const from = process.env.MAIL_FROM_ADDRESS
    ? `"${cleanFromName}" <${process.env.MAIL_FROM_ADDRESS}>`
    : `"${cleanFromName}" <incubateur.ids.contact@gmail.com>`;

  const recipient = to || process.env.ADMIN_NOTIFY_EMAIL || 'contact@ids-incubateur.ma';

  const mailOptions = {
    from,
    to: recipient,
    subject,
    text: text || '',
    html
  };

  if (cc && typeof cc === 'string' && cc.trim()) {
    mailOptions.cc = cc.trim();
  } else if (Array.isArray(cc) && cc.length > 0) {
    const validCc = cc.filter(c => c && String(c).trim()).map(c => String(c).trim());
    if (validCc.length > 0) {
      mailOptions.cc = validCc.join(', ');
    }
  }

  if (!transporter) {
    console.log(`\n======================================================`);
    console.log(`📧 [SIMULATION EMAIL IDS] (SMTP non configuré dans .env)`);
    console.log(`➡️ Destinataire : ${recipient}`);
    if (mailOptions.cc) console.log(`📋 Copie (CC)   : ${mailOptions.cc}`);
    console.log(`📌 Sujet        : ${subject}`);
    console.log(`💬 Message brut : ${text || 'Contenu HTML généré'}`);
    console.log(`======================================================\n`);
    return { success: true, simulated: true, recipient, subject, cc: mailOptions.cc };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL ENVOYÉ RÉELLEMENT] ID: ${info.messageId} vers ${recipient}${mailOptions.cc ? ` (CC: ${mailOptions.cc})` : ''}`);
    return { success: true, simulated: false, messageId: info.messageId, recipient, subject, cc: mailOptions.cc };
  } catch (error) {
    console.error(`❌ [ERREUR SMTP ENVOI EMAIL] vers ${recipient}:`, error.message);
    return { success: false, error: error.message, recipient, subject };
  }
};

/**
 * 1. Notification de statut de Réservation d'Espace
 */
const sendReservationStatusEmail = async (reservation, statut, motifRefus = '', options = {}) => {
  const isValide = statut === 'valide';
  const recipient = reservation.emailIncube || reservation.email || 'incubé@ids.ma';
  const nomIncube = reservation.nomIncube || reservation.nomComplet || 'Incubé';
  const precisionSalle = reservation.salleSpecifique ? ` (${reservation.salleSpecifique})` : '';
  const espace = `${(reservation.espace || 'Espace').toUpperCase()}${precisionSalle}`;
  const dateStr = formatDateFrench(reservation.dateReservation) || 'Date non précisée';
  const horaire = `${reservation.heureDebut || '—'} - ${reservation.heureFin || '—'}`;

  const subject = (options.customSubject && options.customSubject.trim())
    ? options.customSubject.trim()
    : (isValide ? `✅ Confirmation de réservation : ${espace}` : `❌ Information réservation : ${espace}`);

  const badgeText = isValide ? 'RÉSERVATION VALIDÉE' : 'RÉSERVATION NON RETENUE';

  const safeNom = escapeHtml(nomIncube);
  const safeEspace = escapeHtml(espace);
  const safeDate = escapeHtml(dateStr);
  const safeHoraire = escapeHtml(horaire);
  const safeMotif = escapeHtml(motifRefus || 'Créneau indisponible ou maintenance planifiée');

  const defaultIntroHtml = isValide ? `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Nous avons le plaisir de vous informer que votre demande de réservation d'espace au sein de l'incubateur a été <strong>validée</strong>.
    </p>
  ` : `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Nous vous informons que votre demande de réservation d'espace n'a pas pu être retenue pour le motif suivant :
    </p>
    <div style="background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #991b1b;">
      « ${safeMotif} »
    </div>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 34%;">Espace réservé :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeEspace}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Date :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Créneau horaire :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeHoraire}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Statut :</td><td style="padding: 6px 0; font-weight: 600; color: ${isValide ? '#059669' : '#dc2626'};">${isValide ? 'Confirmée' : 'Non retenue'}</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      ${isValide
        ? "Merci de veiller au respect des horaires, du matériel et de l'état des lieux de l'espace."
        : "Nous vous invitons à vous reconnecter sur la plateforme pour choisir un autre créneau disponible."
      }
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">L'équipe IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: isValide ? 'Réservation Validée' : 'Réservation Non Retenue',
    preheader: `${safeEspace} - ${safeDate}`,
    badgeText,
    badgeColor: '#0284c7',
    contentHtml
  });

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: `Bonjour ${nomIncube}, votre réservation pour ${espace} le ${dateStr} (${horaire}) est ${isValide ? 'VALIDÉE' : 'REFUSÉE'}.${motifRefus ? ` Motif : ${motifRefus}` : ''}`
  });
};

/**
 * 2. Notification de Confirmation de Rendez-vous d'accompagnement / Mentoring
 */
const sendRdvConfirmationEmail = async (rdv, incube = {}, options = {}) => {
  const recipient = incube.email || rdv.emailIncube || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || rdv.incubeNoms || 'Porteur de Projet';
  const accompagnateur = rdv.accompagnateurNom || 'Accompagnateur IDS';
  const sujet = rdv.sujet || 'Point d’étape & Diagnostic';
  const rawDate = rdv.dateRdv || 'Date à définir';
  const dateStr = formatDateFrench(rawDate);
  const heureStr = rdv.heureRdv || '09:30';
  const duree = rdv.duree || '1h00';
  let rawLieu = rdv.lieu || 'IDS Salé — Bureaux d’accompagnement';
  if (!rawLieu.toLowerCase().includes('ids') && !rawLieu.toLowerCase().includes('visio') && !rawLieu.toLowerCase().includes('distance')) {
    rawLieu = `IDS Salé — ${rawLieu}`;
  }
  rawLieu = rawLieu.replace(/\s*\/\s*fablab/gi, '').replace(/fablab/gi, 'Bureaux d’accompagnement');

  const subject = (options.customSubject && options.customSubject.trim())
    ? options.customSubject.trim()
    : `📅 Rendez-vous d'accompagnement : ${sujet}`;

  const safeNom = escapeHtml(nomIncube);
  const safeSujet = escapeHtml(sujet);
  const safeAccomp = escapeHtml(accompagnateur);
  const safeDate = escapeHtml(dateStr);
  const safeHeure = escapeHtml(heureStr);
  const safeDuree = escapeHtml(duree);
  const safeLieu = escapeHtml(rawLieu);
  const safeCommentaire = escapeHtml(rdv.commentaireEmail || '');

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Nous vous confirmons la programmation de votre rendez-vous individuel d'accompagnement, qui se déroulera le <strong>${safeDate}</strong>.
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Cette séance d'échange constitue une étape clé pour faire le point sur vos priorités, vos livrables et la progression concrète de votre projet au sein de IDS Salé.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 32%;">Objet :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeSujet}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Accompagnateur :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeAccomp}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Date :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Horaires :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeHeure} (${safeDuree})</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Lieu :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeLieu}</td></tr>
      </table>
    </div>

    ${safeCommentaire ? `
      <div style="background: #f1f5f9; border-left: 3px solid #0284c7; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #334155;">
        <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Note de l'accompagnateur :</strong>
        <span>« ${safeCommentaire} »</span>
      </div>
    ` : ''}

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      Nous comptons sur votre ponctualité et votre implication.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">L'équipe IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Point de Suivi : ${safeSujet}`,
    preheader: `RDV programmé le ${safeDate} à ${safeHeure}`,
    badgeText: 'RENDEZ-VOUS D\'ACCOMPAGNEMENT',
    badgeColor: '#0284c7',
    contentHtml
  });

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: options.customMessage ? `${options.customMessage}\n\nDate: ${dateStr} à ${heureStr}\nLieu: ${rawLieu}` : `Bonjour ${nomIncube}, votre rendez-vous "${sujet}" avec ${accompagnateur} est fixé le ${dateStr} à ${heureStr} (${duree}) à ${rawLieu}.`
  });
};

/**
 * 3. Invitation & Convocation à une Session de Formation (Pré-création & Post-création)
 */
const sendFormationInvitationEmail = async (evenement, incube = {}, options = {}) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const typeFormation = detectFormationType(evenement, incube);
  const theme = detectFormationTheme(evenement);

  let dateFin = evenement.dateFin || evenement.date_fin || null;
  if (!dateFin && evenement.description) {
    try {
      const parsed = typeof evenement.description === 'object' ? evenement.description : JSON.parse(evenement.description);
      dateFin = parsed.dateFin || parsed.date_fin || null;
    } catch (e) {}
  }

  const { textPhrase: datePhrase, display: dateDisplay } = formatDateIntervalFrench(evenement.date, dateFin);
  const rawIntervenant = evenement.intervenant || evenement.formateur || 'Intervenant IDS Salé';
  const heureDebutStr = evenement.heureDebut || '09:30';
  const heureFinStr = evenement.heureFin || '12:30';
  const duree = evenement.duree || '3h00';

  const rawLieu = evenement.lieu || evenement.salle;
  let lieuDisplay = 'IDS Salé — Salle de formation';
  if (rawLieu && String(rawLieu).trim()) {
    const trimmed = String(rawLieu).trim();
    lieuDisplay = trimmed.startsWith('IDS') ? trimmed : `IDS Salé — ${trimmed}`;
  }

  const badgeText = typeFormation === 'pré-création'
    ? 'FORMATION PRÉ-CRÉATION'
    : (typeFormation === 'post-création' ? 'FORMATION POST-CRÉATION' : 'FORMATION PROFESSIONNELLE');

  const parcoursDisplay = typeFormation === 'pré-création'
    ? 'Session De Formation Pré-Création'
    : (typeFormation === 'post-création' ? 'Session De Formation Post-Création' : 'Session De Formation IDS');

  const subject = options.customSubject || `🎓 Convocation : Session de formation ${typeFormation} — ${theme}`;

  const safeType = escapeHtml(typeFormation);
  const safeTheme = escapeHtml(theme);
  const safeParcours = escapeHtml(parcoursDisplay);
  const safeDateDisplay = escapeHtml(dateDisplay);
  const safeIntervenant = escapeHtml(rawIntervenant);
  const safeHeureDebut = escapeHtml(heureDebutStr);
  const safeHeureFin = escapeHtml(heureFinStr);
  const safeDuree = escapeHtml(duree);
  const safeLieu = escapeHtml(lieuDisplay);

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">Bonjour à toutes et à tous,</p>

    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Nous avons le plaisir de vous convier à la session de formation <strong>${safeType}</strong>, qui se déroulera ${escapeHtml(datePhrase)}.
    </p>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Cette session, animée par des experts partenaires, constitue une étape clé de votre parcours d'accompagnement. Votre participation est donc indispensable pour valider votre accompagnement au sein de IDS Salé.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 32%;">Thème :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeTheme}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Parcours :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeParcours}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Date :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeDateDisplay}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Horaires :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeHeureDebut} - ${safeHeureFin} (${safeDuree})</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Intervenant :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeIntervenant}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Lieu :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeLieu}</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      Nous comptons sur votre motivation et votre implication.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">L'équipe IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Session de Formation ${safeType} : ${safeTheme}`,
    badgeText,
    badgeColor: '#0284c7',
    contentHtml
  });

  const defaultText = `Bonjour à toutes et à tous,

Nous avons le plaisir de vous convier à la session de formation ${typeFormation}, qui se déroulera ${datePhrase}.

Détails de la session :
- Thème : ${theme}
- Parcours : ${parcoursDisplay}
- Date : ${dateDisplay}
- Horaires : ${heureDebutStr} - ${heureFinStr} (${duree})
- Intervenant : ${rawIntervenant}
- Lieu : ${lieuDisplay}

Nous comptons sur votre motivation et votre implication.

Bien cordialement,
L'équipe IDS Salé`;

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: options.customMessage ? `${options.customMessage}\n\n${defaultText}` : defaultText
  });
};

/**
 * 3.bis Invitation & Convocation à un Atelier Pratique / Événement Collaboratif
 */
const sendAtelierInvitationEmail = async (evenement, incube = {}, options = {}) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || incube.nom || 'Porteur de Projet';
  const titreAtelier = (evenement.titre || 'Atelier Pratique IDS').trim();

  let dateFin = evenement.dateFin || evenement.date_fin || null;
  if (!dateFin && evenement.description) {
    try {
      const parsed = typeof evenement.description === 'object' ? evenement.description : JSON.parse(evenement.description);
      dateFin = parsed.dateFin || parsed.date_fin || null;
    } catch (e) {}
  }

  const { textPhrase: datePhrase, display: dateDisplay } = formatDateIntervalFrench(evenement.date, dateFin);
  const rawAnimateur = evenement.intervenant || evenement.formateur || 'Équipe d’Animation IDS';
  const heureDebutStr = evenement.heureDebut || '09:30';
  const heureFinStr = evenement.heureFin || '12:30';
  const duree = evenement.duree || '3h00';

  const rawLieu = evenement.lieu || evenement.salle;
  let lieuDisplay = "IDS Salé — Salle d'Atelier";
  if (rawLieu && String(rawLieu).trim()) {
    const trimmed = String(rawLieu).trim();
    const cleanLieu = trimmed.replace(/fablab\s*(&\s*)?/gi, '').replace(/\s{2,}/g, ' ').trim();
    lieuDisplay = cleanLieu.startsWith('IDS') ? cleanLieu : `IDS Salé — ${cleanLieu || "Salle d'Atelier"}`;
  }

  let descriptionText = '';
  if (typeof evenement.description === 'string') {
    try {
      const parsed = JSON.parse(evenement.description);
      descriptionText = parsed.description || parsed.notes || parsed.details || '';
    } catch (e) {
      descriptionText = evenement.description;
    }
  } else if (typeof evenement.description === 'object' && evenement.description !== null) {
    descriptionText = evenement.description.description || evenement.description.notes || '';
  }

  const subject = options.customSubject || `🛠️ Invitation : Atelier pratique — ${titreAtelier}`;

  const safeNom = escapeHtml(nomIncube);
  const safeTitre = escapeHtml(titreAtelier);
  const safeDateDisplay = escapeHtml(dateDisplay);
  const safeAnimateur = escapeHtml(rawAnimateur);
  const safeHeureDebut = escapeHtml(heureDebutStr);
  const safeHeureFin = escapeHtml(heureFinStr);
  const safeDuree = escapeHtml(duree);
  const safeLieu = escapeHtml(lieuDisplay);
  const safeDescription = escapeHtml(descriptionText);

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>

    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Nous avons le plaisir de vous inviter à prendre part au prochain atelier pratique : <strong>${safeTitre}</strong>, qui se déroulera ${escapeHtml(datePhrase)}.
    </p>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Cet atelier est conçu pour favoriser l'expérimentation, les échanges directs entre pairs et la progression concrète de vos réalisations.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 32%;">Thème :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeTitre}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Parcours :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">Atelier Pratique & Collaboratif</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Date :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeDateDisplay}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Horaires :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeHeureDebut} - ${safeHeureFin} (${safeDuree})</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Intervenant :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeAnimateur}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Lieu :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeLieu}</td></tr>
      </table>
    </div>

    ${safeDescription ? `
      <div class="card" style="border-left: 4px solid #0ea5e9; background: #f0f9ff; border-top: 1px solid #e0f2fe; border-right: 1px solid #e0f2fe; border-bottom: 1px solid #e0f2fe; margin: 16px 0;">
        <strong style="color: #0369a1; font-size: 12px; display: block; margin-bottom: 4px;">À propos de cette session :</strong>
        <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.5;">${safeDescription}</p>
      </div>
    ` : ''}

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      Nous comptons sur votre motivation et votre implication.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">Équipe d’Animation — IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Atelier Pratique : ${safeTitre}`,
    badgeText: 'ATELIER PRATIQUE & ÉVÉNEMENT',
    badgeColor: '#0284c7',
    contentHtml
  });

  const defaultText = `Bonjour ${nomIncube},

Nous avons le plaisir de vous inviter au prochain atelier pratique : "${titreAtelier}", qui se déroulera ${datePhrase}.

Détails de l'atelier :
- Thème : ${titreAtelier}
- Parcours : Atelier Pratique & Collaboratif
- Date : ${dateDisplay}
- Horaires : ${heureDebutStr} - ${heureFinStr} (${duree})
- Intervenant : ${rawAnimateur}
- Lieu : ${lieuDisplay}

Nous comptons sur votre motivation et votre implication.

Bien cordialement,
Équipe d’Animation — IDS Salé`;

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: options.customMessage ? `${options.customMessage}\n\n${defaultText}` : defaultText
  });
};

/**
 * 4. Alerte d'Assiduité / Heures de Présence Insuffisantes
 */
const sendAlerteAssiduiteEmail = async (incube, { tauxPresence = 0, moyenneHeures = 0, annee = 2026 } = {}, options = {}) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || 'Porteur de Projet';
  const safeNom = escapeHtml(nomIncube);

  const subject = (options.customSubject && options.customSubject.trim())
    ? options.customSubject.trim()
    : `⚠️ Alerte Suivi d'Engagement & Assiduité — Année ${Number(annee)}`;

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Nous vous adressons ce point relatif à votre assiduité et à votre implication dans le cadre de votre parcours d'accompagnement pour l'année <strong>${Number(annee)}</strong>.
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      L'assiduité aux ateliers, aux formations et le respect de votre calendrier constituent une condition indispensable pour valider votre accompagnement au sein de IDS Salé.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 40%;">Taux de présence :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${Number(tauxPresence)}% (Objectif minimal : 80%)</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Présence hebdomadaire :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${Number(moyenneHeures)}h / sem (Attendu : 15h / sem)</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Période évaluée :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">Année ${Number(annee)}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Statut du suivi :</td><td style="padding: 6px 0; font-weight: 600; color: #b45309;">Régularisation requise</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Référent :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">Accompagnateur IDS Salé</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      Nous vous invitons à contacter rapidement votre accompagnateur référent pour faire le point sur votre calendrier ou régulariser vos présences.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">L'équipe Pédagogique — IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Point d'Assiduité & Engagement`,
    preheader: `Rappel d'assiduité : taux actuel à ${tauxPresence}%`,
    badgeText: 'SUIVI D\'ASSIDUITÉ & ENGAGEMENT',
    badgeColor: '#0284c7',
    contentHtml
  });

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: options.customMessage ? `${options.customMessage}\n\nTaux: ${tauxPresence}%` : `Bonjour ${nomIncube}, votre taux d'assiduité actuel (${tauxPresence}%) nécessite une régularisation auprès de votre accompagnateur IDS Salé.`
  });
};

/**
 * 5. Email de Bienvenue & Accès à la Plateforme (Création de compte incubé)
 */
const sendWelcomeEmail = async (incube, passwordInitial = null, options = {}) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || 'Porteur de Projet';
  const projet = incube.raison_sociale || 'Votre Projet d\'Incubation';

  // Génération d'un mot de passe sécurisé et unique si aucun mot de passe explicite n'est fourni
  const resolvedPassword = passwordInitial || (crypto.randomBytes(4).toString('hex').toUpperCase() + '@Ids' + Math.floor(10 + Math.random() * 90));

  const safeNom = escapeHtml(nomIncube);
  const safeProjet = escapeHtml(projet);
  const safeRecipient = escapeHtml(recipient);
  const safePassword = escapeHtml(resolvedPassword);

  const subject = (options.customSubject && options.customSubject.trim())
    ? options.customSubject.trim()
    : `🚀 Bienvenue au sein de l'Incubateur Digital Solidaire ! Vos Accès Plateforme`;

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Toute l'équipe de l'<strong>Incubateur Digital Solidaire (IDS)</strong> est ravie de vous accueillir dans le programme d'accompagnement pour le projet <strong>${safeProjet}</strong>.
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Votre espace incubé personnel a été créé. Il vous permet de suivre vos formations, vos ateliers pratiques, vos rendez-vous de mentoring et de gérer vos réservations d'espaces de travail.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 36%;">Projet accompagné :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeProjet}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Identifiant / Email :</td><td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeRecipient}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Mot de passe initial :</td><td style="padding: 6px 0; font-family: monospace; font-weight: 700; color: #0284c7;">${safePassword}</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      🔒 Pour des raisons de sécurité, nous vous recommandons de personnaliser ce mot de passe dès votre première connexion.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">L'équipe IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Bienvenue à l'Incubateur Digital Solidaire`,
    preheader: `Vos identifiants d'accès au portail incubateur`,
    badgeText: 'BIENVENUE SUR LA PLATEFORME IDS',
    badgeColor: '#0284c7',
    contentHtml
  });

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: `Bonjour ${nomIncube}, bienvenue à l'Incubateur Digital Solidaire ! Vos identifiants : Email: ${recipient} | Mot de passe: ${resolvedPassword}`
  });
};

/**
 * 6. Rappel Automatique d'Atelier / Formation (24h ou 2h avant la session)
 */
const sendWorkshopReminderEmail = async (evenement, incube = {}, options = {}) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const typeFormation = detectFormationType(evenement, incube);
  const theme = detectFormationTheme(evenement);

  let dateFin = evenement.dateFin || evenement.date_fin || null;
  if (!dateFin && evenement.description) {
    try {
      const parsed = typeof evenement.description === 'object' ? evenement.description : JSON.parse(evenement.description);
      dateFin = parsed.dateFin || parsed.date_fin || null;
    } catch (e) {}
  }

  const { textPhrase: datePhrase, display: dateDisplay } = formatDateIntervalFrench(evenement.date, dateFin);
  const rawIntervenant = evenement.intervenant || evenement.formateur || 'Intervenant IDS Salé';
  const heureDebutStr = evenement.heureDebut || '09:30';
  const heureFinStr = evenement.heureFin || '12:30';
  const duree = evenement.duree || '3h00';

  const rawLieu = evenement.lieu || evenement.salle;
  let lieuDisplay = 'IDS Salé — Salle de formation';
  if (rawLieu && String(rawLieu).trim()) {
    const trimmed = String(rawLieu).trim();
    lieuDisplay = trimmed.startsWith('IDS') ? trimmed : `IDS Salé — ${trimmed}`;
  }

  const badgeText = typeFormation === 'pré-création'
    ? 'RAPPEL • FORMATION PRÉ-CRÉATION'
    : (typeFormation === 'post-création' ? 'RAPPEL • FORMATION POST-CRÉATION' : 'RAPPEL • FORMATION IDS');

  const parcoursDisplay = typeFormation === 'pré-création'
    ? 'Session De Formation Pré-Création'
    : (typeFormation === 'post-création' ? 'Session De Formation Post-Création' : 'Session De Formation IDS');

  const subject = options.customSubject || `🔔 RAPPEL : Session de formation ${typeFormation} — ${theme}`;

  const safeType = escapeHtml(typeFormation);
  const safeTheme = escapeHtml(theme);
  const safeParcours = escapeHtml(parcoursDisplay);
  const safeDateDisplay = escapeHtml(dateDisplay);
  const safeIntervenant = escapeHtml(rawIntervenant);
  const safeHeureDebut = escapeHtml(heureDebutStr);
  const safeHeureFin = escapeHtml(heureFinStr);
  const safeDuree = escapeHtml(duree);
  const safeLieu = escapeHtml(lieuDisplay);

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">Bonjour à toutes et à tous,</p>

    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Ceci est un rappel concernant votre session de formation <strong>${safeType}</strong>, qui se déroulera ${escapeHtml(datePhrase)}.
    </p>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Votre participation est indispensable pour valider votre parcours au sein de l'Incubateur Digital Solidaire. Merci de bien vouloir arriver à l'heure indiquée.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 32%;">Thème :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeTheme}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Parcours :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeParcours}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Date :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeDateDisplay}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Horaires :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeHeureDebut} - ${safeHeureFin} (${safeDuree})</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Intervenant :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeIntervenant}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Lieu :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeLieu}</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      Nous comptons sur votre motivation et votre ponctualité.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">L'équipe IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Rappel : Formation ${safeType} — ${safeTheme}`,
    badgeText,
    badgeColor: '#0284c7',
    contentHtml
  });

  const defaultText = `Bonjour à toutes et à tous,

Ceci est un rappel concernant votre session de formation ${typeFormation}, prévue ${datePhrase}.

Détails de la session :
- Thème : ${theme}
- Parcours : ${parcoursDisplay}
- Date : ${dateDisplay}
- Horaires : ${heureDebutStr} - ${heureFinStr} (${duree})
- Intervenant : ${rawIntervenant}
- Lieu : ${lieuDisplay}

Nous comptons sur votre ponctualité.

Bien cordialement,
L'équipe IDS Salé`;

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: options.customMessage ? `${options.customMessage}\n\n${defaultText}` : defaultText
  });
};

/**
 * 6.bis Rappel Automatique pour un Atelier Pratique / Événement Collaboratif (24h avant la session)
 */
const sendAtelierReminderEmail = async (evenement, incube = {}, options = {}) => {
  const recipient = incube.email || 'incubé@ids.ma';
  const nomIncube = incube.nom_incube || incube.nom || 'Porteur de Projet';
  const titreAtelier = (evenement.titre || 'Atelier Pratique IDS').trim();

  let dateFin = evenement.dateFin || evenement.date_fin || null;
  if (!dateFin && evenement.description) {
    try {
      const parsed = typeof evenement.description === 'object' ? evenement.description : JSON.parse(evenement.description);
      dateFin = parsed.dateFin || parsed.date_fin || null;
    } catch (e) {}
  }

  const { textPhrase: datePhrase, display: dateDisplay } = formatDateIntervalFrench(evenement.date, dateFin);
  const rawAnimateur = evenement.intervenant || evenement.formateur || 'Équipe d’Animation IDS';
  const heureDebutStr = evenement.heureDebut || '09:30';
  const heureFinStr = evenement.heureFin || '12:30';
  const duree = evenement.duree || '3h00';

  const rawLieu = evenement.lieu || evenement.salle;
  let lieuDisplay = "IDS Salé — Salle d'Atelier";
  if (rawLieu && String(rawLieu).trim()) {
    const trimmed = String(rawLieu).trim();
    const cleanLieu = trimmed.replace(/fablab\s*(&\s*)?/gi, '').replace(/\s{2,}/g, ' ').trim();
    lieuDisplay = cleanLieu.startsWith('IDS') ? cleanLieu : `IDS Salé — ${cleanLieu || "Salle d'Atelier"}`;
  }

  const subject = options.customSubject || `🔔 RAPPEL : Votre atelier pratique « ${titreAtelier} » a lieu prochainement !`;

  const safeNom = escapeHtml(nomIncube);
  const safeTitre = escapeHtml(titreAtelier);
  const safeDateDisplay = escapeHtml(dateDisplay);
  const safeAnimateur = escapeHtml(rawAnimateur);
  const safeHeureDebut = escapeHtml(heureDebutStr);
  const safeHeureFin = escapeHtml(heureFinStr);
  const safeDuree = escapeHtml(duree);
  const safeLieu = escapeHtml(lieuDisplay);

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>

    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Ceci est un rappel concernant votre atelier pratique <strong>${safeTitre}</strong>, qui se déroulera <strong>${escapeHtml(datePhrase)}</strong>.
    </p>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Merci d'arriver 10 minutes à l'avance afin de vous installer et d'émarger dès le début de la séance.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 32%;">Thème :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeTitre}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Parcours :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">Atelier Pratique & Collaboratif</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Date :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeDateDisplay}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Horaires :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeHeureDebut} - ${safeHeureFin} (${safeDuree})</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Intervenant :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeAnimateur}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Lieu :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeLieu}</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      À très vite pour cet atelier interactif !
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">Équipe d’Animation — IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Rappel : Atelier ${safeTitre}`,
    badgeText: 'RAPPEL • ATELIER PRATIQUE',
    badgeColor: '#0284c7',
    contentHtml
  });

  const defaultText = `Bonjour ${nomIncube},

Ceci est un rappel concernant votre atelier pratique : "${titreAtelier}", prévu ${datePhrase}.

Détails de l'atelier :
- Thème : ${titreAtelier}
- Parcours : Atelier Pratique & Collaboratif
- Date : ${dateDisplay}
- Horaires : ${heureDebutStr} - ${heureFinStr} (${duree})
- Intervenant : ${rawAnimateur}
- Lieu : ${lieuDisplay}

Merci d'arriver 10 minutes à l'avance.

Bien cordialement,
Équipe d’Animation — IDS Salé`;

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: options.customMessage ? `${options.customMessage}\n\n${defaultText}` : defaultText
  });
};

/**
 * 7. Rappel Automatique de Réservation d'Espace (2h avant le créneau)
 */
const sendReservationReminderEmail = async (reservation, options = {}) => {
  const recipient = reservation.emailIncube || reservation.email || 'incubé@ids.ma';
  const nomIncube = reservation.nomIncube || reservation.nomComplet || 'Incubé';
  const precisionSalle = reservation.salleSpecifique ? ` (${reservation.salleSpecifique})` : '';
  const espace = `${(reservation.espace || 'Espace').toUpperCase()}${precisionSalle}`;
  const dateStr = formatDateFrench(reservation.dateReservation) || 'Aujourd\'hui';
  const horaire = `${reservation.heureDebut || '—'} - ${reservation.heureFin || '—'}`;
  const materiel = reservation.equipementsUtilises || 'Équipements standards';

  const subject = (options.customSubject && options.customSubject.trim())
    ? options.customSubject.trim()
    : `🔔 RAPPEL : Votre réservation pour ${espace} commence dans 2h !`;

  const safeNom = escapeHtml(nomIncube);
  const safeEspace = escapeHtml(espace);
  const safeDate = escapeHtml(dateStr);
  const safeHoraire = escapeHtml(horaire);
  const safeMateriel = escapeHtml(materiel);

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Ceci est un rappel : votre créneau de réservation d'espace au sein de l'incubateur commence dans <strong>2 heures</strong>.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 34%;">Espace réservé :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeEspace}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Date :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Créneau horaire :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeHoraire}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Matériel alloué :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeMateriel}</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      Merci d'arriver à l'heure, de respecter le matériel et de laisser le poste propre et ordonné après votre séance.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">L'équipe IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Rappel de Réservation : ${safeEspace}`,
    preheader: `Votre créneau débute à ${reservation.heureDebut}`,
    badgeText: 'RAPPEL DE RÉSERVATION',
    badgeColor: '#0284c7',
    contentHtml
  });

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: `Bonjour ${nomIncube}, rappel : votre réservation pour ${espace} (${materiel}) a lieu aujourd'hui de ${horaire}.`
  });
};

/**
 * 8. Email de Réinitialisation de Mot de Passe (Lien sécurisé)
 */
const sendForgotPasswordEmail = async (user, resetUrl, options = {}) => {
  const recipient = user.email;
  const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur';

  const safeNom = escapeHtml(nomComplet);
  const subject = (options.customSubject && options.customSubject.trim())
    ? options.customSubject.trim()
    : `🔐 Réinitialisation de votre mot de passe - Plateforme IDS`;

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Une demande de réinitialisation de mot de passe a été initiée pour votre compte sur la plateforme de l'<strong>Incubateur Digital Solidaire</strong>.
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Pour définir un nouveau mot de passe sécurisé, veuillez cliquer sur le bouton ci-dessous :
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 36%;">Identifiant / Email :</td><td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${escapeHtml(recipient)}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Délai de validité :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">30 minutes</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Usage :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">Lien unique et strictement personnel</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">
      Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel restera inchangé.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">Support Technique — IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Réinitialisation de Mot de Passe`,
    preheader: `Lien sécurisé valable 30 minutes`,
    badgeText: 'RÉINITIALISATION DE MOT DE PASSE',
    badgeColor: '#0284c7',
    contentHtml,
    ctaText: "Réinitialiser mon mot de passe",
    ctaUrl: resetUrl
  });

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: `Bonjour ${nomComplet}, pour réinitialiser votre mot de passe IDS, cliquez sur ce lien (valable 30 minutes) : ${resetUrl}`
  });
};

/**
 * 9. Email de Confirmation de Réinitialisation par le Super Admin
 */
const sendPasswordResetByAdminEmail = async (user, newPassword, options = {}) => {
  const recipient = user.email;
  const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur';

  const safeNom = escapeHtml(nomComplet);
  const safeEmail = escapeHtml(recipient);
  const safePassword = escapeHtml(newPassword);
  const subject = (options.customSubject && options.customSubject.trim())
    ? options.customSubject.trim()
    : `🔑 Vos nouveaux identifiants de connexion - Plateforme IDS`;

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNom}</strong>,</p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Votre mot de passe d'accès à la plateforme de l'<strong>Incubateur Digital Solidaire</strong> a été réinitialisé par l'administration.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 36%;">Identifiant / Email :</td><td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeEmail}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Nouveau mot de passe :</td><td style="padding: 6px 0; font-family: monospace; font-weight: 700; color: #0284c7;">${safePassword}</td></tr>
      </table>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
      🔒 Pour votre sécurité, nous vous recommandons de personnaliser ce mot de passe dès votre prochaine connexion dans votre profil utilisateur.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">L'équipe IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Nouveaux Identifiants de Connexion`,
    preheader: `Votre mot de passe a été mis à jour`,
    badgeText: 'NOUVEAUX IDENTIFIANTS DE CONNEXION',
    badgeColor: '#0284c7',
    contentHtml
  });

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: `Bonjour ${nomComplet}, votre mot de passe IDS a été réinitialisé. Identifiant : ${recipient} | Mot de passe : ${newPassword}`
  });
};

/**
 * 1.bis Notification envoyée à l'Accompagnateur pour validation en 1-Clic Sécurisé
 */
const sendDemandeReservationAccompagnateurEmail = async (reservation, accompagnateur = {}, { urlValide, urlRefuse }, options = {}) => {
  const recipient = accompagnateur.email || process.env.ADMIN_NOTIFY_EMAIL || 'incubateur.digital.solidaire@gmail.com';
  const nomAccomp = accompagnateur.prenom ? `${accompagnateur.prenom} ${accompagnateur.nom || ''}`.trim() : (accompagnateur.nom || 'Accompagnateur');
  const nomIncube = reservation.nomIncube || reservation.nomComplet || 'Un incubé';
  const dateStr = formatDateFrench(reservation.dateReservation) || 'Date à venir';
  const horaire = `${reservation.heureDebut || '—'} - ${reservation.heureFin || '—'}`;
  const duree = reservation.duree || `${Math.round((reservation.dureeMinutes || 120) / 60)}h`;

  const espaceLabels = {
    fablab: 'Espace FabLab',
    studio: 'Studio Média IDS',
    salle_reunion: 'Salle de Réunion'
  };
  const espace = espaceLabels[reservation.espace] || reservation.espace || 'Espace Incubateur';
  const salle = reservation.salleSpecifique || reservation.salle ? ` (${reservation.salleSpecifique || reservation.salle})` : '';

  const subject = (options.customSubject && options.customSubject.trim())
    ? options.customSubject.trim()
    : `🔔 Demande de Réservation à Valider : ${nomIncube} — ${espace}${salle}`;

  const safeNomAccomp = escapeHtml(nomAccomp);
  const safeNomIncube = escapeHtml(nomIncube);
  const safeEspace = escapeHtml(espace);
  const safeSalle = escapeHtml(salle);
  const safeDate = escapeHtml(dateStr);
  const safeHoraire = escapeHtml(horaire);
  const safeDuree = escapeHtml(duree);
  const safeMotif = escapeHtml(reservation.motifUtilisation || reservation.motif || 'Non renseigné');
  const safeEquip = escapeHtml(reservation.equipementsUtilises || 'Aucun équipement spécifique');

  const defaultIntroHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">Bonjour <strong>${safeNomAccomp}</strong>,</p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Votre incubé <strong>${safeNomIncube}</strong> a formulé une nouvelle demande de réservation d'espace nécessitant votre approbation.
    </p>
  `;

  const customIntroHtml = options.customMessage ? formatCustomMessageHtml(options.customMessage) : null;
  const introHtml = customIntroHtml || defaultIntroHtml;

  const contentHtml = `
    ${introHtml}

    <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 24px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; line-height: 1.6;">
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500; width: 34%;">Porteur de projet :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeNomIncube}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Espace & Salle :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeEspace}${safeSalle}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Date du créneau :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Horaires :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeHoraire} (${safeDuree})</td></tr>
        <tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Motif / Activité :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">« ${safeMotif} »</td></tr>
        ${reservation.equipementsUtilises ? `<tr><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">Matériel demandé :</td><td style="padding: 6px 0; font-weight: 500; color: #0f172a;">${safeEquip}</td></tr>` : ''}
      </table>
    </div>

    <!-- BOUTONS D'ACTION 1-CLIC SÉCURISÉS -->
    <div style="text-align: center; margin: 28px 0 16px 0;">
      <a href="${urlValide}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 12px; font-weight: 700; font-size: 13px; display: inline-block; margin: 6px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); letter-spacing: 0.2px;">
        ✅ Valider la Réservation
      </a>
      <a href="${urlRefuse}" style="background: #ffffff; color: #ef4444; border: 1.5px solid #ef4444; text-decoration: none; padding: 11px 22px; border-radius: 12px; font-weight: 700; font-size: 13px; display: inline-block; margin: 6px;">
        ❌ Refuser
      </a>
    </div>

    <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 18px;">
      🔒 <strong>Lien sécurisé et strictement personnel</strong> (valable 48h). Aucune connexion par mot de passe n'est requise.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 20px 0;" />

    <div style="font-size: 14px; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 4px 0;">Bien cordialement,</p>
      <p style="margin: 0; font-weight: 700; color: #00254d;">Système de Gestion — IDS Salé</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title: `Demande de Réservation : ${safeNomIncube}`,
    preheader: `${safeNomIncube} a réservé ${safeEspace}${safeSalle} pour le ${safeDate}`,
    badgeText: 'DEMANDE DE RÉSERVATION À VALIDER',
    badgeColor: '#0284c7',
    contentHtml
  });

  return await sendEmail({
    to: recipient,
    cc: options.cc,
    subject,
    html,
    text: `Bonjour ${nomAccomp}, ${nomIncube} a réservé ${espace}${salle} le ${dateStr} (${horaire}). Pour valider : ${urlValide} | Pour refuser : ${urlRefuse}`
  });
};

module.exports = {
  sendEmail,
  sendReservationStatusEmail,
  sendDemandeReservationAccompagnateurEmail,
  sendRdvConfirmationEmail,
  sendFormationInvitationEmail,
  sendAtelierInvitationEmail,
  sendAlerteAssiduiteEmail,
  sendWelcomeEmail,
  sendWorkshopReminderEmail,
  sendAtelierReminderEmail,
  sendReservationReminderEmail,
  sendForgotPasswordEmail,
  sendPasswordResetByAdminEmail,
  formatDateFrench,
  formatDateIntervalFrench,
  detectFormationType,
  detectFormationTheme,
  detectIsFormation
};
