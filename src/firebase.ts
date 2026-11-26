import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const FACULTY_ACCESS_CODE = 'LUPION2026';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'everton.a.correiaestudos@gmail.com';
export const FIREBASE_CONSOLE_AUTH_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export type UserType = 'aluno' | 'docente';
export type FacultyRole = 'professor' | 'equipe_pedagogica' | 'none';
export type StudentClassOption =
  | '6º Ano'
  | '7º Ano'
  | '8º Ano'
  | '9º Ano'
  | '1º Ano EM'
  | '2º Ano EM'
  | '3º Ano EM';

export const STUDENT_CLASSES: StudentClassOption[] = [
  '6º Ano',
  '7º Ano',
  '8º Ano',
  '9º Ano',
  '1º Ano EM',
  '2º Ano EM',
  '3º Ano EM',
];

export const CLASS_LIST = ['Todas as Turmas', ...STUDENT_CLASSES];

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  userType: UserType;
  facultyRole: FacultyRole;
  studentClass: StudentClassOption | 'none';
  facultyAccessCode?: string;
}

export type MenuDayKey = 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta';

export interface MenuDay {
  dayKey: MenuDayKey;
  dayFull: string;
  morning: string;
  lunch: string;
  afternoon: string;
}

export const WEEKLY_MENU_INITIAL: Record<MenuDayKey, MenuDay> = {
  Segunda: {
    dayKey: 'Segunda',
    dayFull: 'Segunda-feira',
    morning: 'Vitamina de banana com aveia + Pão integral com queijo branco',
    lunch: 'Arroz, feijão carioca, iscas de frango acebolado, salada de alface e tomate + Mexerica',
    afternoon: 'Bolo simples de cenoura + Chá de camomila natural',
  },
  Terça: {
    dayKey: 'Terça',
    dayFull: 'Terça-feira',
    morning: 'Iogurte natural com granola + Biscoito caseiro de polvilho',
    lunch: 'Macarrão parafuso à bolonhesa, brócolis no vapor e salada de beterraba ralada + Banana',
    afternoon: 'Sanduíche natural de frango desfiado com cenoura + Suco de laranja',
  },
  Quarta: {
    dayKey: 'Quarta',
    dayFull: 'Quarta-feira',
    morning: 'Leite com cacau 100% + Pão francês com manteiga e maçã',
    lunch: 'Arroz integral, feijão preto, carne moída com batatas, couve refogada + Laranja',
    afternoon: 'Cuscuz de milho com ovo mexido + Suco de maracujá',
  },
  Quinta: {
    dayKey: 'Quinta',
    dayFull: 'Quinta-feira',
    morning: 'Suco natural de uva + Bolo de fubá cremoso',
    lunch: 'Risoto de frango com legumes (cenoura, ervilha e milho) + Salada verde e Maçã',
    afternoon: 'Pão de queijo assado + Vitamina de mamão',
  },
  Sexta: {
    dayKey: 'Sexta',
    dayFull: 'Sexta-feira',
    morning: 'Café com leite + Pão de batata assado e banana',
    lunch: 'Arroz, feijão, filé de peixe assado (pesca local de Antonina), purê de batatas + Salada',
    afternoon: 'Salada de frutas da estação com aveia em flocos',
  },
};

export interface MuralPost {
  id: string;
  category: 'Aviso de Turma' | 'Evento' | 'Geral da Escola' | 'Cardápio';
  targetClass: 'Geral' | StudentClassOption;
  mediaType: 'Texto' | 'Vídeo' | 'Áudio/Podcast' | 'Foto';
  title: string;
  description: string;
  author: string;
  authorUid: string;
  role: string;
  dateLabel: string;
  baseLikes: number;
  priority: 'Normal' | 'Importante' | 'Urgente';
  tag?: string;
  badgeColor?: string;
  mediaDuration?: string;
  isFromFirestore?: boolean;
}

export const INITIAL_URGENT_TICKER =
  'Conselho de Classe e Reunião de Pais neste sábado às 08h30 no Auditório Principal.';

