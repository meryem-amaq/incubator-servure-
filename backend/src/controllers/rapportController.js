const { collectRapportData, generateAiNarrative, buildDocxReport } = require('../services/rapportService');

/**
 * GET /api/rapports/preview-data
 * Prévisualisation des métriques consolidées avant génération du rapport
 */
exports.getPreviewData = async (req, res) => {
  try {
    const { annee = new Date().getFullYear(), trimestre = 'T1', mois } = req.query;
    const data = await collectRapportData({ annee, trimestre, mois });
    res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('Erreur getPreviewData:', err);
    res.status(500).json({ message: 'Erreur lors du calcul des indicateurs', error: err.message });
  }
};

/**
 * POST /api/rapports/generer-word
 * Génère et télécharge directement le rapport d'activité complet au format Word (.docx)
 */
exports.genererRapportWord = async (req, res) => {
  try {
    const { annee = new Date().getFullYear(), trimestre = 'T1', mois = 'Trimestriel' } = req.body;

    console.log(`📄 Génération du rapport d'activité Word pour ${trimestre} ${annee}...`);
    const data = await collectRapportData({ annee, trimestre, mois });
    const narrative = await generateAiNarrative(data);
    const buffer = await buildDocxReport(data, narrative);

    const safeFilename = `Rapport_Activite_IDS_${trimestre}_${annee}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('❌ Erreur génération rapport Word:', err);
    res.status(500).json({ message: 'Erreur lors de la génération du document Word', error: err.message });
  }
};
