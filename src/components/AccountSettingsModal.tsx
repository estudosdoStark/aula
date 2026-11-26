import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  ShieldCheck,
  GraduationCap,
  Save,
  LogOut,
  User,
  Lock,
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  db,
  FACULTY_ACCESS_CODE,
  STUDENT_CLASSES,
  StudentClassOption,
  UserProfile,
  OperationType,
  handleFirestoreError,
} from '../firebase';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdated: (updated: UserProfile) => void;
  onLogout: () => void;
  showToast: (message: string, type?: 'info' | 'success') => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdated,
  onLogout,
  showToast,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [facultyRole, setFacultyRole] = useState<'professor' | 'equipe_pedagogica'>('professor');
  const [studentClass, setStudentClass] = useState<StudentClassOption>('6º Ano');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName);
      setFacultyRole(
        userProfile.facultyRole === 'equipe_pedagogica' ? 'equipe_pedagogica' : 'professor'
      );
      setStudentClass(
        userProfile.studentClass !== 'none' ? userProfile.studentClass : '6º Ano'
      );
    }
  }, [userProfile, isOpen]);

  if (!isOpen || !userProfile) return null;

  const isDocente = userProfile.userType === 'docente';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      showToast('O nome deve ter pelo menos 2 caracteres.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile: UserProfile = {
        ...userProfile,
        displayName: trimmedName.slice(0, 100),
        facultyRole: isDocente ? facultyRole : 'none',
        studentClass: isDocente ? 'none' : studentClass,
      };

      const updatePayload: Record<string, unknown> = {
        displayName: updatedProfile.displayName,
        userType: updatedProfile.userType,
        facultyRole: updatedProfile.facultyRole,
        studentClass: updatedProfile.studentClass,
        updatedAt: serverTimestamp(),
      };
      if (isDocente) {
        updatePayload.facultyAccessCode = FACULTY_ACCESS_CODE;
      }

      try {
        await updateDoc(doc(db, 'users', userProfile.uid), updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
      }

      onProfileUpdated(updatedProfile);
      onClose();
      showToast('Configurações de login atualizadas com sucesso!', 'success');
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
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-card relative my-8">
        <button
          onClick={onClose}
          aria-label="Fechar configurações"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-navy-50 text-navy-900 border border-navy-200 text-xs font-bold mb-1">
            <Settings className="w-3.5 h-3.5 text-crimson-600" /> Configurações de Login
          </span>
          <h3 className="font-display font-extrabold text-xl sm:text-2xl text-navy-900">
            Perfil e Permissões
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{userProfile.email}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nome de Exibição
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
              />
            </div>
          </div>

          {isDocente ? (
            <div className="p-4 rounded-2xl bg-crimson-50/60 border border-crimson-200 space-y-3">
              <div className="flex items-center gap-2 text-navy-900">
                <ShieldCheck className="w-4 h-4 text-crimson-600" />
                <span className="text-xs font-extrabold uppercase">
                  Corpo Docente (Administrador) — Nível de Edição
                </span>
              </div>

              <div className="space-y-2">
                <label className="block cursor-pointer">
                  <input
                    type="radio"
                    name="settingsFacultyRole"
                    value="professor"
                    checked={facultyRole === 'professor'}
                    onChange={() => setFacultyRole('professor')}
                    className="peer sr-only"
                  />
                  <div className="p-3 rounded-xl border border-slate-200 bg-white peer-checked:bg-navy-900 peer-checked:text-white peer-checked:border-navy-900 transition">
                    <span className="block text-xs font-extrabold">Professor(a)</span>
                    <span className="block text-[11px] opacity-85 mt-0.5">
                      Pode publicar, editar e excluir apenas os avisos das turmas.
                    </span>
                  </div>
                </label>

                <label className="block cursor-pointer">
                  <input
                    type="radio"
                    name="settingsFacultyRole"
                    value="equipe_pedagogica"
                    checked={facultyRole === 'equipe_pedagogica'}
                    onChange={() => setFacultyRole('equipe_pedagogica')}
                    className="peer sr-only"
                  />
                  <div className="p-3 rounded-xl border border-slate-200 bg-white peer-checked:bg-crimson-600 peer-checked:text-white peer-checked:border-crimson-600 transition">
                    <span className="block text-xs font-extrabold">Equipe Pedagógica</span>
                    <span className="block text-[11px] opacity-90 mt-0.5">
                      Administrador geral: edita todas as informações do site (cardápio, aviso urgente, eventos e turmas).
                    </span>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-navy-50/80 border border-navy-200 space-y-3">
              <div className="flex items-center gap-2 text-navy-900">
                <GraduationCap className="w-4 h-4 text-crimson-600" />
                <span className="text-xs font-extrabold uppercase">
                  Conta de Aluno — Turma Cadastrada
                </span>
              </div>

              <div>
                <select
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value as StudentClassOption)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                >
                  {STUDENT_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                <Lock className="w-3.5 h-3.5 text-navy-700 shrink-0" />
                <span>
                  Permissão atual: <strong>Somente visualização</strong> do conteúdo do site.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2.5 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-crimson-50 text-slate-700 hover:text-crimson-700 text-xs sm:text-sm font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white font-bold text-sm shadow-md transition"
            >
              <Save className="w-4 h-4 text-crimson-400" />
              {isSaving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
