/**
 * calendarHelper.js
 * Utilitaires pour lier les rendez-vous d'accompagnement à Google Calendar et exporter en format standard .ICS
 */

// Calcule les dates de début et de fin sous format compatible Google Calendar (YYYYMMDDTHHmmss)
export function getStartAndEndDates(dateRdv, heureRdv = '10:00', duree = '1h') {
  const [year, month, day] = (dateRdv || new Date().toISOString().split('T')[0]).split('-').map(Number);
  const [hour, minute] = (heureRdv || '10:00').split(':').map(Number);

  const start = new Date(year, month - 1, day, hour, minute);

  let durationMinutes = 60;
  if (duree === '30min') durationMinutes = 30;
  else if (duree === '1h') durationMinutes = 60;
  else if (duree === '1h30') durationMinutes = 90;
  else if (duree === '2h') durationMinutes = 120;
  else if (typeof duree === 'number') durationMinutes = duree;

  const end = new Date(start.getTime() + durationMinutes * 60000);

  const formatGCal = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  return {
    startGCal: formatGCal(start),
    endGCal: formatGCal(end),
    startDate: start,
    endDate: end
  };
}

/**
 * Génère le lien direct pour ajouter le rendez-vous dans Google Calendar
 */
export function generateGoogleCalendarUrl(rdv) {
  if (!rdv) return '#';
  const { startGCal, endGCal } = getStartAndEndDates(rdv.dateRdv, rdv.heureRdv, rdv.duree);

  const title = `RDV Accompagnement : ${rdv.sujet || 'Suivi Incubateur'}`;
  
  const descriptionLines = [
    `📅 Rendez-vous d'accompagnement — Incubateur IDS / Fablab`,
    `----------------------------------------------------`,
    `👤 Incubé(s) concerné(s) : ${rdv.incubeNoms || 'Non spécifié'}`,
    `🤝 Accompagnateur : ${rdv.accompagnateurNom || 'Accompagnateur IDS'}`,
    `⏱️ Durée prévue : ${rdv.duree || '1h'}`,
    `📍 Lieu : ${rdv.lieu || 'Bureaux Incubateur IDS / Fablab'}`,
  ];

  if (rdv.commentaireEmail) {
    descriptionLines.push(`💬 Ordre du jour / Message : ${rdv.commentaireEmail}`);
  }

  const details = descriptionLines.join('\n');
  const location = rdv.lieu || 'Bureaux Incubateur IDS / Fablab';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startGCal}/${endGCal}`,
    details: details,
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Télécharge un fichier standard iCalendar (.ics) pour Outlook, Apple Calendar ou Google Calendar
 */
export function downloadIcsFile(rdv) {
  if (!rdv) return;
  const { startGCal, endGCal } = getStartAndEndDates(rdv.dateRdv, rdv.heureRdv, rdv.duree);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const title = `RDV Accompagnement - ${rdv.sujet || 'Suivi Incubateur'}`;
  const description = `Incube(s): ${rdv.incubeNoms || 'Dossier'}\\nAccompagnateur: ${rdv.accompagnateurNom || 'IDS'}\\n${rdv.commentaireEmail || ''}`;
  const location = rdv.lieu || 'Bureaux Incubateur IDS / Fablab';

  const escapeIcs = (v = '') => String(v)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Incubateur IDS//Booking Calendrier//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:rdv-${rdv.id || Date.now()}@incubateur-ids.ma`,
    `DTSTAMP:${now}`,
    `DTSTART:${startGCal}`,
    `DTEND:${endGCal}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RDV_${rdv.dateRdv || 'booking'}_${rdv.sujet ? rdv.sujet.slice(0, 15).replace(/\s+/g, '_') : 'rdv'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
