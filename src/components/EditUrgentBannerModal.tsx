import React, { useState, useEffect } from 'react';
import { X, Megaphone, Save } from 'lucide-react';

interface EditUrgentBannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  onSaveText: (newText: string) => Promise<void>;
}

export const EditUrgentBannerModal: React.FC<EditUrgentBannerModalProps> = ({
  isOpen,
  onClose,
  currentText,
  onSaveText,
}) => {
  const [text, setText] = useState(currentText);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setText(currentText);
    }
  }, [isOpen, currentText]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveText(text.trim());
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-card relative">
        <button
          onClick={onClose}
          aria-label="Fechar edição do aviso urgente"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-crimson-50 text-crimson-700 border border-crimson-200 text-xs font-bold mb-1">
            <Megaphone className="w-3.5 h-3.5 text-crimson-600" /> Equipe Pedagógica • Faixa Superior
          </span>
          <h3 className="font-display font-extrabold text-xl text-navy-900">
            Editar Aviso Urgente
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Texto do Aviso Urgente
            </label>
            <textarea
              rows={3}
              required
              minLength={2}
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5">
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
              {isSaving ? 'Salvando...' : 'Salvar Aviso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
