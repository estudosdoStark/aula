/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Radio,
  ShieldCheck,
  QrCode,
  PlusCircle,
  Accessibility,
  Megaphone,
  Utensils,
  Info,
  CalendarDays,
  GraduationCap,
  Search,
  FolderOpen,
  Plus,
  Sparkles,
  Zap,
  HeartHandshake,
  Smartphone,
  X,
  Copy,
  FileText,
  Video,
  Mic,
  Image as ImageIcon,
  ShieldAlert,
  Send,
  Coffee,
  Soup,
  Apple,
  Play,
  Headphones,
  Award,
  Heart,
  ThumbsUp,
  CheckCircle2,
  Bell,
  LogIn,
  Settings,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  testConnection,
  BOOTSTRAPPED_ADMIN_EMAIL,
  CLASS_LIST,
  STUDENT_CLASSES,
  WEEKLY_MENU_INITIAL,
  INITIAL_MURAL_POSTS,
  INITIAL_URGENT_TICKER,
  MenuDay,
  MenuDayKey,
  MuralPost,
  StudentClassOption,
  UserProfile,
  OperationType,
  handleFirestoreError,
} from './firebase';
import { AuthModal } from './components/AuthModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { EditMenuModal } from './components/EditMenuModal';
import { EditUrgentBannerModal } from './components/EditUrgentBannerModal';

interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success';
  fading: boolean;
}

