import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SignatureCanvas from 'react-signature-canvas';
import { X, Check, Eraser, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

export default function SignatureModal({ 
  isOpen, 
  onClose, 
  onValidate, 
  title = "Signature Électronique", 
  pdfPreviewUrl,
  documentHtml 
}) {
  const sigPadIncube = useRef(null);
  const sigPadAccompagnateur = useRef(null);
  const [error, setError] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);

  // S'assurer que le canvas s'ajuste à la bonne taille et préserve les tracés
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const pads = [sigPadIncube.current, sigPadAccompagnateur.current];
        pads.forEach(pad => {
          if (!pad) return;
          const canvas = pad.getCanvas();
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          const data = pad.isEmpty() ? null : pad.toData();
          
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Réinitialiser avant d'appliquer le ratio
          ctx.scale(ratio, ratio);
          
          if (data) {
            pad.fromData(data);
          } else {
            pad.clear();
          }
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMaximized]);

  if (!isOpen) return null;

  const handleClear = (type) => {
    if (type === 'incube' && sigPadIncube.current) sigPadIncube.current.clear();
    if (type === 'accompagnateur' && sigPadAccompagnateur.current) sigPadAccompagnateur.current.clear();
    setError('');
  };

  const handleValidate = () => {
    const incubeEmpty = !sigPadIncube.current || sigPadIncube.current.isEmpty();
    const accEmpty = !sigPadAccompagnateur.current || sigPadAccompagnateur.current.isEmpty();
    
    if (incubeEmpty && accEmpty) {
      setError("Veuillez dessiner au moins une signature avant de valider.");
      return;
    }
    
    const signatureDataURL = {
      incube: incubeEmpty ? null : sigPadIncube.current.getCanvas().toDataURL('image/png'),
      accompagnateur: accEmpty ? null : sigPadAccompagnateur.current.getCanvas().toDataURL('image/png')
    };
    
    onValidate(signatureDataURL);
    onClose();
  };

  const handleOpenInNewTab = () => {
    if (pdfPreviewUrl) {
      window.open(pdfPreviewUrl, '_blank');
    } else if (documentHtml) {
      const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const hasPreview = Boolean(pdfPreviewUrl || documentHtml);

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${isMaximized ? 'p-0' : 'p-2 sm:p-4'} bg-slate-900/70 backdrop-blur-sm transition-all`}>
      <div 
        className={`bg-white dark:bg-dark-900 shadow-2xl w-full flex flex-col border border-slate-200 dark:border-dark-700 transition-all ${
          isMaximized 
            ? 'h-full rounded-none' 
            : hasPreview 
              ? 'w-[98vw] max-w-[1650px] h-[94vh] rounded-2xl' 
              : 'max-w-xl rounded-2xl'
        } overflow-hidden`}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-dark-800 bg-slate-50/70 dark:bg-dark-800/50">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">✍️</span>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Vérifiez le document à gauche puis apposez votre signature à droite
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasPreview && (
              <>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-700 transition-colors shadow-sm"
                  title="Ouvrir le document dans un nouvel onglet"
                >
                  <ExternalLink size={13} />
                  <span>Nouvel onglet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-dark-700 rounded-xl transition-colors text-slate-600 dark:text-dark-300"
                  title={isMaximized ? "Réduire la taille" : "Agrandir en plein écran"}
                >
                  {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-xl transition-colors text-slate-500 hover:text-red-600 dark:text-dark-400"
              title="Fermer"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Corps : Aperçu du Document (Gauche) + Canvas de Signature (Droite) */}
        <div className={`flex-1 overflow-hidden flex flex-col ${hasPreview ? 'lg:flex-row' : ''} gap-4 p-3 sm:p-4 min-h-0 bg-slate-50/40 dark:bg-dark-950/40`}>
          
          {/* Section 1 : Aperçu visuel complet du Document officiel (GRAND ESPACE) */}
          {hasPreview && (
            <div className="flex-1 border border-slate-200 dark:border-dark-700 rounded-xl overflow-hidden flex flex-col h-full bg-white dark:bg-dark-900 shadow-sm">
              <div className="bg-slate-100 dark:bg-dark-800 px-3.5 py-2 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 flex-shrink-0">
                <span className="flex items-center gap-2">
                  📄 <span className="font-extrabold">Aperçu officiel du document</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    (Vérifiez le contenu avant de signer)
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    ✓ Document Prêt
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="sm:hidden text-xs text-primary-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink size={12} /> Ouvrir
                  </button>
                </div>
              </div>

              <div className="flex-1 w-full h-full min-h-[450px] overflow-hidden bg-slate-200 dark:bg-dark-950">
                {documentHtml ? (
                  <iframe 
                    srcDoc={documentHtml} 
                    className="w-full h-full min-h-[450px] border-0 bg-white"
                    title="Aperçu du document officiel"
                  />
                ) : (
                  <iframe 
                    src={`${pdfPreviewUrl}#view=FitH`} 
                    className="w-full h-full min-h-[450px] border-0 bg-white"
                    title="Aperçu PDF officiel"
                  />
                )}
              </div>
            </div>
          )}

          {/* Section 2 : Zones de Signature Manuscrite (Largeur optimisée pour laisser la place au document) */}
          <div className={`${hasPreview ? 'w-full lg:w-[380px]' : 'w-full'} flex flex-col justify-between flex-shrink-0 bg-white dark:bg-dark-900 p-4 rounded-xl border border-slate-200 dark:border-dark-700 shadow-sm overflow-y-auto`}>
            <div>
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>✍️</span> Signatures Électroniques
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                    Requis
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Dessinez les signatures manuscrites dans les cadres ci-dessous à l'aide de la souris ou d'un stylet.
                </p>
              </div>
              
              {/* Signature Incubé */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">1. Signature du porteur / incubé</span>
                  <button 
                    type="button"
                    onClick={() => handleClear('incube')} 
                    className="text-[10px] text-red-500 hover:text-red-600 font-bold flex items-center gap-1"
                  >
                    <Eraser size={12} /> Effacer
                  </button>
                </div>
                <div className="w-full border-2 border-dashed border-emerald-500/50 dark:border-emerald-500/40 rounded-xl bg-slate-50/70 dark:bg-dark-950 relative shadow-inner">
                  <SignatureCanvas 
                    ref={sigPadIncube}
                    penColor="#0f172a"
                    canvasProps={{
                      className: 'w-full h-32 sm:h-36 cursor-crosshair rounded-xl',
                      style: { touchAction: 'none' }
                    }}
                    backgroundColor="transparent"
                  />
                  <div className="absolute bottom-2 left-2 text-[10px] text-slate-400 dark:text-dark-400 pointer-events-none select-none">
                    Zone de tracé
                  </div>
                </div>
              </div>

              {/* Signature Accompagnateur */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">2. Signature de l'accompagnateur</span>
                  <button 
                    type="button"
                    onClick={() => handleClear('accompagnateur')} 
                    className="text-[10px] text-red-500 hover:text-red-600 font-bold flex items-center gap-1"
                  >
                    <Eraser size={12} /> Effacer
                  </button>
                </div>
                <div className="w-full border-2 border-dashed border-emerald-500/50 dark:border-emerald-500/40 rounded-xl bg-slate-50/70 dark:bg-dark-950 relative shadow-inner">
                  <SignatureCanvas 
                    ref={sigPadAccompagnateur}
                    penColor="#0f172a"
                    canvasProps={{
                      className: 'w-full h-32 sm:h-36 cursor-crosshair rounded-xl',
                      style: { touchAction: 'none' }
                    }}
                    backgroundColor="transparent"
                  />
                  <div className="absolute bottom-2 left-2 text-[10px] text-slate-400 dark:text-dark-400 pointer-events-none select-none">
                    Zone de tracé
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="p-2.5 mt-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 text-xs font-bold animate-shake">
                  ⚠️ {error}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-dark-800">
              <p className="text-[11px] text-slate-400 dark:text-dark-400 text-center leading-relaxed">
                🔒 Cette signature a valeur de signature électronique et sera insérée directement sur le rapport officiel.
              </p>
            </div>
          </div>
        </div>

        {/* Pied de page avec actions */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-dark-800 flex items-center justify-between gap-3 bg-white dark:bg-dark-900 flex-shrink-0">
          <div className="text-xs text-slate-500 dark:text-dark-400 hidden sm:block">
            {hasPreview && (
              <span>Vous pouvez agrandir la fenêtre avec le bouton <Maximize2 size={13} className="inline mx-0.5 text-slate-600 dark:text-slate-300" /> en haut à droite.</span>
            )}
          </div>
          
          <div className="flex gap-2.5 ml-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="btn btn-secondary text-xs font-bold px-4"
            >
              Annuler
            </button>
            <button 
              type="button"
              onClick={handleValidate} 
              className="btn btn-primary flex items-center gap-2 text-xs font-extrabold px-5 shadow-sm shadow-emerald-500/20"
            >
              <Check size={16} /> Valider & Télécharger le document
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
