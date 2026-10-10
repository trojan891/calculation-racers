import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Database,
  Edit3,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  AdminAuditLogRecord,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  OperationType,
  PlayerProfile,
  QuestionCategory,
  QuestionDifficulty,
  QuestionItem,
  QuestionKeyItem,
  QuestionReportRecord,
  RaceResultRecord,
  RoomRecord,
  SUBCATEGORIES_BY_CATEGORY,
} from '../game/types';
import {
  adminDeleteQuestion,
  adminSaveQuestion,
  logAdminAction,
  seedStarterQuestionsToFirestore,
} from '../lib/gameService';
import { findCorrectOptionFromHash } from '../lib/seedQuestions';

interface AdminDashboardPageProps {
  isAdmin: boolean;
  adminUid: string;
  adminEmail: string;
  onExitAdmin: () => void;
}

type AdminTab =
  | 'overview'
  | 'questions'
  | 'current_affairs'
  | 'reports'
  | 'players'
  | 'races'
  | 'audit';

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  isAdmin,
  adminUid,
  adminEmail,
  onExitAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [results, setResults] = useState<RaceResultRecord[]>([]);
  const [reports, setReports] = useState<QuestionReportRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState<QuestionCategory | 'all'>('all');
  const [filterDiff, setFilterDiff] = useState<QuestionDifficulty | 'all'>('all');

  // Question Editor Modal State
  const [editingQuestion, setEditingQuestion] = useState<{
    id?: string;
    category: QuestionCategory;
    subcategory: string;
    difficulty: QuestionDifficulty;
    questionText: string;
    options: [string, string, string, string];
    correctOption: number;
    explanation: string;
    sourceUrl: string;
    publishedAt: string;
    verifiedAt: string;
    expiresAt: string;
    isActive: boolean;
  } | null>(null);

  // Destructive Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    requireReason?: boolean;
    onConfirm: (reason: string) => Promise<void>;
  } | null>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubQuestions = onSnapshot(
      collection(db, 'questions'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as QuestionItem);
        setQuestions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'questions')
    );

    const unsubPlayers = onSnapshot(
      collection(db, 'profiles'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as PlayerProfile);
        setPlayers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'profiles')
    );

    const unsubRooms = onSnapshot(
      query(collection(db, 'rooms'), where('isPublic', '==', true)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as RoomRecord);
        setRooms(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'rooms')
    );

    const unsubResults = onSnapshot(
      query(collection(db, 'race_results'), where('isPublic', '==', true)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as RaceResultRecord),
        }));
        list.sort((a, b) => b.completedAtMs - a.completedAtMs);
        setResults(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'race_results')
    );

    const unsubReports = onSnapshot(
      collection(db, 'question_reports'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as QuestionReportRecord);
        setReports(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'question_reports')
    );

    const unsubAudit = onSnapshot(
      collection(db, 'admin_audit_logs'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as AdminAuditLogRecord);
        setAuditLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'admin_audit_logs')
    );

    return () => {
      unsubQuestions();
      unsubPlayers();
      unsubRooms();
      unsubResults();
      unsubReports();
      unsubAudit();
    };
  }, [isAdmin]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (activeTab === 'current_affairs' && q.category !== 'current_affairs') {
        return false;
      }
      if (filterCat !== 'all' && q.category !== filterCat) return false;
      if (filterDiff !== 'all' && q.difficulty !== filterDiff) return false;
      if (
        searchQuery.trim() &&
        !q.questionText.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [questions, activeTab, filterCat, filterDiff, searchQuery]);

  if (!isAdmin) {
    const isLoggedOut = !adminUid;
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50">
          <ShieldAlert className="h-7 w-7 text-rose-600" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-900">
          {isLoggedOut ? 'Administrator Sign-In Required' : 'Access Denied'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isLoggedOut ? (
            <>
              Please sign in with the authorized administrator account to access{' '}
              <span className="font-mono font-bold text-slate-900">/admin</span>.
            </>
          ) : (
            <>
              Your account (<span className="font-semibold text-slate-800">{adminEmail}</span>) does not have administrator permissions for{' '}
              <span className="font-mono font-bold text-slate-900">/admin</span>.
            </>
          )}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onExitAdmin}
            className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handleOpenEditQuestion = async (q?: QuestionItem, defaultCat?: QuestionCategory) => {
    const cat = q?.category || defaultCat || 'math';
    const defaultSub = SUBCATEGORIES_BY_CATEGORY[cat]?.[0] || '';
    const today = new Date().toISOString().slice(0, 10);

    if (!q) {
      setEditingQuestion({
        category: cat,
        subcategory: defaultSub,
        difficulty: 'medium',
        questionText: '',
        options: ['', '', '', ''],
        correctOption: 0,
        explanation: '',
        sourceUrl: '',
        publishedAt: today,
        verifiedAt: today,
        expiresAt: '',
        isActive: true,
      });
      return;
    }

    let correctOption = findCorrectOptionFromHash(q.id, q.answerHash);
    let explanation = q.explanation || '';
    try {
      const keySnap = await getDoc(doc(db, 'question_keys', q.id));
      if (keySnap.exists()) {
        const keyData = keySnap.data() as QuestionKeyItem;
        correctOption = keyData.correctOption;
        explanation = keyData.explanation;
      }
    } catch {
      // use hash-resolved option
    }

    setEditingQuestion({
      id: q.id,
      category: q.category,
      subcategory: q.subcategory || defaultSub,
      difficulty: q.difficulty,
      questionText: q.questionText,
      options: [...q.options] as [string, string, string, string],
      correctOption,
      explanation,
      sourceUrl: q.sourceUrl || '',
      publishedAt: q.publishedAt || today,
      verifiedAt: q.verifiedAt || today,
      expiresAt: q.expiresAt || '',
      isActive: q.isActive,
    });
  };

  const handleSaveQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    await adminSaveQuestion(adminUid, adminEmail, editingQuestion);
    setEditingQuestion(null);
    setStatusBanner('Question saved and answer key updated.');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const added = await seedStarterQuestionsToFirestore();
      await logAdminAction(
        adminUid,
        adminEmail,
        'Seeded Starter Question Bank',
        'system',
        'seed_questions',
        `Synchronized ${added} new starter questions into Firestore.`
      );
      setStatusBanner(`Starter question bank synced (${added} new records added).`);
      setTimeout(() => setStatusBanner(null), 3500);
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleQuestionActive = async (q: QuestionItem) => {
    const correctOption = findCorrectOptionFromHash(q.id, q.answerHash);
    await adminSaveQuestion(adminUid, adminEmail, {
      id: q.id,
      category: q.category,
      subcategory: q.subcategory,
      difficulty: q.difficulty,
      questionText: q.questionText,
      options: q.options,
      correctOption,
      explanation: q.explanation || '',
      sourceUrl: q.sourceUrl || '',
      publishedAt: q.publishedAt || '',
      verifiedAt: q.verifiedAt || '',
      expiresAt: q.expiresAt,
      isActive: !q.isActive,
    });
  };

  const handleVerifyCurrentAffairsNow = async (q: QuestionItem) => {
    const today = new Date().toISOString().slice(0, 10);
    const correctOption = findCorrectOptionFromHash(q.id, q.answerHash);
    await adminSaveQuestion(adminUid, adminEmail, {
      id: q.id,
      category: q.category,
      subcategory: q.subcategory,
      difficulty: q.difficulty,
      questionText: q.questionText,
      options: q.options,
      correctOption,
      explanation: q.explanation || '',
      sourceUrl: q.sourceUrl || '',
      publishedAt: q.publishedAt || today,
      verifiedAt: today,
      expiresAt: q.expiresAt,
      isActive: true,
    });
    setStatusBanner(`Verified Current Affairs question as of ${today}.`);
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const activeRoomsCount = rooms.filter(
    (r) => r.status === 'waiting' || r.status === 'countdown' || r.status === 'racing'
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <button
            type="button"
            onClick={onExitAdmin}
            className="mb-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Game</span>
          </button>
          <p className="text-xs font-bold text-sky-700">
            Authorized Administrator Console · {adminEmail}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Calculation Racer Admin Panel
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeedDatabase}
            className="flex items-center gap-2 rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-800 transition-colors hover:bg-sky-100"
          >
            <Database className="h-4 w-4 text-sky-600" />
            <span>{seeding ? 'Syncing Question Bank...' : 'Sync Starter Question Bank'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenEditQuestion(undefined)}
            className="flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-sky-500"
          >
            <Plus className="h-4 w-4" />
            <span>New Question</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* 4 Dashboard Overview Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
          <p className="text-xs font-bold text-sky-800">Total Players</p>
          <p className="mt-2 font-mono text-3xl font-extrabold text-sky-950 tabular-nums">
            {players.length}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
          <p className="text-xs font-bold text-emerald-800">Races Completed</p>
          <p className="mt-2 font-mono text-3xl font-extrabold text-emerald-950 tabular-nums">
            {results.length}
          </p>
        </div>
        <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-5">
          <p className="text-xs font-bold text-purple-800">Active Rooms</p>
          <p className="mt-2 font-mono text-3xl font-extrabold text-purple-950 tabular-nums">
            {activeRoomsCount}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
          <p className="text-xs font-bold text-amber-800">Questions in Database</p>
          <p className="mt-2 font-mono text-3xl font-extrabold text-amber-950 tabular-nums">
            {questions.length}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'questions', label: `Question Bank (${questions.length})` },
            { id: 'current_affairs', label: 'Current Affairs Desk' },
            {
              id: 'reports',
              label: `Reported Questions (${reports.filter((r) => r.status === 'open').length})`,
            },
            { id: 'players', label: `Players (${players.length})` },
            { id: 'races', label: 'Race Records' },
            { id: 'audit', label: 'Admin Audit Log' },
          ] as { id: AdminTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6">
        {(activeTab === 'questions' ||
          activeTab === 'current_affairs' ||
          activeTab === 'overview') && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {activeTab === 'current_affairs'
                    ? 'Current Affairs Verification & Expiry Management'
                    : 'Question Bank Management'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeTab === 'current_affairs'
                    ? 'Every Current Affairs question includes publication date, source URL, verification date, and optional expiry.'
                    : 'Create, edit, search, filter, enable/disable, or delete multiple-choice questions.'}
                </p>
              </div>

              {activeTab === 'current_affairs' && (
                <button
                  type="button"
                  onClick={() => handleOpenEditQuestion(undefined, 'current_affairs')}
                  className="flex items-center gap-1.5 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-500"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Verified Current Affairs Question</span>
                </button>
              )}
            </div>

            {/* Search & Filter Bar */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search question text..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none"
                />
              </div>

              {activeTab !== 'current_affairs' && (
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value as QuestionCategory | 'all')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Categories</option>
                  <option value="math">Mathematics</option>
                  <option value="gk">General Knowledge</option>
                  <option value="science">Science</option>
                  <option value="current_affairs">Current Affairs</option>
                </select>
              )}

              <select
                value={filterDiff}
                onChange={(e) => setFilterDiff(e.target.value as QuestionDifficulty | 'all')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center">
                <p className="text-sm font-bold text-slate-800">
                  No questions found in Firestore matching your filter.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Click &ldquo;Sync Starter Question Bank&rdquo; above to populate all verified starter questions into Firestore.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Question</th>
                      <th className="px-4 py-3">Category · Topic · Diff</th>
                      <th className="px-4 py-3">Verification / Source</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredQuestions.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50">
                        <td className="max-w-md px-4 py-3 font-semibold text-slate-900">
                          <p>{q.questionText}</p>
                          <p className="mt-1 font-normal text-slate-500">
                            Options: {q.options.join(' | ')}
                          </p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                          <span className="font-bold">{CATEGORY_LABELS[q.category]}</span>
                          {q.subcategory ? ` · ${q.subcategory}` : ''} ·{' '}
                          <span className="uppercase">{DIFFICULTY_LABELS[q.difficulty]}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {q.verifiedAt ? `Verified ${q.verifiedAt}` : 'Standard'}
                          {q.expiresAt ? ` · Exp ${q.expiresAt}` : ''}
                          {q.sourceUrl && (
                            <span className="block max-w-[180px] truncate text-sky-600">
                              {q.sourceUrl}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`rounded-lg px-2 py-0.5 font-bold ${
                              q.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {q.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {q.category === 'current_affairs' && (
                              <button
                                type="button"
                                onClick={() => handleVerifyCurrentAffairsNow(q)}
                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                              >
                                Verify Today
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleToggleQuestionActive(q)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {q.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditQuestion(q)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-sky-600 hover:bg-sky-50"
                              title="Edit Question"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDialog({
                                  title: 'Delete Question Permanently?',
                                  description: `Are you sure you want to delete "${q.questionText}"? This action will be recorded in the Admin Audit Log.`,
                                  onConfirm: async () => {
                                    await adminDeleteQuestion(
                                      adminUid,
                                      adminEmail,
                                      q.id,
                                      q.questionText
                                    );
                                  },
                                })
                              }
                              className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                              title="Delete Question"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* REPORTED QUESTIONS TAB */}
        {activeTab === 'reports' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Player-Submitted Question Reports
            </h2>
            {reports.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No question reports have been submitted.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div>
                      <p className="text-xs text-slate-500">
                        Reported by <strong className="text-slate-900">{rep.reporterNickname}</strong> · Status:{' '}
                        <span className="font-bold uppercase text-sky-700">{rep.status}</span>
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        Question: &ldquo;{rep.questionText}&rdquo;
                      </p>
                      <p className="mt-1 text-xs font-semibold text-amber-800">
                        Reason: {rep.reason}
                      </p>
                    </div>
                    {rep.status === 'open' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await updateDoc(doc(db, 'question_reports', rep.id), {
                              status: 'resolved',
                              adminNote: 'Reviewed and verified by admin',
                              updatedAt: serverTimestamp(),
                            });
                            await logAdminAction(
                              adminUid,
                              adminEmail,
                              'Resolved Question Report',
                              'report',
                              rep.id,
                              `Resolved report on question ${rep.questionId}`
                            );
                          }}
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                        >
                          Mark Resolved
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await updateDoc(doc(db, 'question_reports', rep.id), {
                              status: 'dismissed',
                              adminNote: 'Dismissed after review',
                              updatedAt: serverTimestamp(),
                            });
                            await logAdminAction(
                              adminUid,
                              adminEmail,
                              'Dismissed Question Report',
                              'report',
                              rep.id,
                              `Dismissed report on question ${rep.questionId}`
                            );
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PLAYERS MODERATION TAB */}
        {activeTab === 'players' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Player Accounts & Moderation
            </h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nickname</th>
                    <th className="px-4 py-3">Wins / Races</th>
                    <th className="px-4 py-3">Best Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                  {players.map((p) => (
                    <tr key={p.uid} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-sans font-bold text-slate-900">
                        {p.nickname}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.wins} / {p.totalRaces}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600">
                        {p.bestTimeMs > 0 ? `${(p.bestTimeMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {p.isBanned ? (
                          <span className="font-bold text-rose-600">
                            Banned ({p.banReason || 'Policy violation'})
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-600">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDialog({
                              title: p.isBanned
                                ? `Unban ${p.nickname}?`
                                : `Ban ${p.nickname}?`,
                              description: p.isBanned
                                ? `Restore multiplayer and leaderboard privileges for ${p.nickname}.`
                                : `Provide a mandatory moderation reason for banning ${p.nickname}.`,
                              requireReason: !p.isBanned,
                              onConfirm: async (reason) => {
                                await updateDoc(doc(db, 'profiles', p.uid), {
                                  isBanned: !p.isBanned,
                                  banReason: !p.isBanned ? reason.slice(0, 200) : '',
                                  updatedAt: serverTimestamp(),
                                });
                                await logAdminAction(
                                  adminUid,
                                  adminEmail,
                                  p.isBanned ? 'Unbanned Player' : 'Banned Player',
                                  'player',
                                  p.uid,
                                  `${p.nickname}: ${reason || 'Restored account'}`
                                );
                              },
                            })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                            p.isBanned
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
                          }`}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>{p.isBanned ? 'Unban Account' : 'Ban Account'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RACE RECORDS & LEADERBOARD AUDIT TAB */}
        {activeTab === 'races' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Race History & Leaderboard Verification
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Inspect official race results and remove invalidated records with an audit trail.
            </p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Driver</th>
                    <th className="px-4 py-3">Room / Mode</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Placement</th>
                    <th className="px-4 py-3">Distance</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3 text-right">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-sans font-bold text-slate-900">
                        {r.nickname}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.roomCode} ({r.mode})
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-700">
                        {CATEGORY_LABELS[r.category]}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">#{r.placement}</td>
                      <td className="px-4 py-3 font-bold text-sky-600">{r.distance}m</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">
                        {(r.durationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        {r.id && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({
                                title: 'Remove Race Record?',
                                description: `Remove ${r.nickname}'s race record (${r.roomCode})?`,
                                onConfirm: async () => {
                                  if (!r.id) return;
                                  await deleteDoc(doc(db, 'race_results', r.id));
                                  await logAdminAction(
                                    adminUid,
                                    adminEmail,
                                    'Removed Race Result',
                                    'leaderboard',
                                    r.id,
                                    `Removed result for ${r.nickname} in ${r.roomCode}`
                                  );
                                },
                              })
                            }
                            className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADMIN AUDIT LOG TAB */}
        {activeTab === 'audit' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Immutable Administrator Audit Log
            </h2>
            {auditLogs.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No administrative mutations recorded yet.
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-sky-700">{log.action}</span>
                      <span className="mx-2 text-slate-400">·</span>
                      <span className="text-slate-800">{log.details}</span>
                    </div>
                    <div className="font-mono text-slate-500">
                      {log.adminEmail} · Target: {log.targetType}/{log.targetId}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUESTION CREATE / EDIT MODAL */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900">
              {editingQuestion.id ? 'Edit Question' : 'Create New Question'}
            </h3>
            <form onSubmit={handleSaveQuestionSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-slate-700">Category</label>
                  <select
                    value={editingQuestion.category}
                    onChange={(e) => {
                      const nextCat = e.target.value as QuestionCategory;
                      setEditingQuestion({
                        ...editingQuestion,
                        category: nextCat,
                        subcategory: SUBCATEGORIES_BY_CATEGORY[nextCat]?.[0] || '',
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900"
                  >
                    <option value="math">Mathematics</option>
                    <option value="gk">General Knowledge</option>
                    <option value="science">Science</option>
                    <option value="current_affairs">Current Affairs</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Subcategory / Topic</label>
                  <select
                    value={editingQuestion.subcategory}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        subcategory: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900"
                  >
                    {(SUBCATEGORIES_BY_CATEGORY[editingQuestion.category] || []).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Difficulty</label>
                  <select
                    value={editingQuestion.difficulty}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        difficulty: e.target.value as QuestionDifficulty,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700">Question Text</label>
                <textarea
                  required
                  rows={2}
                  maxLength={500}
                  value={editingQuestion.questionText}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-700">
                  Four Options (Select the single correct option)
                </label>
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={editingQuestion.correctOption === idx}
                      onChange={() =>
                        setEditingQuestion({ ...editingQuestion, correctOption: idx })
                      }
                      className="h-4 w-4 text-sky-600"
                    />
                    <input
                      type="text"
                      required
                      maxLength={200}
                      placeholder={`Option ${idx + 1}`}
                      value={editingQuestion.options[idx]}
                      onChange={(e) => {
                        const nextOpts = [...editingQuestion.options] as [
                          string,
                          string,
                          string,
                          string,
                        ];
                        nextOpts[idx] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: nextOpts });
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-bold text-slate-700">
                  Explanation (Shown after submission)
                </label>
                <input
                  type="text"
                  maxLength={1000}
                  value={editingQuestion.explanation}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"
                />
              </div>

              {editingQuestion.category === 'current_affairs' && (
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700">Source URL</label>
                    <input
                      type="url"
                      required
                      value={editingQuestion.sourceUrl}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, sourceUrl: e.target.value })
                      }
                      placeholder="https://..."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700">Verified Date</label>
                    <input
                      type="date"
                      required
                      value={editingQuestion.verifiedAt}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, verifiedAt: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700">
                      Optional Expiry Date
                    </label>
                    <input
                      type="date"
                      value={editingQuestion.expiresAt}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, expiresAt: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingQuestion.isActive}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, isActive: e.target.checked })
                    }
                  />
                  <span>Active in live races</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-500"
                  >
                    Save Question
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG FOR DESTRUCTIVE ACTIONS */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900">
              {confirmDialog.title}
            </h3>
            <p className="mt-2 text-xs text-slate-600">{confirmDialog.description}</p>
            {confirmDialog.requireReason && (
              <input
                type="text"
                required
                placeholder="Enter mandatory reason for audit log..."
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            )}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog(null);
                  setConfirmReason('');
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirmDialog.requireReason && !confirmReason.trim()) return;
                  await confirmDialog.onConfirm(confirmReason.trim());
                  setConfirmDialog(null);
                  setConfirmReason('');
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
