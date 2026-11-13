import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  RotateCcw
} from 'lucide-react';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const JOURS_SEMAINE = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

/**
 * Calendrier compact avec sélection de plage directe
 * - 1er clic sur un jour = date de début (1 seule journée)
 * - 2ème clic sur un jour ultérieur = sélection de plage
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
      day: 'numeric',
      month: 'short'
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

  // Clic direct sur une date
  const handleDayClick = (dateStr) => {
    if (!startDate || (startDate && endDate)) {
      onChange({ startDate: dateStr, endDate: '' });
      setHoverDate(null);
      return;
    }

    if (startDate && !endDate) {
      if (dateStr > startDate) {
        onChange({ startDate, endDate: dateStr });
      } else if (dateStr === startDate) {
        onChange({ startDate, endDate: '' });
      } else {
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
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2">
      {/* 1. Mini barre récapitulative compacte */}
      <div className="flex items-center justify-between gap-1 bg-slate-50 dark:bg-dark-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-dark-700/60 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarIcon size={12} className="text-primary-600 dark:text-primary-400 shrink-0" />
          <span className="font-bold text-slate-800 dark:text-white capitalize text-[11px] sm:text-xs truncate">
            {formatDisplay(startDate)}
          </span>
          {endDate && endDate !== startDate && (
            <>
              <ArrowRight size={11} className="text-slate-400 shrink-0" />
              <span className="font-bold text-slate-800 dark:text-white capitalize text-[11px] sm:text-xs truncate">
                {formatDisplay(endDate)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className={`px-1.5 py-0.5 rounded font-black text-[10px] sm:text-[11px] ${
            totalDays > 1 
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/80 dark:border-amber-700/80' 
              : 'bg-primary-500/10 text-primary-700 dark:text-primary-300 border border-primary-200/80 dark:border-primary-800/80'
          }`}>
            {totalDays > 1 ? `${totalDays} jours` : '1 jour'}
          </span>

          {endDate && (
            <button
              type="button"
              onClick={() => onChange({ startDate, endDate: '' })}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-dark-700 transition-colors"
              title="Revenir à 1 seul jour"
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Calendrier interactif compact avec ruban de plage */}
      <div className="border border-slate-200 dark:border-dark-700 rounded-xl p-2 bg-slate-50/30 dark:bg-dark-800/30">
        {/* Navigation mois */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-600 dark:text-dark-300 transition-colors cursor-pointer"
            title="Mois précédent"
          >
            <ChevronLeft size={15} />
          </button>

          <span className="text-xs font-bold text-slate-800 dark:text-white capitalize">
            {MOIS[currentMonth]} {currentYear}
          </span>

          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-600 dark:text-dark-300 transition-colors cursor-pointer"
            title="Mois suivant"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Jours de la semaine abrégés */}
        <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
          {JOURS_SEMAINE.map(j => (
            <div key={j} className="text-[10px] font-bold text-slate-400 dark:text-dark-400 py-0.5">
              {j}
            </div>
          ))}
        </div>

        {/* Grille des cellules avec surbrillance continue de la plage */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {calendarCells.map((cell, idx) => {
            const dateStr = cell.dateStr;
            const isStart = dateStr === startDate;
            const isEnd = dateStr === endDate;
            const isToday = dateStr === todayStr;

            // Plage effective
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
                  className={`w-7 h-7 sm:w-7.5 sm:h-7.5 text-[11px] font-semibold rounded-lg flex items-center justify-center transition-all relative z-10 cursor-pointer ${
                    isStart || isEnd
                      ? 'bg-primary-600 text-white font-bold shadow-sm shadow-primary-600/30 scale-105'
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
    </div>
  );
}
