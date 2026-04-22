"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";
import {
  businessConsistencyQuestions as fallbackBusinessConsistencyQuestions,
  businessQuestions as fallbackBusinessQuestions,
  businessReverseQuestions as fallbackBusinessReverseQuestions,
  mbtiConsistencyQuestions as fallbackMbtiConsistencyQuestions,
  mbtiQuestions as fallbackMbtiQuestions,
  mbtiReverseQuestions as fallbackMbtiReverseQuestions,
} from "@/lib/diagnosis/master";
import {
  calculateBusinessType,
  calculateMbtiType,
} from "@/lib/diagnosis/calculators";
import {
  calculateBusinessConfidence,
  calculateMbtiConfidence,
} from "@/lib/diagnosis/confidence";
import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";
import type {
  BinaryAnswer,
  BusinessAnswer,
  BusinessLikertQuestion,
  BusinessQuestion,
  LikertAnswer,
  LikertValue,
  MbtiAnswer,
  MbtiLikertQuestion,
  MbtiQuestion,
} from "@/lib/diagnosis/types";

type UserProfile = {
  uid: string;
  name?: string;
  nameKana?: string;
  role?: string;
  status?: string;
};

type WizardStep =
  | "mbti"
  | "business"
  | "mbtiReverse"
  | "mbtiConsistency"
  | "businessReverse"
  | "businessConsistency"
  | "confirm";

type DiagnosisDraft = {
  userId: string;
  status: "in_progress" | "completed";
  step: WizardStep;
  mbtiIndex: number;
  businessIndex: number;
  mbtiReverseIndex: number;
  mbtiConsistencyIndex: number;
  businessReverseIndex: number;
  businessConsistencyIndex: number;
  mbtiAnswers: MbtiAnswer[];
  businessAnswers: BusinessAnswer[];
  mbtiReverseAnswers: LikertAnswer[];
  mbtiConsistencyAnswers: LikertAnswer[];
  businessReverseAnswers: LikertAnswer[];
  businessConsistencyAnswers: LikertAnswer[];
  savedAt: string;
};

const LIKERT_OPTIONS: Array<{ value: LikertValue; label: string }> = [
  { value: 1, label: "全く当てはまらない" },
  { value: 2, label: "あまり当てはまらない" },
  { value: 3, label: "どちらでもない" },
  { value: 4, label: "やや当てはまる" },
  { value: 5, label: "とても当てはまる" },
];

const DIAGNOSIS_DRAFT_KEY = "regal-cast-diagnosis-draft-v1";

type WizardMasterState = {
  mbtiQuestions: MbtiQuestion[];
  businessQuestions: BusinessQuestion[];
  mbtiReverseQuestions: MbtiLikertQuestion[];
  mbtiConsistencyQuestions: MbtiLikertQuestion[];
  businessReverseQuestions: BusinessLikertQuestion[];
  businessConsistencyQuestions: BusinessLikertQuestion[];
};

function normalizeDateString(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function safeParseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeRoleForNav(value?: string) {
  return (value || "").trim().toLowerCase();
}

function PanelFrame({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[28px] border-[4px] border-black bg-[#171717] shadow-[0_10px_0_#000] ${className}`}
    >
      <div className="absolute left-0 top-0 h-3 w-full bg-[#f3c400]" />
      <div className="absolute right-4 top-4 h-4 w-4 rotate-45 border-2 border-black bg-[#ffe46a]" />
      <div className="relative p-5 pt-7">
        {title && (
          <div className="mb-4 inline-flex rounded-[999px] border-[3px] border-black bg-[#f3c400] px-3 py-1 text-xs font-black text-black shadow-[0_4px_0_#000]">
            {title}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-4 overflow-hidden rounded-full border-[3px] border-black bg-[#242424]">
      <div
        className="h-full bg-[linear-gradient(90deg,#fff27a_0%,#f3c400_100%)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function isMbtiAnswerArray(value: unknown): value is MbtiAnswer[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as MbtiAnswer).questionId === "string" &&
        [1, 2, 3, 4, 5].includes((item as MbtiAnswer).value)
    )
  );
}

function isBusinessAnswerArray(value: unknown): value is BusinessAnswer[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as BusinessAnswer).questionId === "string" &&
        ((item as BusinessAnswer).answer === "A" ||
          (item as BusinessAnswer).answer === "B")
    )
  );
}

function isLikertAnswerArray(value: unknown): value is LikertAnswer[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as LikertAnswer).questionId === "string" &&
        [1, 2, 3, 4, 5].includes((item as LikertAnswer).value)
    )
  );
}