export const INITIAL_MURAL_POSTS: MuralPost[] = [
  {
    id: '101',
    category: 'Evento',
    targetClass: 'Geral',
    mediaType: 'Vídeo',
    title: 'Feira de Ciências & Tecnologia 2026',
    description:
      'Confira a chamada em vídeo produzida pelos alunos! Inscrições abertas para projetos de robótica, sustentabilidade na Baía de Antonina e energias limpas.',
    author: 'Coordenação Pedagógica & Grêmio',
    authorUid: 'system_seed',
    role: 'Professor(a) / Pedagógico',
    dateLabel: 'Hoje, 08:30',
    baseLikes: 42,
    badgeColor: 'bg-crimson-50 text-crimson-700 border border-crimson-200',
    mediaDuration: '01:45',
    priority: 'Importante',
  },
  {
    id: '102',
    category: 'Geral da Escola',
    targetClass: 'Geral',
    mediaType: 'Áudio/Podcast',
    title: 'Rádio Moyses Lupion • Episódio #04: Cultura e História',
    description:
      'Ouça o podcast gravado pelos estudantes sobre o patrimônio histórico de Antonina e as atividades cívico-militares da semana.',
    author: 'Clube de Comunicação Estudantil',
    authorUid: 'system_seed',
    role: 'Aluno(a) • Protagonismo Estudantil',
    dateLabel: 'Ontem',
    baseLikes: 37,
    badgeColor: 'bg-navy-100 text-navy-900',
    mediaDuration: '04:12',
    priority: 'Normal',
  },
  {
    id: '103',
    category: 'Evento',
    targetClass: 'Geral',
    mediaType: 'Foto',
    title: 'Exposição de Artes Digitais no Pátio Central',
    description:
      'Os trabalhos de ilustração digital criados nas aulas de Arte já estão disponíveis no mural interativo para apreciação das famílias.',
    author: 'Profa. Helena • Artes',
    authorUid: 'system_seed',
    role: 'Professor(a) / Pedagógico',
    dateLabel: 'Há 2 dias',
    baseLikes: 51,
    badgeColor: 'bg-navy-100 text-navy-900',
    priority: 'Normal',
  },
  {
    id: '104',
    category: 'Geral da Escola',
    targetClass: 'Geral',
    mediaType: 'Texto',
    title: 'Reunião de Pais e Entrega de Boletins',
    description:
      'Convidamos todos os pais e responsáveis neste sábado, das 08h30 às 11h30. Transparência e acompanhamento pedagógico individualizado.',
    author: 'Direção C.E. Moyses Lupion',
    authorUid: 'system_seed',
    role: 'Direção / Secretaria',
    dateLabel: 'Atualizado agora',
    baseLikes: 29,
    badgeColor: 'bg-crimson-600 text-white',
    priority: 'Importante',
  },
  {
    id: '201',
    category: 'Aviso de Turma',
    targetClass: '6º Ano',
    mediaType: 'Texto',
    title: 'Prova de Matemática — Frações e Geometria Plana',
    description:
      'Atenção alunos do 6º Ano! Nossa avaliação bimestral será na próxima quinta-feira (2º e 3º horários). Trazer régua, lápis e borracha.',
    author: 'Prof. Ricardo • Matemática',
    authorUid: 'system_seed',
    role: 'Professor(a) / Pedagógico',
    dateLabel: 'Hoje, 09:15',
    baseLikes: 18,
    tag: 'Avaliação',
    priority: 'Importante',
  },
  {
    id: '202',
    category: 'Aviso de Turma',
    targetClass: '6º Ano',
    mediaType: 'Foto',
    title: 'Maquetes do Sistema Solar — Entrega e Exposição',
    description:
      'Lembrete para a turma do 6º Ano: entrega das maquetes de Ciências na sexta-feira. As melhores serão fotografadas para o portal dos pais!',
    author: 'Profa. Camila • Ciências',
    authorUid: 'system_seed',
    role: 'Professor(a) / Pedagógico',
    dateLabel: 'Ontem',
    baseLikes: 24,
    tag: 'Trabalho',
    priority: 'Normal',
  },
  {
    id: '203',
    category: 'Aviso de Turma',
    targetClass: '7º Ano',
    mediaType: 'Texto',
    title: 'Aula de Campo: Centro Histórico e Porto de Antonina',
    description:
      'Entregar a autorização assinada pelos responsáveis na secretaria até quarta-feira. Saída às 08h00 em frente ao colégio.',
    author: 'Prof. André • História e Geografia',
    authorUid: 'system_seed',
    role: 'Professor(a) / Pedagógico',
    dateLabel: 'Há 1 dia',
    baseLikes: 31,
    tag: 'Passeio Pedagógico',
    priority: 'Normal',
  },
  {
    id: '204',
    category: 'Aviso de Turma',
    targetClass: '8º Ano',
    mediaType: 'Áudio/Podcast',
    title: 'Resumo em Áudio: Revolução Industrial (Revisão)',
    description:
      'Gravei este áudio de 3 minutos com os principais tópicos que vão cair na avaliação de História da próxima semana.',
    author: 'Lucas M. • Monitoria 8º Ano',
    authorUid: 'system_seed',
    role: 'Aluno(a) • Protagonismo Estudantil',
    dateLabel: 'Há 2 dias',
    baseLikes: 22,
    tag: 'Revisão',
    mediaDuration: '03:05',
    priority: 'Normal',
  },
  {
    id: '205',
    category: 'Aviso de Turma',
    targetClass: '9º Ano',
    mediaType: 'Texto',
    title: 'Simulado Preparatório — Língua Portuguesa e Matemática',
    description:
      'Simulado diagnóstico para o 9º Ano na terça-feira pela manhã. O resultado ajuda a direcionar os grupos de estudo.',
    author: 'Equipe Pedagógica',
    authorUid: 'system_seed',
    role: 'Professor(a) / Pedagógico',
    dateLabel: 'Há 3 dias',
    baseLikes: 19,
    tag: 'Simulado',
    priority: 'Importante',
  },
  {
    id: '206',
    category: 'Aviso de Turma',
    targetClass: '1º Ano EM',
    mediaType: 'Vídeo',
    title: 'Experimento de Física: Cinemática na Prática',
    description:
      'Vídeo demonstrativo gravado no laboratório pelos alunos do 1º Ano do Ensino Médio. Assista antes do relatório de sexta!',
    author: 'Grupo Beta • 1º Ano EM',
    authorUid: 'system_seed',
    role: 'Aluno(a) • Protagonismo Estudantil',
    dateLabel: 'Hoje, 07:50',
    baseLikes: 35,
    tag: 'Projeto',
    mediaDuration: '02:20',
    priority: 'Normal',
  },
  {
    id: '207',
    category: 'Aviso de Turma',
    targetClass: '2º Ano EM',
    mediaType: 'Texto',
    title: 'Oficina de Redação Nota 1000 — Tema Atualidades',
    description:
      'Entrega da redação dissertativo-argumentativa até sexta-feira às 17h. Folha padrão disponível na biblioteca.',
    author: 'Profa. Fernanda • Língua Portuguesa',
    authorUid: 'system_seed',
    role: 'Professor(a) / Pedagógico',
    dateLabel: 'Ontem',
    baseLikes: 16,
    tag: 'Redação',
    priority: 'Normal',
  },
  {
    id: '208',
    category: 'Aviso de Turma',
    targetClass: '3º Ano EM',
    mediaType: 'Texto',
    title: 'Cronograma ENEM e Vestibulares Paraná (UFPR / UEPG)',
    description:
      'Atenção formandos! Confira as datas de isenção e aulão especial de revisão neste sábado no colégio.',
    author: 'Orientação Vocacional',
    authorUid: 'system_seed',
    role: 'Professor(a) / Pedagógico',
    dateLabel: 'Hoje, 10:00',
    baseLikes: 47,
    tag: 'Vestibular',
    priority: 'Importante',
  },
];
