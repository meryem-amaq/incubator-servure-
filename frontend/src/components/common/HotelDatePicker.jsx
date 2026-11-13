import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  Sparkles, 
  Check, 
  Sun, 
  CalendarDays,
  RotateCcw
} from 'lucide-react';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Composant de sélection de dates style Booking.com / Réservation Hôtelière
 * Permet de sélectionner soit un jour unique, soit une plage de dates (2 jours ou plus).
 */
export default function HotelDatePicker({
  startDate = '',
  endDate = '',
  onChange = () => {},
  minDate = null
}) {
  // Mode de sélection : 'single' (1 jour) ou 'range' (plage de dates)
  const isMultiDay = Boolean(endDate && endDate !== startDate);
  const [mode, setMode] = useState(isMultiDay ? 'range' : 'single');

  // Mois & Année affichés dans le calendrier
  const initialDateObj = startDate ? new Date(startDate) : new Date();
  const [currentMonth, setCurrentMonth] = useState(
    isNaN(initialDateObj.getTime()) ? new Date().getMonth() : initialDateObj.getMonth()
  );
  const [currentYear, setCurrentYear] = useState(
    isNaN(initialDateObj.getTime()) ? new Date().getFullYear() : initialDateObj.getFullYear()
  );

  // État de survol (hover) pour prévisualiser la plage comme sur Booking.com
  const [hoverDate, setHoverDate] = useState(null);

  // Helpers de date
  const toDateStr = (year, month, day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const parseDate = (dStr) => {
    if (!dStr) return null;
    const parts = dStr.split('-').map(Number);
    if (parts.length !== 3) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  const formatDisplay = (dStr) => {
    if (!dStr) return 'Sélectionner';
    const d = parseDate(dStr);
    if (!d) return dStr;
    return d.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calcul du nombre de jours
  const totalDays = useMemo(() => {
    if (!startDate) return 0;
    if (!endDate || startDate === endDate) return 1;
    const d1 = parseDate(startDate);
    const d2 = parseDate(endDate);
    if (!d1 || !d2) return 1;
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [startDate, endDate]);

  // Navigation mois
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Génération de la grille du mois (42 cellules : 6 semaines x 7 jours)
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    // En JS: 0 = Dimanche. On convertit pour Lun = 0 .. Dim = 6
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells = [];

    // Jours du mois précédent (grisés)
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      cells.push({
        day: dayNum,
        dateStr: toDateStr(prevY, prevM, dayNum),
        isCurrentMonth: false
      });
    }

    // Jours du mois en cours
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      cells.push({
        day: dayNum,
        dateStr: toDateStr(currentYear, currentMonth, dayNum),
        isCurrentMonth: true
      });
    }

    // Jours du mois suivant pour compléter à 35 ou 42 cellules
    const remaining = (7 - (cells.length % 7)) % 7;
    const totalNeeded = cells.length + remaining < 35 ? 35 : cells.length + remaining;
    const nextDaysCount = totalNeeded - cells.length;

    for (let dayNum = 1; dayNum <= nextDaysCount; dayNum++) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      cells.push({
        day: dayNum,
        dateStr: toDateStr(nextY, nextM, dayNum),
        isCurrentMonth: false
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Clic sur un jour du calendrier (style Booking)
  const handleDayClick = (dateStr) => {
    if (mode === 'single') {
      onChange({ startDate: dateStr, endDate: '' });
      return;
    }

    // Mode 'range'
    if (!startDate || (startDate && endDate)) {
      // Premier clic : initialise la date de début
      onChange({ startDate: dateStr, endDate: '' });
      setHoverDate(null);
    } else if (startDate && !endDate) {
      // Second clic : finalise la plage
      if (dateStr < startDate) {
        // Si l'utilisateur clique sur une date antérieure, on inverse
        onChange({ startDate: dateStr, endDate: startDate });
      } else if (dateStr === startDate) {
        // Clic sur la même date = 1 seul jour
        onChange({ startDate: dateStr, endDate: '' });
      } else {
        onChange({ startDate, endDate: dateStr });
      }
      setHoverDate(null);
    }
  };

  // Basculer en mode 1 jour
  const setSingleDayMode = () => {
    setMode('single');
    onChange({ startDate: startDate || new Date().toISOString().split('T')[0], endDate: '' });
    setHoverDate(null);
  };

  // Basculer en mode plage de dates
  const setRangeMode = () => {
    setMode('range');
    const start = startDate || new Date().toISOString().split('T')[0];
    // Par défaut, propose +1 jour pour amorcer la plage si pas de dateFin
    if (!endDate || endDate === start) {
      const d = parseDate(start);
      if (d) {
        d.setDate(d.getDate() + 1);
        const nextDayStr = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
        onChange({ startDate: start, endDate: nextDayStr });
      }
    }
  };

  // Raccourcis rapides style Booking
  const setQuickRange = (daysCount) => {
    const start = startDate || new Date().toISOString().split('T')[0];
    if (daysCount === 1) {
      setMode('single');
      onChange({ startDate: start, endDate: '' });
    } else {
      setMode('range');
      const d = parseDate(start);
      if (d) {
        d.setDate(d.getDate() + (daysCount - 1));
        const endStr = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
        onChange({ startDate: start, endDate: endStr });
      }
    }
  };

  // Aujourd'hui
  const todayStr = useMemo(() => {
    const now = new Date();
    return toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  return (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl p-4 shadow-sm space-y-3.5">
      {/* 1. Onglets de sélection de type de session : 1 Jour vs Plusieurs Jours */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-dark-700/60 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={setSingleDayMode}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              mode === 'single'
                ? 'bg-white dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-dark-300 hover:text-slate-900'
            }`}
          >
            <Sparkles size={13} className="text-amber-500" />
            1 Journée
          </button>
          <button
            type="button"
            onClick={setRangeMode}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              mode === 'range'
                ? 'bg-white dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-dark-300 hover:text-slate-900'
            }`}
          >
            <CalendarDays size={13} className="text-primary-500" />
            Plage de dates (2 jours ou +)
          </button>
        </div>

        {/* Boutons d'ajustement rapide */}
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-slate-400 dark:text-dark-400 font-medium mr-1 hidden sm:inline">Raccourcis :</span>
          <button
            type="button"
            onClick={() => setQuickRange(1)}
            className="px-2 py-1 rounded-md bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 hover:bg-primary-50 hover:text-primary-600 transition-colors font-medium"
          >
            1 j
          </button>
          <button
            type="button"
            onClick={() => setQuickRange(2)}
            className="px-2 py-1 rounded-md bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 hover:bg-primary-50 hover:text-primary-600 transition-colors font-medium"
          >
            2 j
          </button>
          <button
            type="button"
            onClick={() => setQuickRange(3)}
            className="px-2 py-1 rounded-md bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 hover:bg-primary-50 hover:text-primary-600 transition-colors font-medium"
          >
            3 j
          </button>
          <button
            type="button"
            onClick={() => setQuickRange(5)}
            className="px-2 py-1 rounded-md bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 hover:bg-primary-50 hover:text-primary-600 transition-colors font-medium"
          >
            Semaine (5j)
          </button>
        </div>
      </div>

      {/* 2. Cartes d'affichage style Booking (Date d'arrivée / Date de départ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* CARTE DÉBUT */}
        <div 
          onClick={() => {
            if (mode === 'range' && startDate && endDate) {
              onChange({ startDate, endDate: '' });
            }
          }}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            !endDate || mode === 'single'
              ? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/20'
              : 'border-slate-200 dark:border-dark-700 bg-slate-50/60 dark:bg-dark-800/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5">
              <CalendarIcon size={12} className="text-primary-600 dark:text-primary-400" />
              {mode === 'single' ? 'Date de la session' : 'Date de début (Arrivée)'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold">
              Jour 1
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white capitalize">
            {formatDisplay(startDate)}
          </div>
        </div>

        {/* CARTE FIN (Si mode plage de dates) */}
        {mode === 'range' ? (
          <div 
            onClick={() => {
              if (startDate && !endDate) {
                // Focus en attente
              }
            }}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              startDate && !endDate
                ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20 animate-pulse'
                : 'border-slate-200 dark:border-dark-700 bg-slate-50/60 dark:bg-dark-800/40 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5">
                <ArrowRight size={12} className="text-amber-600 dark:text-amber-400" />
                Date de fin (Départ / Clôture)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold">
                {totalDays > 1 ? `${totalDays} jours` : 'À choisir'}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white capitalize">
              {endDate ? formatDisplay(endDate) : (
                <span className="text-amber-600 dark:text-amber-400 italic font-normal text-xs">
                  👉 Cliquez sur le calendrier pour choisir la date de fin
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-dark-700/80 bg-slate-50/30 dark:bg-dark-800/20 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-dark-200">
                Session concentrée sur 1 journée
              </p>
              <p className="text-[11px] text-slate-400 dark:text-dark-400">
                Passez en « Plage de dates » pour un atelier sur 2 jours ou plus.
              </p>
            </div>
            <button
              type="button"
              onClick={setRangeMode}
              className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline px-2 py-1 rounded bg-primary-50 dark:bg-primary-900/30"
            >
              + Ajouter fin
            </button>
          </div>
        )}
      </div>

      {/* 3. CALENDRIER INTERACTIF (Navigation mois + Grille) */}
      <div className="border border-slate-200 dark:border-dark-700 rounded-xl p-3 bg-slate-50/40 dark:bg-dark-800/40">
        {/* En-tête mois avec chevrons */}
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-600 dark:text-dark-300 transition-colors"
            title="Mois précédent"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-center">
            <span className="text-sm font-bold text-slate-800 dark:text-white capitalize">
              {MOIS[currentMonth]} {currentYear}
            </span>
          </div>

          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-600 dark:text-dark-300 transition-colors"
            title="Mois suivant"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Noms des jours de la semaine */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {JOURS_SEMAINE.map(j => (
            <div key={j} className="text-[11px] font-bold text-slate-400 dark:text-dark-400 py-1">
              {j}
            </div>
          ))}
        </div>

        {/* Grille des cellules jours avec mise en valeur de la plage */}
        <div className="grid grid-cols-7 gap-y-1">
          {calendarCells.map((cell, idx) => {
            const dateStr = cell.dateStr;
            const isStart = dateStr === startDate;
            const isEnd = dateStr === endDate;
            const isToday = dateStr === todayStr;

            // Déterminer la plage active
            const effectiveEnd = endDate || (hoverDate && hoverDate > startDate ? hoverDate : null);
            const isInRange = Boolean(
              startDate && effectiveEnd && dateStr > startDate && dateStr < effectiveEnd
            );

            // Classes de plage Booking : ruban continu
            let rangeClass = '';
            if (isInRange) {
              rangeClass = 'bg-primary-100/80 dark:bg-primary-950/60 text-primary-900 dark:text-primary-100';
            } else if (isStart && (endDate || (hoverDate && hoverDate > startDate))) {
              rangeClass = 'bg-gradient-to-r from-transparent to-primary-100/80 dark:to-primary-950/60';
            } else if (isEnd && startDate) {
              rangeClass = 'bg-gradient-to-l from-transparent to-primary-100/80 dark:to-primary-950/60';
            }

            return (
              <div 
                key={`${dateStr}-${idx}`}
                className={`relative flex items-center justify-center py-0.5 ${rangeClass}`}
                onMouseEnter={() => {
                  if (mode === 'range' && startDate && !endDate) {
                    setHoverDate(dateStr);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => handleDayClick(dateStr)}
                  className={`w-8 h-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all relative z-10 ${
                    isStart || isEnd
                      ? 'bg-primary-600 text-white font-bold shadow-md shadow-primary-600/30 scale-105'
                      : isInRange
                      ? 'font-bold text-primary-700 dark:text-primary-300 hover:bg-primary-200/70 dark:hover:bg-primary-900/60'
                      : cell.isCurrentMonth
                      ? 'text-slate-800 dark:text-dark-200 hover:bg-slate-200/70 dark:hover:bg-dark-700'
                      : 'text-slate-300 dark:text-dark-600 hover:text-slate-600'
                  } ${isToday && !isStart && !isEnd ? 'border border-primary-400 text-primary-600 dark:text-primary-400 font-bold' : ''}`}
                >
                  {cell.day}
                  {isToday && !isStart && !isEnd && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary-500" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Barre de synthèse Booking : Durée totale et dates retenues */}
      <div className="flex items-center justify-between bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200/70 dark:border-primary-900/50 rounded-xl px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary-600 text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
            {totalDays}j
          </div>
          <div>
            <span className="font-bold text-slate-800 dark:text-white">
              {totalDays === 1 ? "Atelier d'une journée :" : `Atelier sur ${totalDays} jours :`}
            </span>{' '}
            <span className="text-primary-700 dark:text-primary-300 font-medium">
              {totalDays === 1 ? (
                formatDisplay(startDate)
              ) : (
                <>du <strong>{formatDisplay(startDate)}</strong> au <strong>{formatDisplay(endDate)}</strong></>
              )}
            </span>
          </div>
        </div>

        {/* Bouton de réinitialisation */}
        <button
          type="button"
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            onChange({ startDate: today, endDate: '' });
            setMode('single');
          }}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded hover:bg-primary-100/50 dark:hover:bg-primary-900/30 transition-colors"
          title="Réinitialiser à aujourd'hui"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}