function clampIndex(value: unknown, min: number, max: number) {
  const num = typeof value === "number" && Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function isWizardStep(value: unknown): value is WizardStep {
  return (
    value === "mbti" ||
    value === "business" ||
    value === "mbtiReverse" ||
    value === "mbtiConsistency" ||
    value === "businessReverse" ||
    value === "businessConsistency" ||
    value === "confirm"
  );
}

function normalizeDraft(
  input: unknown,
  userId: string,
  master: WizardMasterState
): DiagnosisDraft | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DiagnosisDraft>;

  const step = isWizardStep(raw.step) ? raw.step : "mbti";

  return {
    userId,
    status: raw.status === "completed" ? "completed" : "in_progress",
    step,
    mbtiIndex: clampIndex(raw.mbtiIndex, 0, master.mbtiQuestions.length),
    businessIndex: clampIndex(raw.businessIndex, 0, master.businessQuestions.length),
    mbtiReverseIndex: clampIndex(
      raw.mbtiReverseIndex,
      0,
      master.mbtiReverseQuestions.length
    ),
    mbtiConsistencyIndex: clampIndex(
      raw.mbtiConsistencyIndex,
      0,
      master.mbtiConsistencyQuestions.length
    ),
    businessReverseIndex: clampIndex(
      raw.businessReverseIndex,
      0,
      master.businessReverseQuestions.length
    ),
    businessConsistencyIndex: clampIndex(
      raw.businessConsistencyIndex,
      0,
      master.businessConsistencyQuestions.length
    ),
    mbtiAnswers: isMbtiAnswerArray(raw.mbtiAnswers) ? raw.mbtiAnswers : [],
    businessAnswers: isBusinessAnswerArray(raw.businessAnswers)
      ? raw.businessAnswers
      : [],
    mbtiReverseAnswers: isLikertAnswerArray(raw.mbtiReverseAnswers)
      ? raw.mbtiReverseAnswers
      : [],
    mbtiConsistencyAnswers: isLikertAnswerArray(raw.mbtiConsistencyAnswers)
      ? raw.mbtiConsistencyAnswers
      : [],
    businessReverseAnswers: isLikertAnswerArray(raw.businessReverseAnswers)
      ? raw.businessReverseAnswers
      : [],
    businessConsistencyAnswers: isLikertAnswerArray(raw.businessConsistencyAnswers)
      ? raw.businessConsistencyAnswers
      : [],
    savedAt:
      typeof raw.savedAt === "string" && raw.savedAt.trim() !== ""
        ? raw.savedAt
        : new Date(0).toISOString(),
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeWeight(value: unknown) {
  return typeof value === "number" && !Number.isNaN(value) ? value : 1;
}

function normalizeReverse(value: unknown) {
  return value === true;
}

function sortByOrderThenId<T extends { id: string; order?: number }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id, "ja");
  });
}

async function loadMbtiQuestions(): Promise<MbtiQuestion[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "diagnosis_master_mbti_questions"), orderBy("order", "asc"))
    );

    if (snap.empty) return fallbackMbtiQuestions;

    const rows = snap.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        id: normalizeText(data.id) || item.id,
        text: normalizeText(data.text),
        axis: (normalizeText(data.axis) || "EI") as MbtiQuestion["axis"],
        weight: normalizeWeight(data.weight),
        reverse: normalizeReverse(data.reverse),
        order: typeof data.order === "number" ? data.order : undefined,
      };
    });

    return sortByOrderThenId(rows).map(({ order: _order, ...row }) => row);
  } catch (error) {
    console.error("MBTI設問マスタ読み込み失敗:", error);
    return fallbackMbtiQuestions;
  }
}

async function loadBusinessQuestions(): Promise<BusinessQuestion[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "diagnosis_master_business_questions"),
        orderBy("order", "asc")
      )
    );

    if (snap.empty) return fallbackBusinessQuestions;

    const rows = snap.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        id: normalizeText(data.id) || item.id,
        question: normalizeText(data.question),
        optionA: normalizeText(data.optionA),
        optionB: normalizeText(data.optionB),
        axis: (normalizeText(data.axis) || "MP") as BusinessQuestion["axis"],
        weight: normalizeWeight(data.weight),
        reverse: normalizeReverse(data.reverse),
        order: typeof data.order === "number" ? data.order : undefined,
      };
    });

    return sortByOrderThenId(rows).map(({ order: _order, ...row }) => row);
  } catch (error) {
    console.error("ビジネス設問マスタ読み込み失敗:", error);
    return fallbackBusinessQuestions;
  }
}

async function loadMbtiLikertCollection(
  collectionName: string,
  fallback: MbtiLikertQuestion[]
): Promise<MbtiLikertQuestion[]> {
  try {
    const snap = await getDocs(
      query(collection(db, collectionName), orderBy("order", "asc"))
    );

    if (snap.empty) return fallback;

    const rows = snap.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        id: normalizeText(data.id) || item.id,
        axis: (normalizeText(data.axis) || "EI") as MbtiLikertQuestion["axis"],
        direction: (normalizeText(data.direction) ||
          "E") as MbtiLikertQuestion["direction"],
        question: normalizeText(data.question),
        order: typeof data.order === "number" ? data.order : undefined,
      };
    });

    return sortByOrderThenId(rows).map(({ order: _order, ...row }) => row);
  } catch (error) {
    console.error(`${collectionName} 読み込み失敗:`, error);
    return fallback;
  }
}

