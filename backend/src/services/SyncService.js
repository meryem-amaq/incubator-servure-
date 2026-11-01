require('dotenv').config();
const { Op } = require('sequelize');
const { ReservationEspace, PresenceAtelier, Atelier, Incube, EquipementEspace, ChecklistMateriel } = require('../models');

/**
 * Service de synchronisation bidirectionnelle entre le serveur local (Master)
 * et le relais cloud public.
 */
class SyncService {
  constructor() {
    this.cloudUrl = (process.env.CLOUD_URL || 'http://localhost:5001').replace(/\/+$/, '');
    this.syncSecret = process.env.SYNC_SECRET || 'ids_secret_sync_key_987654321_secure';
    this.intervalId = null;
    this.isSyncing = false;
  }

  /**
   * Headers d'authentification pour interroger le cloud
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.syncSecret}`
    };
  }

  /**
   * Démarre le cycle automatique de synchronisation (par défaut toutes les 10 minutes)
   */
  startCron(intervalMinutes = 10) {
    if (this.intervalId) clearInterval(this.intervalId);

    const ms = intervalMinutes * 60 * 1000;
    console.log(`🔄 [SyncService] Cron de synchronisation activé (toutes les ${intervalMinutes} min vers ${this.cloudUrl})`);

    // Premier test de sync après 5 secondes au démarrage
    setTimeout(() => {
      this.pullAndSync().catch(err => {
        console.warn(`ℹ️ [SyncService] Note initiale: le cloud relais est peut-être en attente (${err.message})`);
      });
    }, 5000);

    this.intervalId = setInterval(() => {
      this.pullAndSync().catch(err => {
        console.warn(`⚠️ [SyncService] Erreur lors de la synchronisation périodique: ${err.message}`);
      });
    }, ms);
  }

