import React, { useState, useEffect } from 'react';
import { X, Utensils, Save } from 'lucide-react';
import { MenuDay, MenuDayKey } from '../firebase';

interface EditMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDay: MenuDayKey;
  menuData: Record<MenuDayKey, MenuDay>;
  onSaveDay: (dayKey: MenuDayKey, updated: { morning: string; lunch: string; afternoon: string }) => Promise<void>;
}

export const EditMenuModal: React.FC<EditMenuModalProps> = ({
  isOpen,
  onClose,
  activeDay,
  menuData,
  onSaveDay,
}) => {
  const [selectedDay, setSelectedDay] = useState<MenuDayKey>(activeDay);
  const [morning, setMorning] = useState('');
  const [lunch, setLunch] = useState('');
  const [afternoon, setAfternoon] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedDay(activeDay);
    }
  }, [isOpen, activeDay]);

  useEffect(() => {
    const day = menuData[selectedDay];
    if (day) {
      setMorning(day.morning);
      setLunch(day.lunch);
      setAfternoon(day.afternoon);
    }
  }, [selectedDay, menuData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveDay(selectedDay, {
        morning: morning.trim(),
        lunch: lunch.trim(),
        afternoon: afternoon.trim(),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-card relative my-8">
        <button
          onClick={onClose}
          aria-label="Fechar edição do cardápio"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-crimson-50 text-crimson-700 border border-crimson-200 text-xs font-bold mb-1">
            <Utensils className="w-3.5 h-3.5 text-crimson-600" /> Equipe Pedagógica • Cardápio Escolar
          </span>
          <h3 className="font-display font-extrabold text-xl sm:text-2xl text-navy-900">
            Editar Cardápio da Semana
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Dia da Semana
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value as MenuDayKey)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-crimson-600 focus:outline-none"
            >
              {(Object.keys(menuData) as MenuDayKey[]).map((key) => (
                <option key={key} value={key}>
                  {menuData[key].dayFull}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Merenda da Manhã (09h30)
            </label>
            <textarea
              rows={2}
              required
              minLength={2}
              maxLength={300}
              value={morning}
              onChange={(e) => setMorning(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Almoço Escolar (12h00)
            </label>
            <textarea
              rows={2}
              required
              minLength={2}
              maxLength={300}
              value={lunch}
              onChange={(e) => setLunch(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Merenda da Tarde (15h30)
            </label>
            <textarea
              rows={2}
              required
              minLength={2}
              maxLength={300}
              value={afternoon}
              onChange={(e) => setAfternoon(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 disabled:opacity-60 text-white font-bold text-sm shadow-md transition"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Atualizar Cardápio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