async function loadBusinessLikertCollection(
  collectionName: string,
  fallback: BusinessLikertQuestion[]
): Promise<BusinessLikertQuestion[]> {
  try {
    const snap = await getDocs(
      query(collection(db, collectionName), orderBy("order", "asc"))
    );

    if (snap.empty) return fallback;

    const rows = snap.docs.map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        id: normalizeText(data.id) || item.id,
        axis: (normalizeText(data.axis) || "MP") as BusinessLikertQuestion["axis"],
        direction: (normalizeText(data.direction) ||
          "M") as BusinessLikertQuestion["direction"],
        question: normalizeText(data.question),
        order: typeof data.order === "number" ? data.order : undefined,
      };
    });

    return sortByOrderThenId(rows).map(({ order: _order, ...row }) => row);
  } catch (error) {
    console.error(`${collectionName} 読み込み失敗:`, error);
    return fallback;
  }
}

async function loadWizardMaster(): Promise<WizardMasterState> {
  const [
    mbtiQuestions,
    businessQuestions,
    mbtiReverseQuestions,
    mbtiConsistencyQuestions,
    businessReverseQuestions,
    businessConsistencyQuestions,
  ] = await Promise.all([
    loadMbtiQuestions(),
    loadBusinessQuestions(),
    loadMbtiLikertCollection(
      "diagnosis_master_mbti_reverse_questions",
      fallbackMbtiReverseQuestions
    ),
    loadMbtiLikertCollection(
      "diagnosis_master_mbti_consistency_questions",
      fallbackMbtiConsistencyQuestions
    ),
    loadBusinessLikertCollection(
      "diagnosis_master_business_reverse_questions",
      fallbackBusinessReverseQuestions
    ),
    loadBusinessLikertCollection(
      "diagnosis_master_business_consistency_questions",
      fallbackBusinessConsistencyQuestions
    ),
  ]);

  return {
    mbtiQuestions,
    businessQuestions,
    mbtiReverseQuestions,
    mbtiConsistencyQuestions,
    businessReverseQuestions,
    businessConsistencyQuestions,
  };
}