export default function App() {
  const [activeMenuDay, setActiveMenuDay] = useState<MenuDayKey>('Segunda');
  const [weeklyMenu, setWeeklyMenu] = useState<Record<MenuDayKey, MenuDay>>(WEEKLY_MENU_INITIAL);
  const [firestorePosts, setFirestorePosts] = useState<MuralPost[]>([]);
  const [isDatabaseInitialized, setIsDatabaseInitialized] = useState<boolean>(false);
  const [hiddenSeedIds, setHiddenSeedIds] = useState<Record<string, boolean>>({});
  const [localLikes, setLocalLikes] = useState<Record<string, boolean>>({});

  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('Todas as Turmas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [urgentTicker, setUrgentTicker] = useState<string>(INITIAL_URGENT_TICKER);
  const [fontScale, setFontScale] = useState<number>(100);
  const [playingAudioIds, setPlayingAudioIds] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Autenticação e Perfil RBAC
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);

  // Modais
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [editingPost, setEditingPost] = useState<MuralPost | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState<boolean>(false);
  const [isEditBannerModalOpen, setIsEditBannerModalOpen] = useState<boolean>(false);

  // Campos do formulário de publicação / edição
  const [postAuthor, setPostAuthor] = useState<string>('');
  const [postRole, setPostRole] = useState<string>('Professor(a) / Pedagógico');
  const [postCategory, setPostCategory] = useState<MuralPost['category']>('Aviso de Turma');
  const [postClass, setPostClass] = useState<'Geral' | StudentClassOption>('6º Ano');
  const [postPriority, setPostPriority] = useState<'Normal' | 'Importante' | 'Urgente'>('Normal');
  const [mediaType, setMediaType] = useState<'Texto' | 'Vídeo' | 'Áudio/Podcast' | 'Foto'>('Texto');
  const [postTitle, setPostTitle] = useState<string>('');
  const [postDesc, setPostDesc] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const toastIdRef = useRef<number>(1);
  const hasSeededRef = useRef<boolean>(false);

  const isDocente = userProfile?.userType === 'docente';
  const isEquipePedagogica = isDocente && userProfile?.facultyRole === 'equipe_pedagogica';
  const isProfessor = isDocente && userProfile?.facultyRole === 'professor';
  const isAluno = userProfile?.userType === 'aluno';

  const showToast = useCallback((message: string, type: 'info' | 'success' = 'info') => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message, type, fading: false }]);

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, fading: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3500);
  }, []);

  // 1. Testar conexão Firestore na inicialização
  useEffect(() => {
    testConnection();
  }, []);

  // 2. Ajustar tamanho de fonte (acessibilidade)
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale}%`;
  }, [fontScale]);

  // 3. Listener de Autenticação + Perfil do Usuário
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!firebaseUser) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      const userRef = doc(db, 'users', firebaseUser.uid);
      unsubProfile = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const resolved: UserProfile = {
              uid: firebaseUser.uid,
              displayName: data.displayName || firebaseUser.displayName || 'Usuário',
              email: data.email || firebaseUser.email || '',
              userType: data.userType === 'docente' ? 'docente' : 'aluno',
              facultyRole:
                data.facultyRole === 'equipe_pedagogica' || data.facultyRole === 'professor'
                  ? data.facultyRole
                  : 'none',
              studentClass: data.studentClass || '6º Ano',
            };
            setUserProfile(resolved);
            if (resolved.userType === 'aluno' && resolved.studentClass !== 'none') {
              setSelectedClassFilter(resolved.studentClass);
            }
          } else if (
            firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL &&
            firebaseUser.emailVerified
          ) {
            setUserProfile({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Equipe Pedagógica',
              email: firebaseUser.email,
              userType: 'docente',
              facultyRole: 'equipe_pedagogica',
              studentClass: 'none',
            });
          } else {
            setUserProfile({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Aluno(a)',
              email: firebaseUser.email || '',
              userType: 'aluno',
              facultyRole: 'none',
              studentClass: '6º Ano',
            });
          }
          setAuthReady(true);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // 4. Listeners em Tempo Real para Conteúdo Público do Mural
  useEffect(() => {
    const postsQuery = query(collection(db, 'posts'), where('visibility', '==', 'public'));
    const unsubPosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const items: MuralPost[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            category: data.category,
            targetClass: data.targetClass,
            mediaType: data.mediaType,
            title: data.title,
            description: data.description,
            author: data.author,
            authorUid: data.authorUid,
            role: data.role,
            dateLabel: data.dateLabel || 'Atualizado',
            baseLikes: typeof data.baseLikes === 'number' ? data.baseLikes : 0,
            priority: data.priority || 'Normal',
            tag: data.tag,
            badgeColor: data.badgeColor,
            mediaDuration: data.mediaDuration,
            isFromFirestore: true,
          };
        });
        setFirestorePosts(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      }
    );

    const menuQuery = query(collection(db, 'weeklyMenu'), where('visibility', '==', 'public'));
    const unsubMenu = onSnapshot(
      menuQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          setWeeklyMenu((prev) => {
            const next = { ...prev };
            snapshot.docs.forEach((d) => {
              const data = d.data();
              const key = data.dayKey as MenuDayKey;
              if (key && next[key]) {
                next[key] = {
                  dayKey: key,
                  dayFull: data.dayFull || next[key].dayFull,
                  morning: data.morning || next[key].morning,
                  lunch: data.lunch || next[key].lunch,
                  afternoon: data.afternoon || next[key].afternoon,
                };
              }
            });
            return next;
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'weeklyMenu');
      }
    );

    const configQuery = query(collection(db, 'siteConfig'), where('visibility', '==', 'public'));
    const unsubConfig = onSnapshot(
      configQuery,
      (snapshot) => {
        const bannerDoc = snapshot.docs.find((d) => d.id === 'urgentBanner');
        if (bannerDoc) {
          setIsDatabaseInitialized(true);
          const data = bannerDoc.data();
          if (typeof data.text === 'string' && data.text.trim()) {
            setUrgentTicker(data.text);
          }
        } else {
          setIsDatabaseInitialized(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'siteConfig');
      }
    );

    return () => {
      unsubPosts();
      unsubMenu();
      unsubConfig();
    };
  }, []);

  // 5. Auto-seed inicial quando Equipe Pedagógica entra pela primeira vez e o banco está vazio
  useEffect(() => {
    if (!authReady || !isEquipePedagogica || !userProfile || isDatabaseInitialized || hasSeededRef.current) {
      return;
    }

    const seedInitialData = async () => {
      hasSeededRef.current = true;
      try {
        const batch = writeBatch(db);
        const existingIds = new Set(firestorePosts.map((p) => p.id));

        for (const seed of INITIAL_MURAL_POSTS) {
          if (!existingIds.has(seed.id)) {
            const payload: Record<string, unknown> = {
              id: seed.id,
              category: seed.category,
              targetClass: seed.targetClass,
              mediaType: seed.mediaType,
              title: seed.title,
              description: seed.description,
              author: seed.author,
              authorUid: userProfile.uid,
              role: seed.role,
              dateLabel: seed.dateLabel,
              baseLikes: seed.baseLikes,
              priority: seed.priority,
              visibility: 'public',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            if (seed.tag) payload.tag = seed.tag;
            if (seed.badgeColor) payload.badgeColor = seed.badgeColor;
            if (seed.mediaDuration) payload.mediaDuration = seed.mediaDuration;
            batch.set(doc(db, 'posts', seed.id), payload);
          }
        }

        (Object.keys(WEEKLY_MENU_INITIAL) as MenuDayKey[]).forEach((dayKey) => {
          const item = WEEKLY_MENU_INITIAL[dayKey];
          batch.set(doc(db, 'weeklyMenu', dayKey), {
            ...item,
            visibility: 'public',
            updatedBy: userProfile.uid,
            updatedAt: serverTimestamp(),
          });
        });

        batch.set(doc(db, 'siteConfig', 'urgentBanner'), {
          text: INITIAL_URGENT_TICKER,
          visibility: 'public',
          updatedBy: userProfile.uid,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
      } catch (err) {
        hasSeededRef.current = false;
        handleFirestoreError(err, OperationType.WRITE, 'posts/weeklyMenu/siteConfig');
      }
    };

    seedInitialData();
  }, [authReady, isEquipePedagogica, userProfile, isDatabaseInitialized, firestorePosts]);

  // Combinar posts do Firestore + fallback inicial (antes do primeiro seed)
  const muralPosts: MuralPost[] = React.useMemo(() => {
    if (isDatabaseInitialized) {
      return firestorePosts;
    }
    const firestoreIds = new Set(firestorePosts.map((p) => p.id));
    const remainingInitial = INITIAL_MURAL_POSTS.filter(
      (seed) => !firestoreIds.has(seed.id) && !hiddenSeedIds[seed.id]
    );
    return [...firestorePosts, ...remainingInitial];
  }, [firestorePosts, isDatabaseInitialized, hiddenSeedIds]);

  const adjustFontSize = (delta: number) => {
    const nextScale = delta === 0 ? 100 : Math.min(120, Math.max(90, fontScale + delta * 5));
    setFontScale(nextScale);
    showToast(`Tamanho do texto ajustado para ${nextScale}%`, 'info');
  };

  const toggleLike = (id: string) => {
    setLocalLikes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const simulateMediaPlay = (label: string) => {
    showToast(`Reproduzindo ${label}`, 'info');
  };

  const toggleAudioWave = (id: string, title: string) => {
    const isCurrentlyPlaying = !!playingAudioIds[id];
    setPlayingAudioIds((prev) => ({ ...prev, [id]: !isCurrentlyPlaying }));
    if (!isCurrentlyPlaying) {
      showToast(`Ouvindo podcast: ${title}`, 'info');
    }
  };

  const copyPortalLink = () => {
    const url = 'https://conexaolupion.moyseslupion-antonina.pr.gov.br';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    } else {
      const tempInput = document.createElement('input');
      tempInput.value = url;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    }
    showToast('Link do Conexão Lupion copiado para compartilhar com pais e alunos!', 'success');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setIsSettingsModalOpen(false);
    showToast('Você saiu da sua conta.', 'info');
  };

  const openPublishModal = (defaultCategory: MuralPost['category'] = 'Aviso de Turma') => {
    if (!isDocente) {
      setIsAuthModalOpen(true);
      showToast('Faça login como Corpo Docente para publicar ou editar no mural.', 'info');
      return;
    }

    setEditingPost(null);
    const resolvedCategory = isProfessor ? 'Aviso de Turma' : defaultCategory;
    setPostCategory(resolvedCategory);

    if (resolvedCategory === 'Geral da Escola' || resolvedCategory === 'Cardápio') {
      setPostClass('Geral');
    } else if (selectedClassFilter !== 'Todas as Turmas') {
      setPostClass(selectedClassFilter as StudentClassOption);
    } else {
      setPostClass('6º Ano');
    }

    setPostAuthor(userProfile?.displayName || '');
    setPostRole(
      isEquipePedagogica ? 'Equipe Pedagógica / Direção' : 'Professor(a) / Pedagógico'
    );
    setPostPriority('Normal');
    setMediaType('Texto');
    setPostTitle('');
    setPostDesc('');
    setIsPublishModalOpen(true);
  };

  const openEditPostModal = (post: MuralPost) => {
    if (!canEditPost(post)) {
      showToast('Você não tem permissão para editar esta publicação.', 'info');
      return;
    }
    setEditingPost(post);
    setPostAuthor(post.author);
    setPostRole(post.role);
    setPostCategory(post.category);
    setPostClass(post.targetClass);
    setPostPriority(post.priority);
    setMediaType(post.mediaType);
    setPostTitle(post.title);
    setPostDesc(post.description);
    setIsPublishModalOpen(true);
  };

  const handleCategoryChange = (category: MuralPost['category']) => {
    if (isProfessor) {
      setPostCategory('Aviso de Turma');
      return;
    }
    setPostCategory(category);
    if (category === 'Geral da Escola' || category === 'Cardápio') {
      setPostClass('Geral');
    } else if (category === 'Aviso de Turma' && postClass === 'Geral') {
      setPostClass('6º Ano');
    }
  };

  const canEditPost = (post: MuralPost): boolean => {
    if (!isDocente) return false;
    if (isEquipePedagogica) return true;
    if (isProfessor) {
      return post.category === 'Aviso de Turma' && post.targetClass !== 'Geral';
    }
    return false;
  };

  const handleDeletePost = async (post: MuralPost) => {
    if (!canEditPost(post)) {
      showToast('Sem permissão para excluir esta publicação.', 'info');
      return;
    }

    try {
      const postRef = doc(db, 'posts', post.id);
      const snap = await getDoc(postRef);
      if (snap.exists()) {
        await deleteDoc(postRef);
      } else {
        setHiddenSeedIds((prev) => ({ ...prev, [post.id]: true }));
      }
      showToast('Publicação removida do mural.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}`);
    }
  };

  const handlePublishSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userProfile || !isDocente) return;

    const author = postAuthor.trim().slice(0, 100);
    const title = postTitle.trim().slice(0, 160);
    const description = postDesc.trim().slice(0, 1200);
    const effectiveCategory: MuralPost['category'] = isProfessor ? 'Aviso de Turma' : postCategory;

    let targetClass: 'Geral' | StudentClassOption = postClass;
    if (effectiveCategory === 'Geral da Escola' || effectiveCategory === 'Cardápio') {
      targetClass = 'Geral';
    } else if (isProfessor && targetClass === 'Geral') {
      targetClass = '6º Ano';
    }

    const effectivePriority =
      isProfessor && postPriority === 'Urgente' ? 'Importante' : postPriority;

    const computedTag =
      effectivePriority === 'Urgente'
        ? 'Urgente'
        : effectiveCategory === 'Aviso de Turma'
          ? 'Novo Aviso'
          : effectiveCategory;

    const computedBadgeColor =
      effectivePriority !== 'Normal' ? 'bg-crimson-600 text-white' : 'bg-navy-100 text-navy-900';

    setIsPublishing(true);
    try {
      if (editingPost) {
        const postRef = doc(db, 'posts', editingPost.id);
        let snapExists = false;
        try {
          const snap = await getDoc(postRef);
          snapExists = snap.exists();
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `posts/${editingPost.id}`);
        }

        if (snapExists) {
          try {
            await updateDoc(postRef, {
              category: effectiveCategory,
              targetClass,
              mediaType,
              title,
              description,
              author,
              role: postRole.slice(0, 80),
              dateLabel: 'Editado agora',
              priority: effectivePriority,
              tag: computedTag.slice(0, 60),
              badgeColor: computedBadgeColor.slice(0, 120),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `posts/${editingPost.id}`);
          }
        } else {
          // Upsert seed post directly when editing before initial batch seed
          try {
            await setDoc(postRef, {
              id: editingPost.id,
              category: effectiveCategory,
              targetClass,
              mediaType,
              title,
              description,
              author,
              authorUid: userProfile.uid,
              role: postRole.slice(0, 80),
              dateLabel: 'Editado agora',
              baseLikes: editingPost.baseLikes || 0,
              priority: effectivePriority,
              tag: computedTag.slice(0, 60),
              badgeColor: computedBadgeColor.slice(0, 120),
              visibility: 'public',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `posts/${editingPost.id}`);
          }
        }

        if (isEquipePedagogica && (targetClass === 'Geral' || effectivePriority === 'Urgente')) {
          await saveUrgentBannerText(`${title} — ${description}`.slice(0, 300));
        }
        showToast('Publicação atualizada com sucesso!', 'success');
      } else {
        const newId = `post_${Date.now()}`;
        try {
          await setDoc(doc(db, 'posts', newId), {
            id: newId,
            category: effectiveCategory,
            targetClass,
            mediaType,
            title,
            description,
            author,
            authorUid: userProfile.uid,
            role: postRole.slice(0, 80),
            dateLabel: 'Agora mesmo',
            baseLikes: 1,
            priority: effectivePriority,
            tag: computedTag.slice(0, 60),
            badgeColor: computedBadgeColor.slice(0, 120),
            visibility: 'public',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `posts/${newId}`);
        }

        if (isEquipePedagogica && (targetClass === 'Geral' || effectivePriority === 'Urgente')) {
          await saveUrgentBannerText(`${title} — ${description}`.slice(0, 300));
        }

        if (targetClass !== 'Geral') {
          setSelectedClassFilter(targetClass);
        }

        showToast('Publicado no Conexão Lupion com sucesso!', 'success');
      }

      setEditingPost(null);
      setIsPublishModalOpen(false);
    } finally {
      setIsPublishing(false);
    }
  };

  const saveMenuDay = async (
    dayKey: MenuDayKey,
    updated: { morning: string; lunch: string; afternoon: string }
  ) => {
    if (!userProfile || !isEquipePedagogica) return;
    const dayRef = doc(db, 'weeklyMenu', dayKey);
    const dayFull = weeklyMenu[dayKey].dayFull;

    try {
      const snap = await getDoc(dayRef);
      if (snap.exists()) {
        await updateDoc(dayRef, {
          morning: updated.morning.slice(0, 300),
          lunch: updated.lunch.slice(0, 300),
          afternoon: updated.afternoon.slice(0, 300),
          updatedBy: userProfile.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(dayRef, {
          dayKey,
          dayFull,
          morning: updated.morning.slice(0, 300),
          lunch: updated.lunch.slice(0, 300),
          afternoon: updated.afternoon.slice(0, 300),
          visibility: 'public',
          updatedBy: userProfile.uid,
          updatedAt: serverTimestamp(),
        });
      }
      showToast(`Cardápio de ${dayFull} atualizado!`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `weeklyMenu/${dayKey}`);
    }
  };

  const saveUrgentBannerText = async (newText: string) => {
    if (!userProfile || !isEquipePedagogica) return;
    const bannerRef = doc(db, 'siteConfig', 'urgentBanner');
    const cleanText = newText.trim().slice(0, 300);

    try {
      if (isDatabaseInitialized) {
        await updateDoc(bannerRef, {
          text: cleanText,
          updatedBy: userProfile.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(bannerRef, {
          text: cleanText,
          visibility: 'public',
          updatedBy: userProfile.uid,
          updatedAt: serverTimestamp(),
        });
      }
      setUrgentTicker(cleanText);
      showToast('Aviso urgente atualizado com sucesso!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'siteConfig/urgentBanner');
    }
  };

  const renderMediaPreview = (post: MuralPost) => {
    if (post.mediaType === 'Vídeo') {
      return (
        <div
          onClick={() => simulateMediaPlay(`Vídeo: ${post.title}`)}
          className="mt-3 rounded-2xl bg-gradient-to-br from-navy-950 to-navy-800 p-4 text-white relative overflow-hidden cursor-pointer group border border-navy-700"
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-crimson-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-crimson-300 block">Vídeo Interativo</span>
                <span className="text-[11px] text-navy-200">
                  Clique para reproduzir • {post.mediaDuration || '02:00'}
                </span>
              </div>
            </div>
            <Video className="w-5 h-5 text-navy-300" />
          </div>
        </div>
      );
    }

    if (post.mediaType === 'Áudio/Podcast') {
      const isPlaying = !!playingAudioIds[post.id];
      return (
        <div
          onClick={() => toggleAudioWave(post.id, post.title)}
          className="mt-3 rounded-2xl bg-navy-50 border border-navy-200 p-3.5 cursor-pointer hover:bg-navy-100/70 transition group"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="w-9 h-9 rounded-full bg-crimson-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-navy-900 mb-1">
                <span>Podcast Estudantil</span>
                <span className="text-crimson-600">{post.mediaDuration || '03:15'}</span>
              </div>
              <div className="flex items-center gap-1 h-5">
                <span className={`wave-bar w-1 bg-crimson-600 rounded-full h-2 ${isPlaying ? 'playing' : ''}`} />
                <span className={`wave-bar w-1 bg-navy-800 rounded-full h-4 ${isPlaying ? 'playing' : ''}`} />
                <span className={`wave-bar w-1 bg-crimson-500 rounded-full h-2.5 ${isPlaying ? 'playing' : ''}`} />
                <span className={`wave-bar w-1 bg-navy-900 rounded-full h-3.5 ${isPlaying ? 'playing' : ''}`} />
                <span className={`wave-bar w-1 bg-crimson-600 rounded-full h-2 ${isPlaying ? 'playing' : ''}`} />
                <span className={`wave-bar w-1 bg-navy-800 rounded-full h-4 ${isPlaying ? 'playing' : ''}`} />
                <span className={`wave-bar w-1 bg-crimson-500 rounded-full h-3 ${isPlaying ? 'playing' : ''}`} />
                <span className={`wave-bar w-1 bg-navy-900 rounded-full h-2 ${isPlaying ? 'playing' : ''}`} />
                <span className="text-[10px] text-navy-800 font-bold ml-2 status-label">
                  {isPlaying ? 'Reproduzindo...' : 'Ouvir agora'}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (post.mediaType === 'Foto') {
      return (
        <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative">
          <img
            src="https://placehold.co/600x260/0B1D3A/ffffff?text=Conexao+Lupion+•+Galeria+Digital"
            onError={(e) => {
              e.currentTarget.src =
                'https://placehold.co/600x260/132B52/ffffff?text=Registro+Escolar';
            }}
            alt="Registro visual do projeto"
            className="w-full h-32 object-cover"
          />
          <span className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-md bg-crimson-600 text-white text-[10px] font-bold shadow-sm">
            Registro Visual
          </span>
        </div>
      );
    }

    return null;
  };

  const generalPosts = muralPosts.filter(
    (p) =>
      p.targetClass === 'Geral' ||
      p.category === 'Evento' ||
      p.category === 'Geral da Escola' ||
      p.category === 'Cardápio'
  );

  const normalizedSearch = searchQuery.toLowerCase().trim();
  const filteredClassPosts = muralPosts.filter((post) => {
    if (post.targetClass === 'Geral') return false;
    const matchesClass =
      selectedClassFilter === 'Todas as Turmas' || post.targetClass === selectedClassFilter;
    const matchesSearch =
      !normalizedSearch ||
      post.title.toLowerCase().includes(normalizedSearch) ||
      post.description.toLowerCase().includes(normalizedSearch) ||
      post.targetClass.toLowerCase().includes(normalizedSearch) ||
      post.author.toLowerCase().includes(normalizedSearch);
    return matchesClass && matchesSearch;
  });

  const activeMenuData = weeklyMenu[activeMenuDay];

  const getRoleBadgeLabel = () => {
    if (!userProfile) return '';
    if (userProfile.userType === 'aluno') {
      return `Aluno • ${userProfile.studentClass}`;
    }
    if (userProfile.facultyRole === 'equipe_pedagogica') {
      return 'Admin • Equipe Pedagógica';
    }
    return 'Admin • Professor (Turmas)';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-crimson-600 selection:text-white">
      {/* Notificação Toast Flutuante */}
      <div
        id="toast-container"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={
              toast.fading
                ? { opacity: 0, transform: 'translateY(8px)', transition: 'all 0.3s ease' }
                : undefined
            }
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl border-l-4 shadow-xl text-xs sm:text-sm font-medium animate-card ${
              toast.type === 'success'
                ? 'bg-navy-950 text-white border-crimson-500'
                : 'bg-navy-900 text-white border-crimson-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-crimson-400 shrink-0" />
            ) : (
              <Bell className="w-4 h-4 text-crimson-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* CABEÇALHO INSTITUCIONAL */}
      <header className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white border-b-4 border-crimson-600 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-4 gap-4">
            {/* Identidade do Projeto e do Colégio */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-crimson-500 to-crimson-700 p-0.5 shadow-md shrink-0 flex items-center justify-center">
                <div className="w-full h-full bg-navy-900 rounded-[14px] flex items-center justify-center">
                  <Radio className="w-7 h-7 sm:w-8 sm:h-8 text-crimson-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-crimson-600/25 text-crimson-200 border border-crimson-400/40 rounded-full">
                    Ponto de Encontro Digital
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Toda a escola conectada em um só lugar
                  </span>
                </div>
                <h1 className="font-display font-extrabold text-lg sm:text-xl md:text-2xl tracking-tight text-white leading-tight mt-0.5">
                  Conexão Lupion{' '}
                  <span className="text-crimson-400 font-bold text-base sm:text-lg">
                    — O Mural Vivo da Nossa Escola
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-navy-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-crimson-400" />
                  Colégio Estadual Cívico-Militar Moyses Lupion • Antonina/PR
                </p>
              </div>
            </div>

            {/* Ações Rápidas & Sistema de Login */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-between lg:justify-end">
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-white border border-navy-200/30 text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95"
              >
                <QrCode className="w-4 h-4 text-crimson-400" />
                <span>QR Code</span>
              </button>

              {!userProfile ? (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-crimson-600/30 active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Entrar / Login</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    title="Configurações de Login e Permissões"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-navy-800/90 hover:bg-navy-700 text-white border border-navy-200/30 text-xs font-semibold transition"
                  >
                    {isAluno ? (
                      <Eye className="w-4 h-4 text-emerald-300 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-crimson-400 shrink-0" />
                    )}
                    <span className="truncate max-w-[170px] sm:max-w-none">
                      {getRoleBadgeLabel()}
                    </span>
                    <Settings className="w-3.5 h-3.5 text-navy-200 shrink-0" />
                  </button>

                  {isDocente && (
                    <button
                      onClick={() => openPublishModal('Aviso de Turma')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-crimson-600/30 active:scale-95"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Publicar no Mural</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* BANNER DE AVISO URGENTE & ACESSIBILIDADE */}
      <div className="bg-crimson-50 border-b border-crimson-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-navy-950 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-crimson-600 text-white font-bold text-[11px] uppercase tracking-wide shrink-0">
              Aviso Urgente
            </span>
            <p id="urgent-ticker" className="font-medium truncate">
              {urgentTicker}
            </p>
            {isEquipePedagogica && (
              <button
                onClick={() => setIsEditBannerModalOpen(true)}
                title="Editar aviso urgente (Equipe Pedagógica)"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-crimson-300 text-crimson-700 hover:bg-crimson-100 text-[11px] font-bold shrink-0 transition"
              >
                <Pencil className="w-3 h-3" /> Editar
              </button>
            )}
          </div>

          {/* Controle de Tamanho de Fonte (Acessibilidade) */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-navy-800 text-xs font-medium flex items-center gap-1">
              <Accessibility className="w-3.5 h-3.5 text-crimson-600" /> Texto:
            </span>
            <button
              onClick={() => adjustFontSize(-1)}
              title="Diminuir fonte"
              className="px-2 py-0.5 rounded bg-white border border-slate-300 hover:bg-navy-50 text-navy-900 font-bold text-xs transition"
            >
              A-
            </button>
            <button
              onClick={() => adjustFontSize(0)}
              title="Fonte padrão"
              className="px-2 py-0.5 rounded bg-white border border-slate-300 hover:bg-navy-50 text-navy-900 font-bold text-xs transition"
            >
              A
            </button>
            <button
              onClick={() => adjustFontSize(1)}
              title="Aumentar fonte"
              className="px-2 py-0.5 rounded bg-white border border-slate-300 hover:bg-navy-50 text-navy-900 font-bold text-xs transition"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* SEÇÃO 1: PAINEL DE INFORMAÇÕES GERAIS DA ESCOLA */}
        <section aria-labelledby="heading-geral">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-crimson-600 font-bold text-xs uppercase tracking-wider mb-1">
                <Megaphone className="w-4 h-4" />
                Comunidade Escolar • Transparência Visual
              </div>
              <h2 id="heading-geral" className="font-display font-extrabold text-2xl sm:text-3xl text-navy-900">
                Informações Gerais da Escola
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Cardápio semanal, eventos institucionais e projetos em destaque para alunos e famílias.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* CARDÁPIO ESCOLAR DA SEMANA (5 Colunas no Desktop) */}
            <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
              <div className="bg-navy-900 text-white p-5 flex items-center justify-between border-b-2 border-crimson-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-crimson-600/25 text-crimson-300 border border-crimson-400/30 flex items-center justify-center">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg leading-tight">Cardápio Escolar</h3>
                    <p className="text-xs text-navy-200">Alimentação Saudável • SEED/PR</p>
                  </div>
                </div>
                <span className="text-xs bg-crimson-600 text-white px-2.5 py-1 rounded-full font-bold shadow-sm">
                  Semana Atual
                </span>
              </div>

              {/* Seletor de Dias da Semana */}
              <div
                className="p-3 bg-navy-50/80 border-b border-slate-200 flex gap-1.5 overflow-x-auto no-scrollbar"
                id="menu-days-tabs"
              >
                {(Object.keys(weeklyMenu) as MenuDayKey[]).map((day) => {
                  const isActive = day === activeMenuDay;
                  return (
                    <button
                      key={day}
                      onClick={() => setActiveMenuDay(day)}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-navy-900 text-white shadow-sm ring-2 ring-crimson-500'
                          : 'bg-white text-navy-900 hover:bg-crimson-50 hover:text-crimson-700'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Conteúdo do Cardápio do Dia */}
              <div id="menu-content" className="p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-display font-bold text-navy-900 text-base">
                    {activeMenuData.dayFull}
                  </span>
                  <span className="text-xs font-semibold text-crimson-600">3 refeições balanceadas</span>
                </div>

                <div key={activeMenuDay} className="space-y-3 animate-card">
                  <div className="p-3.5 rounded-2xl bg-navy-50/70 border border-navy-200/70 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Coffee className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-navy-800 block">
                        Merenda da Manhã (09h30)
                      </span>
                      <p className="text-sm text-slate-800 font-medium mt-0.5">{activeMenuData.morning}</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-crimson-50/60 border border-crimson-200/70 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-crimson-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Soup className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-crimson-700 block">
                        Almoço Escolar (12h00)
                      </span>
                      <p className="text-sm text-slate-800 font-medium mt-0.5">{activeMenuData.lunch}</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-navy-50/70 border border-navy-200/70 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Apple className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-navy-800 block">
                        Merenda da Tarde (15h30)
                      </span>
                      <p className="text-sm text-slate-800 font-medium mt-0.5">{activeMenuData.afternoon}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-navy-800" /> Sujeito a alterações sazonais
                </span>
                {isEquipePedagogica && (
                  <button
                    onClick={() => setIsEditMenuModalOpen(true)}
                    className="text-crimson-600 font-bold hover:underline"
                  >
                    + Atualizar prato
                  </button>
                )}
              </div>
            </div>

            {/* EVENTOS, PROJETOS & DESTAQUES MULTIMÍDIA (7 Colunas no Desktop) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-slate-200/90 shadow-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-crimson-600" />
                  <h3 className="font-display font-bold text-base sm:text-lg text-navy-900">
                    Eventos &amp; Protagonismo Estudantil
                  </h3>
                </div>
                <span
                  id="general-count-badge"
                  className="text-xs font-bold px-2.5 py-1 rounded-full bg-navy-100 text-navy-900"
                >
                  {generalPosts.length} publicações
                </span>
              </div>

              {/* Lista de Cards Gerais da Escola */}
              <div id="general-posts-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generalPosts.map((post) => {
                  const isStudent = post.role.includes('Aluno');
                  const isHighlighted = post.priority === 'Importante' || post.priority === 'Urgente';
                  const liked = !!localLikes[post.id];
                  const likesCount = post.baseLikes + (liked ? 1 : 0);

                  return (
                    <article
                      key={post.id}
                      className={`bg-white rounded-3xl p-5 border ${
                        isHighlighted
                          ? 'border-crimson-300 ring-1 ring-crimson-200/70'
                          : 'border-slate-200/90'
                      } shadow-sm hover:shadow-md transition-all flex flex-col justify-between animate-card`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              post.badgeColor || 'bg-navy-100 text-navy-900'
                            }`}
                          >
                            {post.category}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 font-medium">{post.dateLabel}</span>
                            {isEquipePedagogica && (
                              <>
                                <button
                                  onClick={() => openEditPostModal(post)}
                                  title="Editar publicação"
                                  className="p-1 rounded-lg text-slate-400 hover:text-navy-900 hover:bg-slate-100 transition"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePost(post)}
                                  title="Excluir publicação"
                                  className="p-1 rounded-lg text-slate-400 hover:text-crimson-600 hover:bg-crimson-50 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <h4 className="font-display font-bold text-base text-navy-900 leading-snug">
                          {post.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                          {post.description}
                        </p>

                        {renderMediaPreview(post)}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-navy-900 truncate">{post.author}</p>
                          {isStudent ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-crimson-600">
                              <Award className="w-3 h-3" /> Protagonismo Estudantil
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 block truncate">{post.role}</span>
                          )}
                        </div>

                        <button
                          onClick={() => toggleLike(post.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                            liked
                              ? 'bg-crimson-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-crimson-50 hover:text-crimson-600'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
                          <span>{likesCount}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* DIVISOR VISUAL */}
        <hr className="border-slate-200" />

        {/* SEÇÃO 2: ÁREA DE AVISOS ESPECÍFICOS POR TURMA */}
        <section aria-labelledby="heading-turmas" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-crimson-600 font-bold text-xs uppercase tracking-wider mb-1">
                <GraduationCap className="w-4 h-4" />
                Organização Pedagógica • Ensino Fundamental e Médio
              </div>
              <h2 id="heading-turmas" className="font-display font-extrabold text-2xl sm:text-3xl text-navy-900">
                Mural de Avisos por Turma
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Selecione a série para visualizar provas, entrega de trabalhos, passeios pedagógicos e recados direcionados.
              </p>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="class-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar prova, disciplina, aviso..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-crimson-600 focus:border-transparent shadow-sm"
              />
            </div>
          </div>

          {/* Barra de Filtros por Turma (Pills Responsivas) */}
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-sm">
            <div
              id="class-filter-buttons"
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
            >
              {CLASS_LIST.map((cls) => {
                const isSelected = cls === selectedClassFilter;
                const count =
                  cls === 'Todas as Turmas'
                    ? muralPosts.filter((p) => p.targetClass !== 'Geral').length
                    : muralPosts.filter((p) => p.targetClass === cls).length;

                return (
                  <button
                    key={cls}
                    onClick={() => setSelectedClassFilter(cls)}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-navy-900 text-white shadow-sm ring-2 ring-crimson-500'
                        : 'bg-slate-100 text-navy-900 hover:bg-crimson-50 hover:text-crimson-700'
                    }`}
                  >
                    <span>{cls}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        isSelected ? 'bg-crimson-600 text-white' : 'bg-white text-navy-900'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid de Avisos da Turma Selecionada */}
          {filteredClassPosts.length > 0 ? (
            <div id="class-posts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClassPosts.map((post) => {
                const isExam =
                  post.title.toLowerCase().includes('prova') ||
                  post.tag === 'Avaliação' ||
                  post.tag === 'Simulado' ||
                  post.priority === 'Importante' ||
                  post.priority === 'Urgente';
                const isStudent = post.role.includes('Aluno');
                const liked = !!localLikes[post.id];
                const likesCount = post.baseLikes + (liked ? 1 : 0);
                const editable = canEditPost(post);

                return (
                  <article
                    key={post.id}
                    className={`bg-white rounded-3xl p-5 border ${
                      isExam
                        ? 'border-crimson-400 ring-1 ring-crimson-200/70'
                        : 'border-slate-200/90'
                    } shadow-sm hover:shadow-md transition-all flex flex-col justify-between animate-card`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-3 py-1 rounded-xl bg-navy-900 text-white text-xs font-extrabold tracking-wide border-l-4 border-crimson-500">
                          {post.targetClass}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isExam
                                ? 'bg-crimson-600 text-white shadow-sm'
                                : 'bg-navy-50 text-navy-900 border border-navy-200'
                            }`}
                          >
                            {post.tag || post.mediaType}
                          </span>
                          {editable && (
                            <>
                              <button
                                onClick={() => openEditPostModal(post)}
                                title="Editar aviso da turma"
                                className="p-1 rounded-lg text-slate-400 hover:text-navy-900 hover:bg-slate-100 transition"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePost(post)}
                                title="Excluir aviso da turma"
                                className="p-1 rounded-lg text-slate-400 hover:text-crimson-600 hover:bg-crimson-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <h3 className="font-display font-bold text-base sm:text-lg text-navy-900 leading-snug">
                        {post.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                        {post.description}
                      </p>

                      {renderMediaPreview(post)}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-navy-900 truncate">{post.author}</p>
                        <p className="text-[11px] text-slate-500">
                          {isStudent && <span className="text-crimson-600 font-bold">★ Aluno(a) • </span>}
                          {post.dateLabel}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          liked
                            ? 'bg-crimson-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-navy-50 hover:text-navy-900'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{likesCount}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div
              id="empty-class-state"
              className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-crimson-50 text-crimson-600 flex items-center justify-center mx-auto mb-3">
                <FolderOpen className="w-7 h-7" />
              </div>
              <h3 className="font-display font-bold text-lg text-navy-900">
                Nenhum aviso encontrado para este filtro
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Ainda não há recados cadastrados com esses critérios.
                {isDocente
                  ? ' Você pode adicionar um novo aviso agora mesmo!'
                  : ' Aguarde atualizações do corpo docente.'}
              </p>
              {isDocente && (
                <button
                  onClick={() => openPublishModal('Aviso de Turma')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-crimson-600 text-white text-sm font-bold hover:bg-crimson-500 transition shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Adicionar Aviso para esta Turma
                </button>
              )}
            </div>
          )}
        </section>

        {/* SEÇÃO 3: POR QUE MURAL DIGITAL? */}
        <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 rounded-3xl p-6 sm:p-8 lg:p-10 text-white shadow-xl relative overflow-hidden border-t-4 border-crimson-600">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-crimson-600/15 blur-2xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-3">
              <span className="inline-block px-3 py-1 rounded-full bg-crimson-600/25 text-crimson-200 border border-crimson-400/30 text-xs font-bold uppercase tracking-wider">
                Conexão Lupion • Inovação Escolar
              </span>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl leading-tight">
                Do papel estático à conexão em tempo real
              </h2>
              <p className="text-sm text-navy-200 leading-relaxed">
                Diferente do mural físico tradicional — sujeito a danos, alcance limitado aos corredores e informações desatualizadas — o{' '}
                <strong className="text-white">Conexão Lupion</strong> integra alunos, professores e famílias de Antonina.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm hover:border-crimson-400/40 transition">
                <div className="w-9 h-9 rounded-xl bg-crimson-600/25 text-crimson-300 flex items-center justify-center mb-2.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">Protagonismo Estudantil</h3>
                <p className="text-xs text-navy-200 mt-1">
                  Alunos publicam podcasts, artes digitais e vídeos de pesquisas, deixando de ser apenas espectadores.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm hover:border-crimson-400/40 transition">
                <div className="w-9 h-9 rounded-xl bg-crimson-600/25 text-crimson-300 flex items-center justify-center mb-2.5">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">Atualização Instantânea</h3>
                <p className="text-xs text-navy-200 mt-1">
                  Mudanças de horários, provas e cardápios chegam simultaneamente a todos, sem recados perdidos.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm hover:border-crimson-400/40 transition">
                <div className="w-9 h-9 rounded-xl bg-navy-700/60 text-navy-100 border border-navy-200/20 flex items-center justify-center mb-2.5">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">Inclusão e Acessibilidade</h3>
                <p className="text-xs text-navy-200 mt-1">
                  Permite que estudantes tímidos expressem suas ideias digitalmente e facilita a leitura em qualquer tela.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm hover:border-crimson-400/40 transition">
                <div className="w-9 h-9 rounded-xl bg-navy-700/60 text-navy-100 border border-navy-200/20 flex items-center justify-center mb-2.5">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">Leve o Mural no Celular</h3>
                <p className="text-xs text-navy-200 mt-1">
                  Via QR Code nos corredores, pais e responsáveis acompanham projetos e datas importantes de casa.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* RODAPÉ COM CRÉDITOS DO PROJETO */}
      <footer className="bg-navy-950 text-navy-200 border-t-4 border-crimson-600 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-navy-800/80">
            <div>
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg mb-1">
                <Radio className="w-6 h-6 text-crimson-500" />
                <span>Conexão Lupion — O Mural Vivo da Nossa Escola</span>
              </div>
              <p className="text-xs font-semibold text-crimson-300 mb-2">
                Colégio Estadual Cívico-Militar Moyses Lupion • Antonina/PR
              </p>
              <p className="text-sm text-navy-200/80 max-w-md">
                Ponto de encontro digital desenvolvido para fortalecer o vínculo entre estudantes, equipe pedagógica e famílias. Toda a escola conectada em um só lugar.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-crimson-400 mb-3">
                Equipe Idealizadora do Projeto (Antonina/PR • 2026)
              </h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-navy-900 border border-navy-700 text-xs text-white">
                  Ana Carolina de Souza Silva
                </span>
                <span className="px-3 py-1 rounded-full bg-navy-900 border border-navy-700 text-xs text-white">
                  Brenda Aparecida de Paula Pereira
                </span>
                <span className="px-3 py-1 rounded-full bg-navy-900 border border-navy-700 text-xs text-white">
                  Everton Affonso Correia
                </span>
                <span className="px-3 py-1 rounded-full bg-navy-900 border border-navy-700 text-xs text-white">
                  Luís Henrique Costa Moreira Schinke
                </span>
                <span className="px-3 py-1 rounded-full bg-navy-900 border border-navy-700 text-xs text-white">
                  Renan do Rosário Correia
                </span>
                <span className="px-3 py-1 rounded-full bg-navy-900 border border-navy-700 text-xs text-white">
                  Safhyra Ferraz
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-navy-200/70">
            <p>© 2026 Conexão Lupion • Colégio Estadual Cívico-Militar Moyses Lupion — Antonina/PR.</p>
            <p>Desenvolvido com foco em acessibilidade, sustentabilidade e protagonismo estudantil.</p>
          </div>
        </div>
      </footer>

      {/* MODAL 1: QR CODE */}
      {isQrModalOpen && (
        <div
          id="qr-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsQrModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-sm"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-card relative">
            <button
              onClick={() => setIsQrModalOpen(false)}
              aria-label="Fechar modal"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-crimson-50 text-crimson-700 border border-crimson-200 text-xs font-bold">
                <Smartphone className="w-3.5 h-3.5" /> Ponto de Encontro Digital
              </div>
              <h3 className="font-display font-extrabold text-2xl text-navy-900">
                Acesse o Conexão Lupion
              </h3>
              <p className="text-sm text-slate-600">
                Aponte a câmera do celular para acessar <strong>O Mural Vivo da Nossa Escola</strong> em segundos e acompanhar avisos, provas e cardápio de casa.
              </p>

              <div className="my-5 p-5 bg-navy-50/70 rounded-2xl border-2 border-dashed border-crimson-300 inline-block">
                <svg
                  className="w-44 h-44 mx-auto text-navy-900"
                  viewBox="0 0 120 120"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="QR Code do Conexão Lupion"
                >
                  <path d="M10 10h30v30H10V10zm5 5v20h20V15H15zm5 5h10v10H20V20z" />
                  <path d="M80 10h30v30H80V10zm5 5v20h20V15H85zm5 5h10v10H90V20z" />
                  <path d="M10 80h30v30H10V80zm5 5v20h20V85H15zm5 5h10v10H20V90z" />
                  <rect x="48" y="10" width="6" height="6" />
                  <rect x="60" y="10" width="12" height="6" />
                  <rect x="48" y="22" width="12" height="6" />
                  <rect x="66" y="22" width="6" height="12" />
                  <rect x="48" y="34" width="6" height="6" />
                  <rect x="10" y="48" width="12" height="6" />
                  <rect x="28" y="48" width="18" height="6" />
                  <rect x="54" y="48" width="12" height="12" fill="#C8102E" />
                  <rect x="74" y="48" width="6" height="12" />
                  <rect x="86" y="48" width="24" height="6" />
                  <rect x="16" y="60" width="6" height="12" />
                  <rect x="30" y="60" width="12" height="6" />
                  <rect x="48" y="66" width="18" height="6" />
                  <rect x="74" y="66" width="12" height="6" />
                  <rect x="96" y="60" width="14" height="12" />
                  <rect x="48" y="80" width="6" height="18" />
                  <rect x="60" y="80" width="12" height="6" />
                  <rect x="80" y="80" width="12" height="12" />
                  <rect x="98" y="80" width="12" height="6" />
                  <rect x="60" y="92" width="6" height="18" />
                  <rect x="74" y="98" width="18" height="12" />
                  <rect x="98" y="92" width="12" height="18" />
                </svg>
                <span className="block text-[11px] font-mono font-semibold text-navy-900 mt-2">
                  conexaolupion.pr.gov.br
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  onClick={copyPortalLink}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold transition"
                >
                  <Copy className="w-4 h-4 text-crimson-400" />
                  <span>Copiar Link do Mural</span>
                </button>
                <button
                  onClick={() => setIsQrModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PUBLICAR / EDITAR NO MURAL (RESTRITO AO CORPO DOCENTE) */}
      {isPublishModalOpen && isDocente && (
        <div
          id="publish-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPublishModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-sm overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-card relative my-8">
            <button
              onClick={() => setIsPublishModalOpen(false)}
              aria-label="Fechar formulário"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-crimson-50 text-crimson-700 border border-crimson-200 text-xs font-bold mb-1">
                <Sparkles className="w-3.5 h-3.5 text-crimson-600" />
                {isEquipePedagogica
                  ? 'Equipe Pedagógica • Edição Total'
                  : 'Professor(a) • Somente Turmas'}
              </span>
              <h3 className="font-display font-extrabold text-xl sm:text-2xl text-navy-900">
                {editingPost ? 'Editar Publicação do Mural' : 'Novo Conteúdo no Mural Vivo'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                {isProfessor
                  ? 'Como Professor(a), você pode publicar e editar avisos direcionados às turmas.'
                  : 'Compartilhe comunicados, provas, eventos, podcasts ou atualizações gerais da escola.'}
              </p>
            </div>

            <form id="publish-form" onSubmit={handlePublishSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Seu Nome / Setor
                  </label>
                  <input
                    type="text"
                    id="post-author"
                    required
                    minLength={2}
                    maxLength={100}
                    value={postAuthor}
                    onChange={(e) => setPostAuthor(e.target.value)}
                    placeholder="Ex: Prof. Marcos / Grêmio"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Perfil de Publicação
                  </label>
                  <select
                    id="post-role"
                    value={postRole}
                    onChange={(e) => setPostRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                  >
                    <option value="Professor(a) / Pedagógico">Professor(a) / Pedagógico</option>
                    <option value="Equipe Pedagógica / Direção">Equipe Pedagógica / Direção</option>
                    <option value="Aluno(a) • Protagonismo Estudantil">
                      Aluno(a) • Protagonismo Estudantil
                    </option>
                    <option value="Nutrição Escolar">Nutrição Escolar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Categoria
                  </label>
                  <select
                    id="post-category"
                    value={postCategory}
                    disabled={isProfessor}
                    onChange={(e) =>
                      handleCategoryChange(e.target.value as MuralPost['category'])
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white disabled:bg-slate-100 focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                  >
                    <option value="Aviso de Turma">Aviso de Turma</option>
                    {isEquipePedagogica && (
                      <>
                        <option value="Evento">Evento / Projeto Escolar</option>
                        <option value="Geral da Escola">Geral da Escola</option>
                        <option value="Cardápio">Cardápio (Destaque Extra)</option>
                      </>
                    )}
                  </select>
                </div>

                <div id="target-class-wrapper">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Turma Alvo
                  </label>
                  <select
                    id="post-class"
                    value={postClass}
                    onChange={(e) =>
                      setPostClass(e.target.value as 'Geral' | StudentClassOption)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                  >
                    {STUDENT_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                    {isEquipePedagogica && <option value="Geral">Toda a Escola (Geral)</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nível de Destaque
                </label>
                <select
                  id="post-priority"
                  value={postPriority}
                  onChange={(e) =>
                    setPostPriority(e.target.value as 'Normal' | 'Importante' | 'Urgente')
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                >
                  <option value="Normal">Informativo Padrão</option>
                  <option value="Importante">Importante (Borda de Destaque Vermelha)</option>
                  {isEquipePedagogica && (
                    <option value="Urgente">Urgente (Fixar também na Faixa Superior)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Formato Multimídia
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="mediaType"
                      value="Texto"
                      checked={mediaType === 'Texto'}
                      onChange={() => setMediaType('Texto')}
                      className="peer sr-only"
                    />
                    <div className="p-2.5 rounded-xl border border-slate-200 text-center text-xs font-semibold text-slate-600 peer-checked:bg-navy-900 peer-checked:text-white peer-checked:border-navy-900 transition flex flex-col items-center gap-1">
                      <FileText className="w-4 h-4" /> Texto
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="mediaType"
                      value="Vídeo"
                      checked={mediaType === 'Vídeo'}
                      onChange={() => setMediaType('Vídeo')}
                      className="peer sr-only"
                    />
                    <div className="p-2.5 rounded-xl border border-slate-200 text-center text-xs font-semibold text-slate-600 peer-checked:bg-navy-900 peer-checked:text-white peer-checked:border-navy-900 transition flex flex-col items-center gap-1">
                      <Video className="w-4 h-4" /> Vídeo
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="mediaType"
                      value="Áudio/Podcast"
                      checked={mediaType === 'Áudio/Podcast'}
                      onChange={() => setMediaType('Áudio/Podcast')}
                      className="peer sr-only"
                    />
                    <div className="p-2.5 rounded-xl border border-slate-200 text-center text-xs font-semibold text-slate-600 peer-checked:bg-navy-900 peer-checked:text-white peer-checked:border-navy-900 transition flex flex-col items-center gap-1">
                      <Mic className="w-4 h-4" /> Podcast
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="mediaType"
                      value="Foto"
                      checked={mediaType === 'Foto'}
                      onChange={() => setMediaType('Foto')}
                      className="peer sr-only"
                    />
                    <div className="p-2.5 rounded-xl border border-slate-200 text-center text-xs font-semibold text-slate-600 peer-checked:bg-navy-900 peer-checked:text-white peer-checked:border-navy-900 transition flex flex-col items-center gap-1">
                      <ImageIcon className="w-4 h-4" /> Foto/Arte
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Título da Publicação
                </label>
                <input
                  type="text"
                  id="post-title"
                  required
                  minLength={2}
                  maxLength={160}
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Ex: Prova Bimestral de História ou Podcast da Turma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Descrição / Detalhes
                </label>
                <textarea
                  id="post-desc"
                  rows={3}
                  required
                  minLength={2}
                  maxLength={1200}
                  value={postDesc}
                  onChange={(e) => setPostDesc(e.target.value)}
                  placeholder="Escreva os detalhes, datas, materiais necessários ou resumo do projeto..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-crimson-600 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-navy-50 border border-navy-100 flex items-start gap-2.5 text-xs text-navy-900">
                <ShieldAlert className="w-4 h-4 text-crimson-600 shrink-0 mt-0.5" />
                <p>
                  {isProfessor
                    ? 'Seu perfil Professor(a) permite publicar e editar exclusivamente avisos das turmas.'
                    : 'Seu perfil Equipe Pedagógica possui acesso administrativo completo em todo o mural.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 disabled:opacity-60 text-white font-bold text-sm shadow-md transition"
                >
                  <Send className="w-4 h-4" />
                  {isPublishing
                    ? 'Salvando...'
                    : editingPost
                      ? 'Salvar Alterações'
                      : 'Publicar Agora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LOGIN / CADASTRO */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(profile) => {
          setUserProfile(profile);
          if (profile.userType === 'aluno' && profile.studentClass !== 'none') {
            setSelectedClassFilter(profile.studentClass);
          }
        }}
        showToast={showToast}
      />

      {/* MODAL 4: CONFIGURAÇÕES DE LOGIN E PERFIL */}
      <AccountSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userProfile={userProfile}
        onProfileUpdated={(updated) => {
          setUserProfile(updated);
          if (updated.userType === 'aluno' && updated.studentClass !== 'none') {
            setSelectedClassFilter(updated.studentClass);
          }
        }}
        onLogout={handleLogout}
        showToast={showToast}
      />

      {/* MODAL 5: EDITAR CARDÁPIO (EQUIPE PEDAGÓGICA) */}
      <EditMenuModal
        isOpen={isEditMenuModalOpen}
        onClose={() => setIsEditMenuModalOpen(false)}
        activeDay={activeMenuDay}
        menuData={weeklyMenu}
        onSaveDay={saveMenuDay}
      />

      {/* MODAL 6: EDITAR AVISO URGENTE (EQUIPE PEDAGÓGICA) */}
      <EditUrgentBannerModal
        isOpen={isEditBannerModalOpen}
        onClose={() => setIsEditBannerModalOpen(false)}
        currentText={urgentTicker}
        onSaveText={saveUrgentBannerText}
      />
    </div>
  );
}