  /**
   * Arrête le cron
   */
  stopCron() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Aspire (PULL) les nouvelles réservations et présences depuis le relais cloud,
   * les insère dans MariaDB localement, puis confirme la purge au cloud (CLEAN).
   */
  async pullAndSync() {
    if (this.isSyncing) return { message: 'Synchronisation déjà en cours' };
    this.isSyncing = true;

    try {
      // 1. Récupération des données en attente sur le Cloud
      const pullUrl = `${this.cloudUrl}/api/sync/pull`;
      const response = await fetch(pullUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Réponse cloud HTTP ${response.status}`);
      }

      const data = await response.json();
      const reservations = data.reservations || [];
      const presences = data.presences || [];

      if (reservations.length === 0 && presences.length === 0) {
        this.isSyncing = false;
        return { success: true, pulledReservations: 0, pulledPresences: 0 };
      }

      const syncedReservationIds = [];
      const syncedPresenceIds = [];

      // 2. Traitement et insertion des réservations dans MariaDB
      for (const res of reservations) {
        try {
          const ppNum = res.numero_pp || res.pp_numero || res.ppNumero || '';
          const emailVal = (res.email_incube || res.emailIncube || res.email || '').trim().toLowerCase();
          const nomVal = (res.nom_incube || res.nomIncube || res.nomComplet || res.nom || '').trim().toLowerCase();
          
          const isAdmin = 
            String(ppNum).toUpperCase() === 'ADMIN' ||
            emailVal.includes('admin') ||
            nomVal.includes('admin');

          const targetStatut = isAdmin ? 'valide' : 'en_attente';

          const createdReservation = await ReservationEspace.create({
            espace: res.espace || 'fablab',
            salleSpecifique: res.salle_specifique || res.salleSpecifique || res.salle || null,
            nomIncube: res.nom_incube || res.nomIncube || res.nomComplet || res.nom || '—',
            emailIncube: res.email_incube || res.emailIncube || res.email || null,
            telephoneIncube: res.telephone_incube || res.telephoneIncube || res.telephone || null,
            dateReservation: res.date_reservation || res.dateReservation,
            heureDebut: res.heure_debut || res.heureDebut,
            heureFin: res.heure_fin || res.heureFin,
            duree: res.duree || '2h',
            motifUtilisation: res.motif_utilisation || res.motifUtilisation || res.motif || null,
            equipementsUtilises: res.equipements_utilises || res.equipementsUtilises || null,
            statut: targetStatut
          });

          // Si réservation administrateur auto-validée, générer la checklist matériel automatiquement
          if (targetStatut === 'valide' && EquipementEspace && ChecklistMateriel) {
            try {
              const equipWhere = { espace: createdReservation.espace };
              if (createdReservation.salleSpecifique) {
                equipWhere.salle = createdReservation.salleSpecifique;
              }
              const equipements = await EquipementEspace.findAll({ where: equipWhere });
              if (equipements && equipements.length > 0) {
                await ChecklistMateriel.destroy({ where: { reservation_id: createdReservation.id } });
                const checklists = equipements.map(e => ({
                  reservation_id: createdReservation.id,
                  equipement_id: e.id,
                  etat_avant: e.etatAvant || 'Opérationnel / Parfait état',
                  etat_apres: e.etatApres || 'Conforme & Rendu propre'
                }));
                await ChecklistMateriel.bulkCreate(checklists);
              }
              console.log(`⚡ [SyncService] Réservation admin #${createdReservation.id} auto-validée avec ${equipements?.length || 0} équipements en checklist.`);
            } catch (chkErr) {
              console.warn(`⚠️ [SyncService] Erreur génération checklist admin pour rés #${createdReservation.id}:`, chkErr.message);
            }
          }

          syncedReservationIds.push(res.id);
        } catch (err) {
          console.error(`❌ [SyncService] Échec insertion réservation ID cloud ${res.id}:`, err.message);
        }
      }

      // 3. Traitement et insertion des présences dans MariaDB
      for (const p of presences) {
        try {
          const aId = p.atelier_id || p.atelierId;
          let iId = p.incube_id || p.incubeId;
          const nom = p.nom || '—';
          const prenom = p.prenom || '—';
          const pp = p.pp_numero || p.ppNumero || '—';
          const email = (p.email || p.email_incube || '').trim().toLowerCase() || null;
          const time = p.time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

          // Si pas d'incubeId, essayer de faire un matching par email en priorité, puis par N° PP ou nom
          if (!iId || iId === 'null') {
            const allIncubes = await Incube.findAll({ attributes: ['id', 'nom_incube', 'pp_numero', 'email'] });
            let matched = null;
            if (email) {
              matched = allIncubes.find(inc => inc.email && inc.email.trim().toLowerCase() === email);
            }
            if (!matched && pp && pp !== '—') {
              matched = allIncubes.find(inc => inc.pp_numero && inc.pp_numero.trim().toUpperCase() === pp.toUpperCase());
            }
            if (!matched) {
              matched = allIncubes.find(inc => {
                if (!inc.nom_incube) return false;
                const dbName = inc.nom_incube.trim().toLowerCase();
                return dbName.includes(nom.toLowerCase()) || (prenom !== '—' && dbName.includes(prenom.toLowerCase()));
              });
            }
            if (matched) {
              iId = String(matched.id);
            } else {
              iId = `cloud_${p.id}_${Date.now()}`;
            }
          }

          await PresenceAtelier.upsert({
            atelierId: String(aId),
            incubeId: String(iId),
            nom,
            prenom,
            ppNumero: pp,
            email,
            present: true,
            time,
            signedAt: p.signed_at || new Date()
          });

          syncedPresenceIds.push(p.id);
        } catch (err) {
          console.error(`❌ [SyncService] Échec insertion présence ID cloud ${p.id}:`, err.message);
        }
      }

      // 4. Confirmer la purge au Cloud (CLEAN) pour ne pas ré-importer en boucle
      if (syncedReservationIds.length > 0 || syncedPresenceIds.length > 0) {
        const cleanUrl = `${this.cloudUrl}/api/sync/clean`;
        await fetch(cleanUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            reservationIds: syncedReservationIds,
            presenceIds: syncedPresenceIds
          })
        });

        console.log(`✅ [SyncService] Synchronisation réussie : ${syncedReservationIds.length} réservations et ${syncedPresenceIds.length} présences intégrées.`);
      }

      return {
        success: true,
        pulledReservations: syncedReservationIds.length,
        pulledPresences: syncedPresenceIds.length
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pousse (PUSH) des ateliers locaux vers le relais cloud afin que les incubés
   * puissent voir le titre, les horaires et le statut lors de l'émargement QR.
   */
  async pushAteliersToCloud(ateliers) {
    if (!process.env.CLOUD_URL) return true;
    try {
      if (!Array.isArray(ateliers)) ateliers = [ateliers];
      const pushUrl = `${this.cloudUrl}/api/sync/events`;

      const formatted = ateliers.map(a => ({
        id: String(a.id),
        titre: a.titre,
        formateur: a.formateur,
        intervenant: a.intervenant,
        date: a.date,
        heureDebut: a.heureDebut || a.heure_debut,
        heureFin: a.heureFin || a.heure_fin,
        duree: a.duree,
        description: a.description,
        statutOuverture: a.statutOuverture || a.statut_ouverture || 'auto'
      }));

      const res = await fetch(pushUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ ateliers: formatted })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      console.log(`📤 [SyncService] ${formatted.length} atelier(s) poussé(s) vers le relais cloud.`);
      return true;
    } catch (err) {
      console.warn(`⚠️ [SyncService] Impossible de pousser les ateliers au cloud (${err.message})`);
      return false;
    }
  }
  /**
   * Pousse (PUSH) les réservations locales actives et annulées vers le Cloud
   * pour que le formulaire public QR Code bloque les créneaux déjà occupés.
   */
  async pushLocalReservationsToCloud() {
    if (!process.env.CLOUD_URL) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const localReservations = await ReservationEspace.findAll({
        where: {
          dateReservation: { [Op.gte]: today }
        }
      });

      if (!localReservations || localReservations.length === 0) return;

      const payload = localReservations.map(r => ({
        espace: r.espace,
        salleSpecifique: r.salleSpecifique,
        nomIncube: r.nomIncube,
        emailIncube: r.emailIncube,
        telephoneIncube: r.telephoneIncube,
        dateReservation: r.dateReservation,
        heureDebut: r.heureDebut,
        heureFin: r.heureFin,
        statut: r.statut,
        motifUtilisation: r.motifUtilisation,
        equipementsUtilises: r.equipementsUtilises
      }));

      const res = await fetch(`${this.cloudUrl}/api/sync/reservations-locales`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reservations: payload })
      });

      if (res.ok) {
        console.log(`📤 [SyncService] ${localReservations.length} réservation(s) locale(s) synchronisée(s) vers le Cloud.`);
      }
    } catch (err) {
      console.warn(`⚠️ [SyncService] Erreur pushLocalReservationsToCloud :`, err.message);
    }
  }
}

module.exports = new SyncService();