export default function RegisterWizardPage() {
  const router = useRouter();
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedDraftRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  const [master, setMaster] = useState<WizardMasterState>({
    mbtiQuestions: fallbackMbtiQuestions,
    businessQuestions: fallbackBusinessQuestions,
    mbtiReverseQuestions: fallbackMbtiReverseQuestions,
    mbtiConsistencyQuestions: fallbackMbtiConsistencyQuestions,
    businessReverseQuestions: fallbackBusinessReverseQuestions,
    businessConsistencyQuestions: fallbackBusinessConsistencyQuestions,
  });

  const [mbtiIndex, setMbtiIndex] = useState(0);
  const [businessIndex, setBusinessIndex] = useState(0);
  const [mbtiReverseIndex, setMbtiReverseIndex] = useState(0);
  const [mbtiConsistencyIndex, setMbtiConsistencyIndex] = useState(0);
  const [businessReverseIndex, setBusinessReverseIndex] = useState(0);
  const [businessConsistencyIndex, setBusinessConsistencyIndex] = useState(0);

  const [mbtiAnswers, setMbtiAnswers] = useState<MbtiAnswer[]>([]);
  const [businessAnswers, setBusinessAnswers] = useState<BusinessAnswer[]>([]);
  const [mbtiReverseAnswers, setMbtiReverseAnswers] = useState<LikertAnswer[]>([]);
  const [mbtiConsistencyAnswers, setMbtiConsistencyAnswers] = useState<
    LikertAnswer[]
  >([]);
  const [businessReverseAnswers, setBusinessReverseAnswers] = useState<
    LikertAnswer[]
  >([]);
  const [businessConsistencyAnswers, setBusinessConsistencyAnswers] = useState<
    LikertAnswer[]
  >([]);

  const step: WizardStep = useMemo(() => {
    if (mbtiIndex < master.mbtiQuestions.length) return "mbti";
    if (businessIndex < master.businessQuestions.length) return "business";
    if (mbtiReverseIndex < master.mbtiReverseQuestions.length) return "mbtiReverse";
    if (mbtiConsistencyIndex < master.mbtiConsistencyQuestions.length) {
      return "mbtiConsistency";
    }
    if (businessReverseIndex < master.businessReverseQuestions.length) {
      return "businessReverse";
    }
    if (businessConsistencyIndex < master.businessConsistencyQuestions.length) {
      return "businessConsistency";
    }
    return "confirm";
  }, [
    businessConsistencyIndex,
    businessIndex,
    businessReverseIndex,
    master.businessConsistencyQuestions.length,
    master.businessQuestions.length,
    master.businessReverseQuestions.length,
    master.mbtiConsistencyQuestions.length,
    master.mbtiQuestions.length,
    master.mbtiReverseQuestions.length,
    mbtiConsistencyIndex,
    mbtiIndex,
    mbtiReverseIndex,
  ]);

  const totalQuestionCount =
    master.mbtiQuestions.length +
    master.businessQuestions.length +
    master.mbtiReverseQuestions.length +
    master.mbtiConsistencyQuestions.length +
    master.businessReverseQuestions.length +
    master.businessConsistencyQuestions.length;

  const answeredQuestionCount =
    mbtiAnswers.length +
    businessAnswers.length +
    mbtiReverseAnswers.length +
    mbtiConsistencyAnswers.length +
    businessReverseAnswers.length +
    businessConsistencyAnswers.length;

  const overallProgressValue =
    totalQuestionCount > 0
      ? Math.round((answeredQuestionCount / totalQuestionCount) * 100)
      : 0;

  const currentDraft = useMemo<DiagnosisDraft | null>(() => {
    if (!me) return null;

    return {
      userId: me.uid,
      status: "in_progress",
      step,
      mbtiIndex,
      businessIndex,
      mbtiReverseIndex,
      mbtiConsistencyIndex,
      businessReverseIndex,
      businessConsistencyIndex,
      mbtiAnswers,
      businessAnswers,
      mbtiReverseAnswers,
      mbtiConsistencyAnswers,
      businessReverseAnswers,
      businessConsistencyAnswers,
      savedAt: new Date().toISOString(),
    };
  }, [
    businessAnswers,
    businessConsistencyAnswers,
    businessConsistencyIndex,
    businessIndex,
    businessReverseAnswers,
    businessReverseIndex,
    mbtiAnswers,
    mbtiConsistencyAnswers,
    mbtiConsistencyIndex,
    mbtiIndex,
    mbtiReverseAnswers,
    mbtiReverseIndex,
    me,
    step,
  ]);

  async function persistDraft(
    source: "manual" | "auto" | "silent",
    draft: DiagnosisDraft
  ) {
    if (!me) return;

    try {
      if (source === "manual") {
        setDraftSaving(true);
      }

      localStorage.setItem(DIAGNOSIS_DRAFT_KEY, JSON.stringify(draft));

      await setDoc(
        doc(db, "diagnosis_sessions", me.uid),
        {
          userId: me.uid,
          status: draft.status,
          step: draft.step,
          mbtiIndex: draft.mbtiIndex,
          businessIndex: draft.businessIndex,
          mbtiReverseIndex: draft.mbtiReverseIndex,
          mbtiConsistencyIndex: draft.mbtiConsistencyIndex,
          businessReverseIndex: draft.businessReverseIndex,
          businessConsistencyIndex: draft.businessConsistencyIndex,
          mbtiAnswers: draft.mbtiAnswers,
          businessAnswers: draft.businessAnswers,
          mbtiReverseAnswers: draft.mbtiReverseAnswers,
          mbtiConsistencyAnswers: draft.mbtiConsistencyAnswers,
          businessReverseAnswers: draft.businessReverseAnswers,
          businessConsistencyAnswers: draft.businessConsistencyAnswers,
          savedAt: normalizeDateString(draft.savedAt),
          savedAtServer: serverTimestamp(),
        },
        { merge: true }
      );

      if (source === "manual") {
        setDraftMessage("一時保存しました。");
      }
    } catch (e) {
      console.error("draft 保存失敗:", e);
      if (source === "manual") {
        setError("一時保存に失敗しました。");
      }
    } finally {
      if (source === "manual") {
        setDraftSaving(false);
      }
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const [userSnap, sessionSnap, loadedMaster] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "diagnosis_sessions", user.uid)),
          loadWizardMaster(),
        ]);

        if (!userSnap.exists()) {
          router.push("/login");
          return;
        }

        setMaster(loadedMaster);

        const meData = {
          ...(userSnap.data() as Omit<UserProfile, "uid">),
          uid: user.uid,
        };

        setMe(meData);

        const localDraft = normalizeDraft(
          safeParseJson(
            typeof window !== "undefined"
              ? localStorage.getItem(DIAGNOSIS_DRAFT_KEY)
              : null
          ),
          user.uid,
          loadedMaster
        );

        const remoteDraft = normalizeDraft(
          sessionSnap.exists() ? sessionSnap.data() : null,
          user.uid,
          loadedMaster
        );

        const latestDraft =
          localDraft &&
          remoteDraft &&
          new Date(localDraft.savedAt).getTime() >=
            new Date(remoteDraft.savedAt).getTime()
            ? localDraft
            : remoteDraft || localDraft;

        if (
          latestDraft &&
          latestDraft.status === "in_progress" &&
          latestDraft.userId === user.uid
        ) {
          setMbtiIndex(latestDraft.mbtiIndex);
          setBusinessIndex(latestDraft.businessIndex);
          setMbtiReverseIndex(latestDraft.mbtiReverseIndex);
          setMbtiConsistencyIndex(latestDraft.mbtiConsistencyIndex);
          setBusinessReverseIndex(latestDraft.businessReverseIndex);
          setBusinessConsistencyIndex(latestDraft.businessConsistencyIndex);

          setMbtiAnswers(latestDraft.mbtiAnswers);
          setBusinessAnswers(latestDraft.businessAnswers);
          setMbtiReverseAnswers(latestDraft.mbtiReverseAnswers);
          setMbtiConsistencyAnswers(latestDraft.mbtiConsistencyAnswers);
          setBusinessReverseAnswers(latestDraft.businessReverseAnswers);
          setBusinessConsistencyAnswers(latestDraft.businessConsistencyAnswers);

          setDraftMessage("前回の続きから再開しました。");
        }

        hasHydratedDraftRef.current = true;
      } catch (e) {
        console.error("wizard 読み込み失敗:", e);
        setError("診断の準備に失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!hasHydratedDraftRef.current || !currentDraft || !me) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistDraft("auto", currentDraft);
    }, 700);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [currentDraft, me]);

  useEffect(() => {
    if (!currentDraft) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      try {
        localStorage.setItem(DIAGNOSIS_DRAFT_KEY, JSON.stringify(currentDraft));
      } catch {
        //
      }

      if (currentDraft.status === "in_progress") {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [currentDraft]);

  function upsertLikertAnswer(
    setter: React.Dispatch<React.SetStateAction<LikertAnswer[]>>,
    questionId: string,
    value: LikertValue
  ) {
    setter((prev) => {
      const found = prev.find((item) => item.questionId === questionId);
      if (found) {
        return prev.map((item) =>
          item.questionId === questionId ? { ...item, value } : item
        );
      }
      return [...prev, { questionId, value }];
    });
  }

  function upsertMbtiAnswer(questionId: string, value: LikertValue) {
    setMbtiAnswers((prev) => {
      const found = prev.find((item) => item.questionId === questionId);
      if (found) {
        return prev.map((item) =>
          item.questionId === questionId ? { ...item, value } : item
        );
      }
      return [...prev, { questionId, value }];
    });
  }

  function upsertBusinessAnswer(questionId: string, answer: BinaryAnswer) {
    setBusinessAnswers((prev) => {
      const found = prev.find((item) => item.questionId === questionId);
      if (found) {
        return prev.map((item) =>
          item.questionId === questionId ? { ...item, answer } : item
        );
      }
      return [...prev, { questionId, answer }];
    });
  }

  function handleLikertNext(value: LikertValue) {
    setError("");
    setDraftMessage("");

    if (step === "mbti") {
      const question = master.mbtiQuestions[mbtiIndex];
      if (!question) return;
      upsertMbtiAnswer(question.id, value);
      setMbtiIndex((prev) => prev + 1);
      return;
    }

    if (step === "mbtiReverse") {
      const question = master.mbtiReverseQuestions[mbtiReverseIndex];
      if (!question) return;
      upsertLikertAnswer(setMbtiReverseAnswers, question.id, value);
      setMbtiReverseIndex((prev) => prev + 1);
      return;
    }

    if (step === "mbtiConsistency") {
      const question = master.mbtiConsistencyQuestions[mbtiConsistencyIndex];
      if (!question) return;
      upsertLikertAnswer(setMbtiConsistencyAnswers, question.id, value);
      setMbtiConsistencyIndex((prev) => prev + 1);
      return;
    }

    if (step === "businessReverse") {
      const question = master.businessReverseQuestions[businessReverseIndex];
      if (!question) return;
      upsertLikertAnswer(setBusinessReverseAnswers, question.id, value);
      setBusinessReverseIndex((prev) => prev + 1);
      return;
    }

    if (step === "businessConsistency") {
      const question =
        master.businessConsistencyQuestions[businessConsistencyIndex];
      if (!question) return;
      upsertLikertAnswer(setBusinessConsistencyAnswers, question.id, value);
      setBusinessConsistencyIndex((prev) => prev + 1);
    }
  }

  function handleBusinessNext(answer: BinaryAnswer) {
    setError("");
    setDraftMessage("");
    const question = master.businessQuestions[businessIndex];
    if (!question) return;
    upsertBusinessAnswer(question.id, answer);
    setBusinessIndex((prev) => prev + 1);
  }

  function goPrev() {
    setError("");
    setDraftMessage("");

    if (step === "confirm") {
      setBusinessConsistencyIndex(
        Math.max(0, master.businessConsistencyQuestions.length - 1)
      );
      return;
    }

    if (step === "businessConsistency") {
      if (businessConsistencyIndex > 0) {
        setBusinessConsistencyIndex((prev) => prev - 1);
      } else {
        setBusinessReverseIndex(
          Math.max(0, master.businessReverseQuestions.length - 1)
        );
      }
      return;
    }

    if (step === "businessReverse") {
      if (businessReverseIndex > 0) {
        setBusinessReverseIndex((prev) => prev - 1);
      } else {
        setMbtiConsistencyIndex(
          Math.max(0, master.mbtiConsistencyQuestions.length - 1)
        );
      }
      return;
    }

    if (step === "mbtiConsistency") {
      if (mbtiConsistencyIndex > 0) {
        setMbtiConsistencyIndex((prev) => prev - 1);
      } else {
        setMbtiReverseIndex(Math.max(0, master.mbtiReverseQuestions.length - 1));
      }
      return;
    }

    if (step === "mbtiReverse") {
      if (mbtiReverseIndex > 0) {
        setMbtiReverseIndex((prev) => prev - 1);
      } else {
        setBusinessIndex(Math.max(0, master.businessQuestions.length - 1));
      }
      return;
    }

    if (step === "business") {
      if (businessIndex > 0) {
        setBusinessIndex((prev) => prev - 1);
      } else {
        setMbtiIndex(Math.max(0, master.mbtiQuestions.length - 1));
      }
      return;
    }

    if (step === "mbti" && mbtiIndex > 0) {
      setMbtiIndex((prev) => prev - 1);
    }
  }

  const mbtiResult = useMemo(() => {
    if (mbtiAnswers.length === 0) return null;
    return calculateMbtiType(master.mbtiQuestions, mbtiAnswers);
  }, [master.mbtiQuestions, mbtiAnswers]);

  const businessResult = useMemo(() => {
    if (businessAnswers.length === 0) return null;
    return calculateBusinessType(master.businessQuestions, businessAnswers);
  }, [businessAnswers, master.businessQuestions]);

  const mbtiConfidence = useMemo(() => {
    if (!mbtiResult) return null;
    return calculateMbtiConfidence({
      result: mbtiResult,
      reverseQuestions: master.mbtiReverseQuestions,
      reverseAnswers: mbtiReverseAnswers,
      consistencyQuestions: master.mbtiConsistencyQuestions,
      consistencyAnswers: mbtiConsistencyAnswers,
    });
  }, [
    master.mbtiConsistencyQuestions,
    master.mbtiReverseQuestions,
    mbtiConsistencyAnswers,
    mbtiResult,
    mbtiReverseAnswers,
  ]);

  const businessConfidence = useMemo(() => {
    if (!businessResult) return null;
    return calculateBusinessConfidence({
      result: businessResult,
      reverseQuestions: master.businessReverseQuestions,
      reverseAnswers: businessReverseAnswers,
      consistencyQuestions: master.businessConsistencyQuestions,
      consistencyAnswers: businessConsistencyAnswers,
    });
  }, [
    businessConsistencyAnswers,
    businessResult,
    businessReverseAnswers,
    master.businessConsistencyQuestions,
    master.businessReverseQuestions,
  ]);

  const currentMeta = useMemo(() => {
    if (step === "mbti") {
      const q = master.mbtiQuestions[mbtiIndex];
      return {
        mode: "likert" as const,
        question: q?.text || "",
        optionA: "",
        optionB: "",
      };
    }

    if (step === "business") {
      const q = master.businessQuestions[businessIndex];
      return {
        mode: "binary" as const,
        question: q?.question || "",
        optionA: q?.optionA || "",
        optionB: q?.optionB || "",
      };
    }

    if (step === "mbtiReverse") {
      const q = master.mbtiReverseQuestions[mbtiReverseIndex];
      return {
        mode: "likert" as const,
        question: q?.question || "",
        optionA: "",
        optionB: "",
      };
    }

    if (step === "mbtiConsistency") {
      const q = master.mbtiConsistencyQuestions[mbtiConsistencyIndex];
      return {
        mode: "likert" as const,
        question: q?.question || "",
        optionA: "",
        optionB: "",
      };
    }

    if (step === "businessReverse") {
      const q = master.businessReverseQuestions[businessReverseIndex];
      return {
        mode: "likert" as const,
        question: q?.question || "",
        optionA: "",
        optionB: "",
      };
    }

    if (step === "businessConsistency") {
      const q = master.businessConsistencyQuestions[businessConsistencyIndex];
      return {
        mode: "likert" as const,
        question: q?.question || "",
        optionA: "",
        optionB: "",
      };
    }

    return {
      mode: "confirm" as const,
      question: "",
      optionA: "",
      optionB: "",
    };
  }, [
    businessConsistencyIndex,
    businessIndex,
    businessReverseIndex,
    master.businessConsistencyQuestions,
    master.businessQuestions,
    master.businessReverseQuestions,
    master.mbtiConsistencyQuestions,
    master.mbtiQuestions,
    master.mbtiReverseQuestions,
    mbtiConsistencyIndex,
    mbtiIndex,
    mbtiReverseIndex,
    step,
  ]);

  async function handleManualSaveDraft() {
    if (!currentDraft) return;
    setError("");
    await persistDraft("manual", currentDraft);
  }

  async function handleSaveDiagnosis() {
    if (!me || !mbtiResult || !businessResult || !mbtiConfidence || !businessConfidence) {
      setError("診断結果の計算が完了していません。");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setDraftMessage("");

      const nowIso = normalizeDateString(new Date().toISOString());

      const payload = {
        userId: me.uid,
        mbti: {
          type: mbtiResult.typeCode,
          typeName: getMbtiTypeName(mbtiResult.typeCode),
          axisResults: mbtiResult.axisScores,
          ambiguityAxes: mbtiResult.ambiguityAxes,
          confidence: mbtiConfidence.score,
        },
        businessPersonality: {
          primaryType: businessResult.typeCode,
          typeName: getBusinessTypeName(businessResult.typeCode),
          axisResults: businessResult.axisScores,
          ambiguityAxes: businessResult.ambiguityAxes,
          confidence: businessConfidence.score,
        },
        diagnosedAt: nowIso,
        updatedAt: nowIso,
        updatedAtServer: serverTimestamp(),
      };

      await setDoc(doc(db, "diagnostics_current", me.uid), payload, {
        merge: true,
      });

      await addDoc(collection(db, "diagnostics_history"), {
        ...payload,
        historyCreatedAt: nowIso,
        createdAtServer: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", me.uid),
        {
          lastDiagnosedAt: nowIso,
          status: "active",
          updatedAtServer: serverTimestamp(),
        },
        { merge: true }
      );

      localStorage.removeItem(DIAGNOSIS_DRAFT_KEY);

      await setDoc(
        doc(db, "diagnosis_sessions", me.uid),
        {
          userId: me.uid,
          status: "completed",
          step: "confirm",
          savedAt: nowIso,
          completedAt: nowIso,
          savedAtServer: serverTimestamp(),
        },
        { merge: true }
      );

      router.push("/diagnosis/result");
    } catch (e) {
      console.error("diagnosis 保存失敗:", e);
      setError("診断結果の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  const normalizedRole = normalizeRoleForNav(me?.role);

  if (loading) {
    return (
      <P4LoadingScreen
        title="DIAGNOSIS LOADING"
        subtitle="診断の準備をしています..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-4 py-6 pb-24 text-white md:pb-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-4">
              <div>
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1 text-xs font-black tracking-[0.18em] text-black shadow-[0_4px_0_#000]">
                  DIAGNOSIS WIZARD
                </div>
                <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">
                  診断に回答する
                </h1>
                <p className="mt-2 text-sm font-bold text-white/80">
                  MBTI とビジネス人格診断を順に進めます。
                </p>
                {me?.name && (
                  <p className="mt-3 text-base font-black text-white">
                    {me.name}
                  </p>
                )}
                {me?.nameKana && (
                  <p className="mt-1 text-sm font-black tracking-[0.08em] text-[#ffe46a]">
                    {me.nameKana}
                  </p>
                )}
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={normalizedRole} />
              </div>
            </div>
          </PanelFrame>

          {error && (
            <div className="rounded-[24px] border-[4px] border-black bg-[#ffd0d0] px-4 py-4 font-black text-[#7b1111] shadow-[0_8px_0_#000]">
              {error}
            </div>
          )}

          {draftMessage && (
            <div className="rounded-[24px] border-[4px] border-black bg-[#fff27a] px-4 py-4 font-black text-black shadow-[0_8px_0_#000]">
              {draftMessage}
            </div>
          )}

          {step !== "confirm" && (
            <PanelFrame>
              <div className="rounded-[24px] border-[4px] border-black bg-[#111111] p-5 shadow-[0_8px_0_#000]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-black tracking-[0.15em] text-[#ffe46a]">
                    全体進捗 {answeredQuestionCount} / {totalQuestionCount}
                  </p>
                </div>

                <div className="mt-3">
                  <ProgressBar value={overallProgressValue} />
                </div>

                <div className="mt-2 flex items-center justify-end gap-3 text-xs font-bold text-white/70">
                  <span>{overallProgressValue}%</span>
                </div>

                <div className="mt-6 rounded-[20px] border-[3px] border-black bg-[#171717] p-5">
                  <p className="text-2xl font-black leading-9">{currentMeta.question}</p>
                </div>

                {currentMeta.mode === "binary" ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleBusinessNext("A")}
                      className="rounded-[22px] border-[4px] border-black bg-[#111111] p-5 text-left shadow-[0_8px_0_#000] transition-all duration-200 hover:-translate-y-1 hover:bg-[#171717] hover:shadow-[0_12px_0_#000]"
                    >
                      <p className="text-xs font-black tracking-[0.15em] text-[#ffe46a]">
                        OPTION A
                      </p>
                      <p className="mt-3 text-lg font-black leading-8">
                        {currentMeta.optionA}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBusinessNext("B")}
                      className="rounded-[22px] border-[4px] border-black bg-[#111111] p-5 text-left shadow-[0_8px_0_#000] transition-all duration-200 hover:-translate-y-1 hover:bg-[#171717] hover:shadow-[0_12px_0_#000]"
                    >
                      <p className="text-xs font-black tracking-[0.15em] text-[#ffe46a]">
                        OPTION B
                      </p>
                      <p className="mt-3 text-lg font-black leading-8">
                        {currentMeta.optionB}
                      </p>
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3">
                    {LIKERT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleLikertNext(option.value)}
                        className="rounded-[18px] border-[4px] border-black bg-[#111111] px-5 py-4 text-left text-sm font-black shadow-[0_6px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#171717] hover:shadow-[0_8px_0_#000]"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={step === "mbti" && mbtiIndex === 0}
                  className="rounded-[16px] border-[3px] border-black bg-white px-4 py-2 text-sm font-black text-black shadow-[0_4px_0_#000] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  戻る
                </button>

                <button
                  type="button"
                  onClick={handleManualSaveDraft}
                  disabled={draftSaving}
                  className="rounded-[16px] border-[3px] border-black bg-[#f3c400] px-4 py-2 text-sm font-black text-black shadow-[0_4px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_6px_0_#000] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {draftSaving ? "保存中..." : "一時保存"}
                </button>
              </div>
            </PanelFrame>
          )}

          {step === "confirm" && (
            <PanelFrame title="CONFIRM RESULT">
              <div className="mb-5 rounded-[20px] border-[3px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-black tracking-[0.15em] text-white/60">
                    全設問回答完了
                  </p>
                  <p className="text-sm font-black text-[#ffe46a]">
                    {answeredQuestionCount} / {totalQuestionCount}
                  </p>
                </div>
                <div className="mt-3">
                  <ProgressBar value={100} />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-[24px] border-[4px] border-black bg-[#111111] p-5 shadow-[0_8px_0_#000]">
                  <p className="text-xs font-black tracking-[0.15em] text-white/55">
                    MBTI
                  </p>
                  <p className="mt-3 text-4xl font-black text-[#ffe46a]">
                    {mbtiResult?.typeCode || "-"}
                  </p>
                  <p className="mt-2 text-sm font-bold text-white/75">
                    {getMbtiTypeName(mbtiResult?.typeCode)}
                  </p>
                  <p className="mt-4 text-sm font-bold text-white/80">
                    Confidence: {mbtiConfidence?.score ?? "-"}%
                  </p>
                  <p className="mt-2 text-sm font-bold text-white/70">
                    {mbtiConfidence?.summary || "-"}
                  </p>
                </div>

                <div className="rounded-[24px] border-[4px] border-black bg-[#111111] p-5 shadow-[0_8px_0_#000]">
                  <p className="text-xs font-black tracking-[0.15em] text-white/55">
                    BUSINESS TYPE
                  </p>
                  <p className="mt-3 text-4xl font-black text-[#ffe46a]">
                    {businessResult?.typeCode || "-"}
                  </p>
                  <p className="mt-2 text-sm font-bold text-white/75">
                    {getBusinessTypeName(businessResult?.typeCode)}
                  </p>
                  <p className="mt-4 text-sm font-bold text-white/80">
                    Confidence: {businessConfidence?.score ?? "-"}%
                  </p>
                  <p className="mt-2 text-sm font-bold text-white/70">
                    {businessConfidence?.summary || "-"}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveDiagnosis}
                  disabled={saving}
                  className="rounded-[16px] border-[3px] border-black bg-[#f3c400] px-5 py-3 text-sm font-black text-black shadow-[0_6px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_8px_0_#000] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存して結果へ進む"}
                </button>

                <button
                  type="button"
                  onClick={handleManualSaveDraft}
                  disabled={draftSaving}
                  className="rounded-[16px] border-[3px] border-black bg-[#111111] px-5 py-3 text-sm font-black text-white shadow-[0_6px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1d1d1d] hover:shadow-[0_8px_0_#000] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {draftSaving ? "保存中..." : "一時保存"}
                </button>

                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-[16px] border-[3px] border-black bg-white px-5 py-3 text-sm font-black text-black shadow-[0_6px_0_#000]"
                >
                  戻る
                </button>
              </div>
            </PanelFrame>
          )}
        </div>
      </main>

      <P4BottomNav role={normalizedRole} />
    </>
  );
}