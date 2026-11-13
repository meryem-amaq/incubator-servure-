import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Calendrier avec sélection de plage épuré (Style Booking)
 * Interface légère sans boutons superflus :
 * - 1 clic sur un jour = session d'une journée
 * - 2ème clic sur un jour ultérieur = sélection de la plage (2 jours ou plus)
 */
export default function HotelDatePicker({
  startDate = '',
  endDate = '',
  onChange = () => {}
}) {
  const initialDateObj = startDate ? new Date(startDate) : new Date();
  const [currentMonth, setCurrentMonth] = useState(
    isNaN(initialDateObj.getTime()) ? new Date().getMonth() : initialDateObj.getMonth()
  );
  const [currentYear, setCurrentYear] = useState(
    isNaN(initialDateObj.getTime()) ? new Date().getFullYear() : initialDateObj.getFullYear()
  );

  // État de survol (hover) pour prévisualiser la plage
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
    if (!dStr) return '—';
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

  // Grille du mois (42 cellules : 6 semaines x 7 jours)
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const startOffset = (firstDayIndex + 6) % 7; // Lundi = 0
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells = [];

    // Jours du mois précédent
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

    // Jours du mois suivant
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

  // Clic direct sur une date (logique naturelle de plage Booking)
  const handleDayClick = (dateStr) => {
    // Si pas de début OU si la plage était déjà complète : recommence à partir de cette date
    if (!startDate || (startDate && endDate)) {
      onChange({ startDate: dateStr, endDate: '' });
      setHoverDate(null);
      return;
    }

    // Si on a déjà startDate et qu'on attend la date de fin :
    if (startDate && !endDate) {
      if (dateStr > startDate) {
        // Crée la plage (2 jours ou plus)
        onChange({ startDate, endDate: dateStr });
      } else if (dateStr === startDate) {
        // Clic sur la même date = confirme 1 seul jour
        onChange({ startDate, endDate: '' });
      } else {
        // Clic sur une date antérieure = devient la nouvelle date de début
        onChange({ startDate: dateStr, endDate: '' });
      }
      setHoverDate(null);
    }
  };

  // Aujourd'hui
  const todayStr = useMemo(() => {
    const now = new Date();
    return toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  return (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
      {/* 1. En-tête épuré : Date Début -> Date Fin + Durée */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-dark-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-dark-700/60">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Badge Début */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-dark-700 border border-slate-200 dark:border-dark-600 shadow-2xs">
            <CalendarIcon size={12} className="text-primary-600 dark:text-primary-400" />
            <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">
              {formatDisplay(startDate)}
            </span>
          </div>

          <ArrowRight size={13} className="text-slate-400" />

          {/* Badge Fin */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-dark-700 border border-slate-200 dark:border-dark-600 shadow-2xs">
            <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">
              {endDate ? formatDisplay(endDate) : 'Même jour (1 j)'}
            </span>
          </div>
        </div>

        {/* Badge Durée & Reset */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${
            totalDays > 1 
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700' 
              : 'bg-primary-500/10 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
          }`}>
            {totalDays > 1 ? `Plage : ${totalDays} jours` : '1 journée'}
          </span>

          {endDate && (
            <button
              type="button"
              onClick={() => onChange({ startDate, endDate: '' })}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-dark-700 transition-colors"
              title="Revenir à 1 seul jour"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Calendrier interactif avec ruban de plage */}
      <div className="border border-slate-200 dark:border-dark-700 rounded-xl p-2.5 sm:p-3 bg-slate-50/30 dark:bg-dark-800/30">
        {/* Navigation mois */}
        <div className="flex items-center justify-between mb-2.5 px-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-600 dark:text-dark-300 transition-colors"
            title="Mois précédent"
          >
            <ChevronLeft size={17} />
          </button>

          <span className="text-sm font-bold text-slate-800 dark:text-white capitalize">
            {MOIS[currentMonth]} {currentYear}
          </span>

          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-600 dark:text-dark-300 transition-colors"
            title="Mois suivant"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {JOURS_SEMAINE.map(j => (
            <div key={j} className="text-[11px] font-bold text-slate-400 dark:text-dark-400 py-0.5">
              {j}
            </div>
          ))}
        </div>

        {/* Grille des cellules avec surbrillance continue de la plage */}
        <div className="grid grid-cols-7 gap-y-1">
          {calendarCells.map((cell, idx) => {
            const dateStr = cell.dateStr;
            const isStart = dateStr === startDate;
            const isEnd = dateStr === endDate;
            const isToday = dateStr === todayStr;

            // Plage effective (prend en compte le hover si en cours de sélection)
            const effectiveEnd = endDate || (hoverDate && hoverDate > startDate ? hoverDate : null);
            const isInRange = Boolean(
              startDate && effectiveEnd && dateStr > startDate && dateStr < effectiveEnd
            );

            // Style ruban continu Booking
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
                  if (startDate && !endDate) {
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

      {/* 3. Petite légende discrète */}
      <p className="text-[11px] text-slate-400 dark:text-dark-400 text-center italic">
        💡 Cliquez sur une date de début, puis sur une date de fin pour créer une plage (ou une seule date pour 1 jour).
      </p>
    </div>
  );
}
