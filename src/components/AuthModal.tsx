import React, { useState } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  GraduationCap,
  ShieldCheck,
  Mail,
  Lock,
  User,
  KeyRound,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  auth,
  db,
  FACULTY_ACCESS_CODE,
  FIREBASE_CONSOLE_AUTH_URL,
  STUDENT_CLASSES,
  StudentClassOption,
  UserType,
  FacultyRole,
  UserProfile,
  OperationType,
  handleFirestoreError,
} from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: UserProfile, isNewAccount: boolean) => void;
  showToast: (message: string, type?: 'info' | 'success') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  showToast,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');

  // Configurações de perfil no cadastro
  const [userType, setUserType] = useState<UserType>('aluno');
  const [facultyRole, setFacultyRole] = useState<'professor' | 'equipe_pedagogica'>('professor');
  const [studentClass, setStudentClass] = useState<StudentClassOption>('6º Ano');
  const [facultyCode, setFacultyCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsConsoleEnable, setNeedsConsoleEnable] = useState(false);

  if (!isOpen) return null;

  const mapAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: string }).code)
        : '';

    if (code === 'auth/operation-not-allowed') {
      setNeedsConsoleEnable(true);
      return 'O provedor E-mail/Senha ainda não foi ativado no Firebase Console deste projeto.';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'E-mail ou senha incorretos. Verifique seus dados ou crie uma conta.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Este e-mail já está cadastrado. Alterne para a aba "Entrar".';
    }
    if (code === 'auth/weak-password') {
      return 'A senha deve conter no mínimo 6 caracteres.';
    }
    if (code === 'auth/invalid-email') {
      return 'Informe um endereço de e-mail válido.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
    }
    return err instanceof Error ? err.message : 'Erro ao realizar autenticação.';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNeedsConsoleEnable(false);
    setIsSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userRef = doc(db, 'users', cred.user.uid);
      let snap;
      try {
        snap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${cred.user.uid}`);
      }

      let profile: UserProfile;
      if (snap && snap.exists()) {
        const data = snap.data();
        profile = {
          uid: cred.user.uid,
          displayName: data.displayName || cred.user.displayName || 'Usuário',
          email: data.email || cred.user.email || email.trim(),
          userType: data.userType === 'docente' ? 'docente' : 'aluno',
          facultyRole:
            data.facultyRole === 'equipe_pedagogica' || data.facultyRole === 'professor'
              ? data.facultyRole
              : 'none',
          studentClass: data.studentClass || '6º Ano',
        };
      } else {
        // Fallback creation if user exists in Auth without Firestore profile
        const defaultName = cred.user.displayName || email.trim().split('@')[0] || 'Usuário';
        const fallbackProfile: UserProfile = {
          uid: cred.user.uid,
          displayName: defaultName.slice(0, 100),
          email: cred.user.email || email.trim(),
          userType: 'aluno',
          facultyRole: 'none',
          studentClass: '6º Ano',
        };
        try {
          await setDoc(userRef, {
            ...fallbackProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${cred.user.uid}`);
        }
        profile = fallbackProfile;
      }

      onAuthSuccess(profile, false);
      onClose();
      showToast(`Bem-vindo(a), ${profile.displayName}!`, 'success');
    } catch (err) {
      setErrorMessage(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNeedsConsoleEnable(false);

    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();
    const trimmedCode = facultyCode.trim();

    if (trimmedName.length < 2) {
      setErrorMessage('Informe seu nome completo (mínimo 2 caracteres).');
      return;
    }

    if (userType === 'docente' && trimmedCode !== FACULTY_ACCESS_CODE) {
      setErrorMessage(
        `Código institucional do Corpo Docente inválido. Utilize "${FACULTY_ACCESS_CODE}" para validar seu perfil administrativo.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(cred.user, { displayName: trimmedName.slice(0, 100) });

      const resolvedFacultyRole: FacultyRole = userType === 'docente' ? facultyRole : 'none';
      const resolvedStudentClass: StudentClassOption | 'none' =
        userType === 'aluno' ? studentClass : 'none';

      const newProfile: UserProfile = {
        uid: cred.user.uid,
        displayName: trimmedName.slice(0, 100),
        email: trimmedEmail.slice(0, 150),
        userType,
        facultyRole: resolvedFacultyRole,
        studentClass: resolvedStudentClass,
      };

      const userPayload: Record<string, unknown> = {
        ...newProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (userType === 'docente') {
        userPayload.facultyAccessCode = trimmedCode;
      }

      try {
        await setDoc(doc(db, 'users', cred.user.uid), userPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${cred.user.uid}`);
      }

      onAuthSuccess(newProfile, true);
      onClose();
      showToast('Conta criada e autenticada com sucesso!', 'success');
    } catch (err) {
      setErrorMessage(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
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
          aria-label="Fechar janela de login"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-crimson-50 text-crimson-700 border border-crimson-200 text-xs font-bold mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-crimson-600" /> Acesso ao Conexão Lupion
          </span>
          <h3 className="font-display font-extrabold text-xl sm:text-2xl text-navy-900">
            {mode === 'login' ? 'Entrar na sua Conta' : 'Criar Nova Conta'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            Login com e-mail e senha para Alunos e Corpo Docente (Administrador).
          </p>
        </div>

        {/* Seletor de Modo: Entrar / Criar Conta */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
              mode === 'login'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
              mode === 'register'
                ? 'bg-crimson-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Criar Conta
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-crimson-50 border border-crimson-200 text-crimson-800 text-xs space-y-2">
            <div className="flex items-start gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-crimson-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            {needsConsoleEnable && (
              <div className="pl-6 text-[11px] text-slate-700 space-y-1">
                <p>
                  Para habilitar o login por E-mail/Senha no Firebase Console: acesse{' '}
                  <strong>Authentication → Sign-in method → E-mail/senha</strong> e ative a opção.
                </p>
                <a
                  href={FIREBASE_CONSOLE_AUTH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-crimson-700 font-bold hover:underline"
                >
                  Abrir Provedores no Firebase Console <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {mode === 'register' && (
            <>
              {/* Tipo de Conta: Aluno vs Corpo Docente */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Tipo de Acesso
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setUserType('aluno')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${
                      userType === 'aluno'
                        ? 'bg-navy-900 text-white border-navy-900 ring-2 ring-crimson-500'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-navy-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <GraduationCap className="w-4 h-4 text-crimson-400" />
                      Aluno(a)
                    </div>
                    <span
                      className={`text-[11px] ${
                        userType === 'aluno' ? 'text-navy-200' : 'text-slate-500'
                      }`}
                    >
                      Somente visualização
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserType('docente')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${
                      userType === 'docente'
                        ? 'bg-navy-900 text-white border-navy-900 ring-2 ring-crimson-500'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-navy-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <ShieldCheck className="w-4 h-4 text-crimson-400" />
                      Corpo Docente
                    </div>
                    <span
                      className={`text-[11px] ${
                        userType === 'docente' ? 'text-navy-200' : 'text-slate-500'
                      }`}
                    >
                      Administrador
                    </span>
                  </button>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nome Completo
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
                    placeholder={
                      userType === 'aluno' ? 'Ex: Ana Clara Silva' : 'Ex: Prof. Marcos Oliveira'
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Configurações específicas do ALUNO */}
              {userType === 'aluno' && (
                <div className="p-3.5 rounded-2xl bg-navy-50/80 border border-navy-200 space-y-2">
                  <label className="block text-xs font-bold text-navy-900 uppercase">
                    Escolha sua Turma Cadastrada
                  </label>
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
                  <p className="text-[11px] text-slate-600">
                    Perfil de aluno permite apenas visualizar os conteúdos, avisos e cardápio do site.
                  </p>
                </div>
              )}

              {/* Configurações específicas do CORPO DOCENTE (Administrador) */}
              {userType === 'docente' && (
                <div className="p-4 rounded-2xl bg-crimson-50/60 border border-crimson-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-navy-900 uppercase mb-1.5">
                      Configurações de Acesso — Corpo Docente (Administrador)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="facultyRole"
                          value="professor"
                          checked={facultyRole === 'professor'}
                          onChange={() => setFacultyRole('professor')}
                          className="peer sr-only"
                        />
                        <div className="p-3 rounded-xl border border-slate-200 bg-white peer-checked:bg-navy-900 peer-checked:text-white peer-checked:border-navy-900 transition">
                          <span className="block text-xs font-extrabold">Professor(a)</span>
                          <span className="block text-[11px] opacity-80 mt-0.5">
                            Edita somente avisos das turmas
                          </span>
                        </div>
                      </label>

                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="facultyRole"
                          value="equipe_pedagogica"
                          checked={facultyRole === 'equipe_pedagogica'}
                          onChange={() => setFacultyRole('equipe_pedagogica')}
                          className="peer sr-only"
                        />
                        <div className="p-3 rounded-xl border border-slate-200 bg-white peer-checked:bg-crimson-600 peer-checked:text-white peer-checked:border-crimson-600 transition">
                          <span className="block text-xs font-extrabold">Equipe Pedagógica</span>
                          <span className="block text-[11px] opacity-85 mt-0.5">
                            Edita todas as informações do site
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-navy-900 uppercase mb-1">
                      Código Institucional do Corpo Docente
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        maxLength={32}
                        value={facultyCode}
                        onChange={(e) => setFacultyCode(e.target.value)}
                        placeholder="Digite o código de autorização docente"
                        className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-navy-800 mt-1">
                      Código institucional de validação: <strong className="font-mono">{FACULTY_ACCESS_CODE}</strong>
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* E-mail */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                maxLength={150}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@escola.pr.gov.br"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Mostrar ou ocultar senha"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 disabled:opacity-60 text-white font-bold text-sm shadow-md transition"
            >
              {mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  {isSubmitting ? 'Entrando...' : 'Entrar'}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? 'Criando Conta...' : 'Concluir Cadastro'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
