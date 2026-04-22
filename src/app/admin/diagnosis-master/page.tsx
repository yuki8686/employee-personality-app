"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  businessConsistencyQuestions,
  businessQuestions,
  businessReverseQuestions,
  mbtiConsistencyQuestions,
  mbtiQuestions,
  mbtiReverseQuestions,
} from "@/lib/diagnosis/master";
import type {
  BusinessLikertQuestion,
  BusinessQuestion,
  MbtiLikertQuestion,
  MbtiQuestion,
} from "@/lib/diagnosis/types";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";

type UserRow = {
  uid: string;
  name?: string;
  email?: string;
  role?: string;
  departmentName?: string;
  status?: string;
};

type TabKey =
  | "mbti"
  | "mbtiReverse"
  | "mbtiConsistency"
  | "business"
  | "businessReverse"
  | "businessConsistency";

type NoticeType = "success" | "error" | "info";

type MbtiQuestionRow = MbtiQuestion;
type BusinessQuestionRow = BusinessQuestion;
type MbtiLikertQuestionRow = MbtiLikertQuestion;
type BusinessLikertQuestionRow = BusinessLikertQuestion;

type IndexedRow<T> = {
  originalIndex: number;
  row: T;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeAxis(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || "未設定";
}

function normalizeId(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function normalizeWeight(value: unknown) {
  return typeof value === "number" && !Number.isNaN(value) ? value : 1;
}

function normalizeReverse(value: unknown) {
  return value === true;
}

function normalizeDirection(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || "未設定";
}

function normalizeRoleForNav(value?: string) {
  return (value || "").trim().toLowerCase();
}

function sortStringsJa(a: string, b: string) {
  return a.localeCompare(b, "ja");
}

function sortByOrderThenId<T extends { id: string; order?: number }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return sortStringsJa(a.id, b.id);
  });
}

function buildMbtiSeedRows(): MbtiQuestionRow[] {
  return (mbtiQuestions as Array<Record<string, unknown>>).map((question, index) => ({
    id: normalizeId(question?.id, `mbti-${index + 1}`),
    text: normalizeText(question?.text),
    axis: normalizeAxis(question?.axis) as MbtiQuestion["axis"],
    weight: normalizeWeight(question?.weight),
    reverse: normalizeReverse(question?.reverse),
  }));
}

function buildBusinessSeedRows(): BusinessQuestionRow[] {
  return (businessQuestions as Array<Record<string, unknown>>).map(
    (question, index) => ({
      id: normalizeId(question?.id, `business-${index + 1}`),
      question: normalizeText(question?.question),
      optionA: normalizeText(question?.optionA),
      optionB: normalizeText(question?.optionB),
      axis: normalizeAxis(question?.axis) as BusinessQuestion["axis"],
      weight: normalizeWeight(question?.weight),
      reverse: normalizeReverse(question?.reverse),
    })
  );
}

function buildMbtiReverseSeedRows(): MbtiLikertQuestionRow[] {
  return (mbtiReverseQuestions as Array<Record<string, unknown>>).map(
    (question, index) => ({
      id: normalizeId(question?.id, `mbti-reverse-${index + 1}`),
      axis: normalizeAxis(question?.axis) as MbtiLikertQuestion["axis"],
      direction: normalizeDirection(
        question?.direction
      ) as MbtiLikertQuestion["direction"],
      question: normalizeText(question?.question),
    })
  );
}

function buildMbtiConsistencySeedRows(): MbtiLikertQuestionRow[] {
  return (mbtiConsistencyQuestions as Array<Record<string, unknown>>).map(
    (question, index) => ({
      id: normalizeId(question?.id, `mbti-consistency-${index + 1}`),
      axis: normalizeAxis(question?.axis) as MbtiLikertQuestion["axis"],
      direction: normalizeDirection(
        question?.direction
      ) as MbtiLikertQuestion["direction"],
      question: normalizeText(question?.question),
    })
  );
}

function buildBusinessReverseSeedRows(): BusinessLikertQuestionRow[] {
  return (businessReverseQuestions as Array<Record<string, unknown>>).map(
    (question, index) => ({
      id: normalizeId(question?.id, `business-reverse-${index + 1}`),
      axis: normalizeAxis(question?.axis) as BusinessLikertQuestion["axis"],
      direction: normalizeDirection(
        question?.direction
      ) as BusinessLikertQuestion["direction"],
      question: normalizeText(question?.question),
    })
  );
}

function buildBusinessConsistencySeedRows(): BusinessLikertQuestionRow[] {
  return (businessConsistencyQuestions as Array<Record<string, unknown>>).map(
    (question, index) => ({
      id: normalizeId(question?.id, `business-consistency-${index + 1}`),
      axis: normalizeAxis(question?.axis) as BusinessLikertQuestion["axis"],
      direction: normalizeDirection(
        question?.direction
      ) as BusinessLikertQuestion["direction"],
      question: normalizeText(question?.question),
    })
  );
}

function createNewMbtiQuestion(nextIndex: number): MbtiQuestionRow {
  return {
    id: `mbti-custom-${nextIndex}`,
    text: "",
    axis: "EI",
    weight: 1,
    reverse: false,
  };
}

function createNewBusinessQuestion(nextIndex: number): BusinessQuestionRow {
  return {
    id: `business-custom-${nextIndex}`,
    question: "",
    optionA: "",
    optionB: "",
    axis: "MP",
    weight: 1,
    reverse: false,
  };
}

function createNewMbtiLikertQuestion(
  prefix: "mbti-reverse" | "mbti-consistency",
  nextIndex: number
): MbtiLikertQuestionRow {
  return {
    id: `${prefix}-custom-${nextIndex}`,
    axis: "EI",
    direction: "E",
    question: "",
  };
}

function createNewBusinessLikertQuestion(
  prefix: "business-reverse" | "business-consistency",
  nextIndex: number
): BusinessLikertQuestionRow {
  return {
    id: `${prefix}-custom-${nextIndex}`,
    axis: "MP",
    direction: "M",
    question: "",
  };
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
      className={`relative overflow-hidden rounded-[28px] border-[4px] border-black bg-[#171717] shadow-[0_10px_0_#000] md:shadow-[0_14px_0_#000] ${className}`}
    >
      <div className="absolute left-0 top-0 h-3 w-full bg-[#f3c400]" />
      <div className="absolute right-4 top-4 h-4 w-4 rotate-45 border-2 border-black bg-[#ffe46a]" />
      <div className="relative p-5 pt-7 md:p-7 md:pt-9">
        {title && (
          <div className="mb-4 inline-flex rounded-[999px] border-[3px] border-black bg-[#f3c400] px-3 py-1 text-xs font-black text-black shadow-[0_4px_0_#000] md:mb-5 md:px-4 md:py-1.5 md:text-sm md:shadow-[0_5px_0_#000]">
            {title}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border-[4px] border-black bg-[#111111] p-5 shadow-[0_8px_0_#000] md:p-6 md:shadow-[0_10px_0_#000]">
      <p className="text-xs font-black tracking-[0.15em] text-white/55 md:text-[13px]">
        {label}
      </p>
      <div className="mt-2 md:mt-3">{value}</div>
    </div>
  );
}

function NoticeBox({
  type,
  message,
}: {
  type: NoticeType;
  message: string;
}) {
  const className =
    type === "success"
      ? "bg-[#fff27a] text-black"
      : type === "error"
        ? "bg-[#ffd0d0] text-[#7b1111]"
        : "bg-[#d9f7ff] text-black";

  return (
    <div
      className={`rounded-[18px] border-[3px] border-black px-4 py-3 text-[13px] font-black leading-6 shadow-[0_5px_0_#000] md:rounded-[20px] md:shadow-[0_6px_0_#000] ${className}`}
    >
      {message}
    </div>
  );
}

export default function DiagnosisMasterPage() {
  const router = useRouter();
  const pageTopRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [meRole, setMeRole] = useState("");
  const [keyword, setKeyword] = useState("");
  const [tab, setTab] = useState<TabKey>("mbti");
  const [axisFilter, setAxisFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<NoticeType>("info");
  const [saving, setSaving] = useState(false);

  const [mbtiRows, setMbtiRows] = useState<MbtiQuestionRow[]>([]);
  const [businessRows, setBusinessRows] = useState<BusinessQuestionRow[]>([]);
  const [mbtiReverseRows, setMbtiReverseRows] = useState<MbtiLikertQuestionRow[]>([]);
  const [mbtiConsistencyRows, setMbtiConsistencyRows] = useState<
    MbtiLikertQuestionRow[]
  >([]);
  const [businessReverseRows, setBusinessReverseRows] = useState<
    BusinessLikertQuestionRow[]
  >([]);
  const [businessConsistencyRows, setBusinessConsistencyRows] = useState<
    BusinessLikertQuestionRow[]
  >([]);

  const [initialMbtiRowsJson, setInitialMbtiRowsJson] = useState("");
  const [initialBusinessRowsJson, setInitialBusinessRowsJson] = useState("");
  const [initialMbtiReverseRowsJson, setInitialMbtiReverseRowsJson] = useState("");
  const [initialMbtiConsistencyRowsJson, setInitialMbtiConsistencyRowsJson] =
    useState("");
  const [initialBusinessReverseRowsJson, setInitialBusinessReverseRowsJson] =
    useState("");
  const [initialBusinessConsistencyRowsJson, setInitialBusinessConsistencyRowsJson] =
    useState("");

  const [dbSummary, setDbSummary] = useState({
    users: 0,
    diagnosticsCurrent: 0,
    diagnosticsHistory: 0,
    compatibilitiesRoots: 0,
    masterMbti: 0,
    masterBusiness: 0,
    masterMbtiReverse: 0,
    masterMbtiConsistency: 0,
    masterBusinessReverse: 0,
    masterBusinessConsistency: 0,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const myDoc = usersSnap.docs.find((d) => d.id === currentUser.uid);

        if (!myDoc) {
          router.push("/home");
          return;
        }

        const myData = myDoc.data() as UserRow;
        const normalizedRole = (myData.role || "").toLowerCase();
        setMeRole(normalizedRole);

        if (normalizedRole !== "admin") {
          router.push("/home");
          return;
        }

        const [
          diagnosticsCurrentSnap,
          diagnosticsHistorySnap,
          compatibilitiesSnap,
          masterMbtiSnap,
          masterBusinessSnap,
          masterMbtiReverseSnap,
          masterMbtiConsistencySnap,
          masterBusinessReverseSnap,
          masterBusinessConsistencySnap,
        ] = await Promise.all([
          getDocs(collection(db, "diagnostics_current")),
          getDocs(collection(db, "diagnostics_history")),
          getDocs(collection(db, "compatibilities")),
          getDocs(collection(db, "diagnosis_master_mbti_questions")),
          getDocs(collection(db, "diagnosis_master_business_questions")),
          getDocs(collection(db, "diagnosis_master_mbti_reverse_questions")),
          getDocs(collection(db, "diagnosis_master_mbti_consistency_questions")),
          getDocs(collection(db, "diagnosis_master_business_reverse_questions")),
          getDocs(
            collection(db, "diagnosis_master_business_consistency_questions")
          ),
        ]);

        const loadedMbtiRows =
          masterMbtiSnap.size > 0
            ? sortByOrderThenId(
                masterMbtiSnap.docs.map((item) => {
                  const data = item.data() as Record<string, unknown>;
                  return {
                    id: normalizeId(data.id, item.id),
                    text: normalizeText(data.text),
                    axis: normalizeAxis(data.axis) as MbtiQuestion["axis"],
                    weight: normalizeWeight(data.weight),
                    reverse: normalizeReverse(data.reverse),
                    order:
                      typeof data.order === "number" ? data.order : undefined,
                  };
                })
              ).map(({ order: _order, ...row }) => row)
            : buildMbtiSeedRows();

        const loadedBusinessRows =
          masterBusinessSnap.size > 0
            ? sortByOrderThenId(
                masterBusinessSnap.docs.map((item) => {
                  const data = item.data() as Record<string, unknown>;
                  return {
                    id: normalizeId(data.id, item.id),
                    question: normalizeText(data.question),
                    optionA: normalizeText(data.optionA),
                    optionB: normalizeText(data.optionB),
                    axis: normalizeAxis(data.axis) as BusinessQuestion["axis"],
                    weight: normalizeWeight(data.weight),
                    reverse: normalizeReverse(data.reverse),
                    order:
                      typeof data.order === "number" ? data.order : undefined,
                  };
                })
              ).map(({ order: _order, ...row }) => row)
            : buildBusinessSeedRows();

        const loadedMbtiReverseRows =
          masterMbtiReverseSnap.size > 0
            ? sortByOrderThenId(
                masterMbtiReverseSnap.docs.map((item) => {
                  const data = item.data() as Record<string, unknown>;
                  return {
                    id: normalizeId(data.id, item.id),
                    axis: normalizeAxis(data.axis) as MbtiLikertQuestion["axis"],
                    direction: normalizeDirection(
                      data.direction
                    ) as MbtiLikertQuestion["direction"],
                    question: normalizeText(data.question),
                    order:
                      typeof data.order === "number" ? data.order : undefined,
                  };
                })
              ).map(({ order: _order, ...row }) => row)
            : buildMbtiReverseSeedRows();

        const loadedMbtiConsistencyRows =
          masterMbtiConsistencySnap.size > 0
            ? sortByOrderThenId(
                masterMbtiConsistencySnap.docs.map((item) => {
                  const data = item.data() as Record<string, unknown>;
                  return {
                    id: normalizeId(data.id, item.id),
                    axis: normalizeAxis(data.axis) as MbtiLikertQuestion["axis"],
                    direction: normalizeDirection(
                      data.direction
                    ) as MbtiLikertQuestion["direction"],
                    question: normalizeText(data.question),
                    order:
                      typeof data.order === "number" ? data.order : undefined,
                  };
                })
              ).map(({ order: _order, ...row }) => row)
            : buildMbtiConsistencySeedRows();

        const loadedBusinessReverseRows =
          masterBusinessReverseSnap.size > 0
            ? sortByOrderThenId(
                masterBusinessReverseSnap.docs.map((item) => {
                  const data = item.data() as Record<string, unknown>;
                  return {
                    id: normalizeId(data.id, item.id),
                    axis: normalizeAxis(
                      data.axis
                    ) as BusinessLikertQuestion["axis"],
                    direction: normalizeDirection(
                      data.direction
                    ) as BusinessLikertQuestion["direction"],
                    question: normalizeText(data.question),
                    order:
                      typeof data.order === "number" ? data.order : undefined,
                  };
                })
              ).map(({ order: _order, ...row }) => row)
            : buildBusinessReverseSeedRows();

        const loadedBusinessConsistencyRows =
          masterBusinessConsistencySnap.size > 0
            ? sortByOrderThenId(
                masterBusinessConsistencySnap.docs.map((item) => {
                  const data = item.data() as Record<string, unknown>;
                  return {
                    id: normalizeId(data.id, item.id),
                    axis: normalizeAxis(
                      data.axis
                    ) as BusinessLikertQuestion["axis"],
                    direction: normalizeDirection(
                      data.direction
                    ) as BusinessLikertQuestion["direction"],
                    question: normalizeText(data.question),
                    order:
                      typeof data.order === "number" ? data.order : undefined,
                  };
                })
              ).map(({ order: _order, ...row }) => row)
            : buildBusinessConsistencySeedRows();

        setMbtiRows(loadedMbtiRows);
        setBusinessRows(loadedBusinessRows);
        setMbtiReverseRows(loadedMbtiReverseRows);
        setMbtiConsistencyRows(loadedMbtiConsistencyRows);
        setBusinessReverseRows(loadedBusinessReverseRows);
        setBusinessConsistencyRows(loadedBusinessConsistencyRows);

        setInitialMbtiRowsJson(JSON.stringify(loadedMbtiRows));
        setInitialBusinessRowsJson(JSON.stringify(loadedBusinessRows));
        setInitialMbtiReverseRowsJson(JSON.stringify(loadedMbtiReverseRows));
        setInitialMbtiConsistencyRowsJson(
          JSON.stringify(loadedMbtiConsistencyRows)
        );
        setInitialBusinessReverseRowsJson(
          JSON.stringify(loadedBusinessReverseRows)
        );
        setInitialBusinessConsistencyRowsJson(
          JSON.stringify(loadedBusinessConsistencyRows)
        );

        setDbSummary({
          users: usersSnap.size,
          diagnosticsCurrent: diagnosticsCurrentSnap.size,
          diagnosticsHistory: diagnosticsHistorySnap.size,
          compatibilitiesRoots: compatibilitiesSnap.size,
          masterMbti: masterMbtiSnap.size,
          masterBusiness: masterBusinessSnap.size,
          masterMbtiReverse: masterMbtiReverseSnap.size,
          masterMbtiConsistency: masterMbtiConsistencySnap.size,
          masterBusinessReverse: masterBusinessReverseSnap.size,
          masterBusinessConsistency: masterBusinessConsistencySnap.size,
        });
      } catch (error) {
        console.error("diagnosis master 読み込み失敗:", error);
        setMessageType("error");
        setMessage("診断マスタの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const normalizedRole = normalizeRoleForNav(meRole);

  const currentRows = useMemo(() => {
    switch (tab) {
      case "mbti":
        return mbtiRows;
      case "mbtiReverse":
        return mbtiReverseRows;
      case "mbtiConsistency":
        return mbtiConsistencyRows;
      case "business":
        return businessRows;
      case "businessReverse":
        return businessReverseRows;
      case "businessConsistency":
        return businessConsistencyRows;
      default:
        return [];
    }
  }, [
    tab,
    mbtiRows,
    mbtiReverseRows,
    mbtiConsistencyRows,
    businessRows,
    businessReverseRows,
    businessConsistencyRows,
  ]);

  const axisOptions = useMemo(() => {
    const values = Array.from(new Set(currentRows.map((row) => row.axis))).sort((a, b) =>
      sortStringsJa(a, b)
    );
    return values;
  }, [currentRows]);

  const filteredMbtiRows = useMemo<IndexedRow<MbtiQuestionRow>[]>(() => {
    const q = keyword.trim().toLowerCase();
    return mbtiRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        const matchesKeyword =
          q === "" || `${row.id} ${row.text} ${row.axis}`.toLowerCase().includes(q);
        const matchesAxis = axisFilter === "all" || row.axis === axisFilter;
        return matchesKeyword && matchesAxis;
      });
  }, [axisFilter, keyword, mbtiRows]);

  const filteredBusinessRows = useMemo<IndexedRow<BusinessQuestionRow>[]>(() => {
    const q = keyword.trim().toLowerCase();
    return businessRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        const matchesKeyword =
          q === "" ||
          `${row.id} ${row.question} ${row.optionA} ${row.optionB} ${row.axis}`
            .toLowerCase()
            .includes(q);
        const matchesAxis = axisFilter === "all" || row.axis === axisFilter;
        return matchesKeyword && matchesAxis;
      });
  }, [axisFilter, keyword, businessRows]);

  const filteredMbtiReverseRows = useMemo<IndexedRow<MbtiLikertQuestionRow>[]>(() => {
    const q = keyword.trim().toLowerCase();
    return mbtiReverseRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        const matchesKeyword =
          q === "" ||
          `${row.id} ${row.question} ${row.axis} ${row.direction}`
            .toLowerCase()
            .includes(q);
        const matchesAxis = axisFilter === "all" || row.axis === axisFilter;
        return matchesKeyword && matchesAxis;
      });
  }, [axisFilter, keyword, mbtiReverseRows]);

  const filteredMbtiConsistencyRows = useMemo<
    IndexedRow<MbtiLikertQuestionRow>[]
  >(() => {
    const q = keyword.trim().toLowerCase();
    return mbtiConsistencyRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        const matchesKeyword =
          q === "" ||
          `${row.id} ${row.question} ${row.axis} ${row.direction}`
            .toLowerCase()
            .includes(q);
        const matchesAxis = axisFilter === "all" || row.axis === axisFilter;
        return matchesKeyword && matchesAxis;
      });
  }, [axisFilter, keyword, mbtiConsistencyRows]);

  const filteredBusinessReverseRows = useMemo<
    IndexedRow<BusinessLikertQuestionRow>[]
  >(() => {
    const q = keyword.trim().toLowerCase();
    return businessReverseRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        const matchesKeyword =
          q === "" ||
          `${row.id} ${row.question} ${row.axis} ${row.direction}`
            .toLowerCase()
            .includes(q);
        const matchesAxis = axisFilter === "all" || row.axis === axisFilter;
        return matchesKeyword && matchesAxis;
      });
  }, [axisFilter, keyword, businessReverseRows]);

  const filteredBusinessConsistencyRows = useMemo<
    IndexedRow<BusinessLikertQuestionRow>[]
  >(() => {
    const q = keyword.trim().toLowerCase();
    return businessConsistencyRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        const matchesKeyword =
          q === "" ||
          `${row.id} ${row.question} ${row.axis} ${row.direction}`
            .toLowerCase()
            .includes(q);
        const matchesAxis = axisFilter === "all" || row.axis === axisFilter;
        return matchesKeyword && matchesAxis;
      });
  }, [axisFilter, keyword, businessConsistencyRows]);

  const countsByAxis = useMemo(() => {
    const map = new Map<string, number>();
    currentRows.forEach((row) => {
      map.set(row.axis, (map.get(row.axis) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => sortStringsJa(a[0], b[0]));
  }, [currentRows]);

  function duplicateIdSet<T extends { id: string }>(rows: T[]) {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const id = row.id.trim();
      if (!id) return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id)
    );
  }

  const duplicateMbtiIds = useMemo(() => duplicateIdSet(mbtiRows), [mbtiRows]);
  const duplicateBusinessIds = useMemo(
    () => duplicateIdSet(businessRows),
    [businessRows]
  );
  const duplicateMbtiReverseIds = useMemo(
    () => duplicateIdSet(mbtiReverseRows),
    [mbtiReverseRows]
  );
  const duplicateMbtiConsistencyIds = useMemo(
    () => duplicateIdSet(mbtiConsistencyRows),
    [mbtiConsistencyRows]
  );
  const duplicateBusinessReverseIds = useMemo(
    () => duplicateIdSet(businessReverseRows),
    [businessReverseRows]
  );
  const duplicateBusinessConsistencyIds = useMemo(
    () => duplicateIdSet(businessConsistencyRows),
    [businessConsistencyRows]
  );

  const mbtiInvalidCount = useMemo(() => {
    return mbtiRows.filter((row) => row.id.trim() === "" || row.text.trim() === "")
      .length;
  }, [mbtiRows]);

  const businessInvalidCount = useMemo(() => {
    return businessRows.filter(
      (row) =>
        row.id.trim() === "" ||
        row.question.trim() === "" ||
        row.optionA.trim() === "" ||
        row.optionB.trim() === ""
    ).length;
  }, [businessRows]);

  const mbtiReverseInvalidCount = useMemo(() => {
    return mbtiReverseRows.filter(
      (row) =>
        row.id.trim() === "" ||
        row.question.trim() === "" ||
        row.axis.trim() === "" ||
        row.direction.trim() === ""
    ).length;
  }, [mbtiReverseRows]);

  const mbtiConsistencyInvalidCount = useMemo(() => {
    return mbtiConsistencyRows.filter(
      (row) =>
        row.id.trim() === "" ||
        row.question.trim() === "" ||
        row.axis.trim() === "" ||
        row.direction.trim() === ""
    ).length;
  }, [mbtiConsistencyRows]);

  const businessReverseInvalidCount = useMemo(() => {
    return businessReverseRows.filter(
      (row) =>
        row.id.trim() === "" ||
        row.question.trim() === "" ||
        row.axis.trim() === "" ||
        row.direction.trim() === ""
    ).length;
  }, [businessReverseRows]);

  const businessConsistencyInvalidCount = useMemo(() => {
    return businessConsistencyRows.filter(
      (row) =>
        row.id.trim() === "" ||
        row.question.trim() === "" ||
        row.axis.trim() === "" ||
        row.direction.trim() === ""
    ).length;
  }, [businessConsistencyRows]);

  const activeDuplicateIds = useMemo(() => {
    switch (tab) {
      case "mbti":
        return duplicateMbtiIds;
      case "mbtiReverse":
        return duplicateMbtiReverseIds;
      case "mbtiConsistency":
        return duplicateMbtiConsistencyIds;
      case "business":
        return duplicateBusinessIds;
      case "businessReverse":
        return duplicateBusinessReverseIds;
      case "businessConsistency":
        return duplicateBusinessConsistencyIds;
      default:
        return new Set<string>();
    }
  }, [
    tab,
    duplicateMbtiIds,
    duplicateMbtiReverseIds,
    duplicateMbtiConsistencyIds,
    duplicateBusinessIds,
    duplicateBusinessReverseIds,
    duplicateBusinessConsistencyIds,
  ]);

  const activeInvalidCount = useMemo(() => {
    switch (tab) {
      case "mbti":
        return mbtiInvalidCount;
      case "mbtiReverse":
        return mbtiReverseInvalidCount;
      case "mbtiConsistency":
        return mbtiConsistencyInvalidCount;
      case "business":
        return businessInvalidCount;
      case "businessReverse":
        return businessReverseInvalidCount;
      case "businessConsistency":
        return businessConsistencyInvalidCount;
      default:
        return 0;
    }
  }, [
    tab,
    mbtiInvalidCount,
    mbtiReverseInvalidCount,
    mbtiConsistencyInvalidCount,
    businessInvalidCount,
    businessReverseInvalidCount,
    businessConsistencyInvalidCount,
  ]);

  const hasValidationError =
    activeDuplicateIds.size > 0 || activeInvalidCount > 0;

  const hasUnsavedChanges = useMemo(() => {
    switch (tab) {
      case "mbti":
        return JSON.stringify(mbtiRows) !== initialMbtiRowsJson;
      case "mbtiReverse":
        return JSON.stringify(mbtiReverseRows) !== initialMbtiReverseRowsJson;
      case "mbtiConsistency":
        return (
          JSON.stringify(mbtiConsistencyRows) !== initialMbtiConsistencyRowsJson
        );
      case "business":
        return JSON.stringify(businessRows) !== initialBusinessRowsJson;
      case "businessReverse":
        return (
          JSON.stringify(businessReverseRows) !== initialBusinessReverseRowsJson
        );
      case "businessConsistency":
        return (
          JSON.stringify(businessConsistencyRows) !==
          initialBusinessConsistencyRowsJson
        );
      default:
        return false;
    }
  }, [
    tab,
    mbtiRows,
    mbtiReverseRows,
    mbtiConsistencyRows,
    businessRows,
    businessReverseRows,
    businessConsistencyRows,
    initialMbtiRowsJson,
    initialMbtiReverseRowsJson,
    initialMbtiConsistencyRowsJson,
    initialBusinessRowsJson,
    initialBusinessReverseRowsJson,
    initialBusinessConsistencyRowsJson,
  ]);

  const filteredRows = useMemo(() => {
    switch (tab) {
      case "mbti":
        return filteredMbtiRows;
      case "mbtiReverse":
        return filteredMbtiReverseRows;
      case "mbtiConsistency":
        return filteredMbtiConsistencyRows;
      case "business":
        return filteredBusinessRows;
      case "businessReverse":
        return filteredBusinessReverseRows;
      case "businessConsistency":
        return filteredBusinessConsistencyRows;
      default:
        return [];
    }
  }, [
    tab,
    filteredMbtiRows,
    filteredMbtiReverseRows,
    filteredMbtiConsistencyRows,
    filteredBusinessRows,
    filteredBusinessReverseRows,
    filteredBusinessConsistencyRows,
  ]);

  const handleMbtiChange = (index: number, patch: Partial<MbtiQuestionRow>) => {
    setMbtiRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleBusinessChange = (
    index: number,
    patch: Partial<BusinessQuestionRow>
  ) => {
    setBusinessRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleMbtiLikertChange = (
    target: "reverse" | "consistency",
    index: number,
    patch: Partial<MbtiLikertQuestionRow>
  ) => {
    const setter =
      target === "reverse" ? setMbtiReverseRows : setMbtiConsistencyRows;
    setter((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleBusinessLikertChange = (
    target: "reverse" | "consistency",
    index: number,
    patch: Partial<BusinessLikertQuestionRow>
  ) => {
    const setter =
      target === "reverse" ? setBusinessReverseRows : setBusinessConsistencyRows;
    setter((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleAddRow = () => {
    setMessage("");

    if (tab === "mbti") {
      setMbtiRows((prev) => [...prev, createNewMbtiQuestion(prev.length + 1)]);
      return;
    }

    if (tab === "business") {
      setBusinessRows((prev) => [
        ...prev,
        createNewBusinessQuestion(prev.length + 1),
      ]);
      return;
    }

    if (tab === "mbtiReverse") {
      setMbtiReverseRows((prev) => [
        ...prev,
        createNewMbtiLikertQuestion("mbti-reverse", prev.length + 1),
      ]);
      return;
    }

    if (tab === "mbtiConsistency") {
      setMbtiConsistencyRows((prev) => [
        ...prev,
        createNewMbtiLikertQuestion("mbti-consistency", prev.length + 1),
      ]);
      return;
    }

    if (tab === "businessReverse") {
      setBusinessReverseRows((prev) => [
        ...prev,
        createNewBusinessLikertQuestion("business-reverse", prev.length + 1),
      ]);
      return;
    }

    setBusinessConsistencyRows((prev) => [
      ...prev,
      createNewBusinessLikertQuestion("business-consistency", prev.length + 1),
    ]);
  };

  const handleDeleteRow = (index: number) => {
    setMessage("");

    if (tab === "mbti") {
      setMbtiRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    if (tab === "business") {
      setBusinessRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    if (tab === "mbtiReverse") {
      setMbtiReverseRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    if (tab === "mbtiConsistency") {
      setMbtiConsistencyRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    if (tab === "businessReverse") {
      setBusinessReverseRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    setBusinessConsistencyRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleResetFromLocalMaster = () => {
    setMessageType("info");

    if (tab === "mbti") {
      setMbtiRows(buildMbtiSeedRows());
      setMessage(
        "MBTI 質問をローカルマスタ基準に戻しました。保存すると Firestore に反映されます。"
      );
      return;
    }

    if (tab === "business") {
      setBusinessRows(buildBusinessSeedRows());
      setMessage(
        "ビジネス 質問をローカルマスタ基準に戻しました。保存すると Firestore に反映されます。"
      );
      return;
    }

    if (tab === "mbtiReverse") {
      setMbtiReverseRows(buildMbtiReverseSeedRows());
      setMessage(
        "MBTI 逆転設問をローカルマスタ基準に戻しました。保存すると Firestore に反映されます。"
      );
      return;
    }

    if (tab === "mbtiConsistency") {
      setMbtiConsistencyRows(buildMbtiConsistencySeedRows());
      setMessage(
        "MBTI 整合性チェックをローカルマスタ基準に戻しました。保存すると Firestore に反映されます。"
      );
      return;
    }

    if (tab === "businessReverse") {
      setBusinessReverseRows(buildBusinessReverseSeedRows());
      setMessage(
        "ビジネス 逆転設問をローカルマスタ基準に戻しました。保存すると Firestore に反映されます。"
      );
      return;
    }

    setBusinessConsistencyRows(buildBusinessConsistencySeedRows());
    setMessage(
      "ビジネス 整合性チェックをローカルマスタ基準に戻しました。保存すると Firestore に反映されます。"
    );
  };

  const handleSaveAll = async () => {
    if (hasValidationError) {
      setMessageType("error");
      setMessage("未入力または重複IDがあるため保存できません。");
      return;
    }

    if (!hasUnsavedChanges) {
      setMessageType("info");
      setMessage("変更はありません。");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const batch = writeBatch(db);

      if (tab === "mbti") {
        const currentSnap = await getDocs(
          collection(db, "diagnosis_master_mbti_questions")
        );
        currentSnap.docs.forEach((item) => batch.delete(item.ref));

        mbtiRows.forEach((row, index) => {
          const cleanId = row.id.trim() || `mbti-${index + 1}`;
          const ref = doc(db, "diagnosis_master_mbti_questions", cleanId);
          batch.set(ref, {
            id: cleanId,
            text: row.text.trim(),
            axis: row.axis,
            weight: row.weight,
            reverse: row.reverse,
            order: index + 1,
            updatedAtServer: serverTimestamp(),
          });
        });
      } else if (tab === "business") {
        const currentSnap = await getDocs(
          collection(db, "diagnosis_master_business_questions")
        );
        currentSnap.docs.forEach((item) => batch.delete(item.ref));

        businessRows.forEach((row, index) => {
          const cleanId = row.id.trim() || `business-${index + 1}`;
          const ref = doc(db, "diagnosis_master_business_questions", cleanId);
          batch.set(ref, {
            id: cleanId,
            question: row.question.trim(),
            optionA: row.optionA.trim(),
            optionB: row.optionB.trim(),
            axis: row.axis,
            weight: row.weight,
            reverse: row.reverse,
            order: index + 1,
            updatedAtServer: serverTimestamp(),
          });
        });
      } else if (tab === "mbtiReverse") {
        const currentSnap = await getDocs(
          collection(db, "diagnosis_master_mbti_reverse_questions")
        );
        currentSnap.docs.forEach((item) => batch.delete(item.ref));

        mbtiReverseRows.forEach((row, index) => {
          const cleanId = row.id.trim() || `mbti-reverse-${index + 1}`;
          const ref = doc(db, "diagnosis_master_mbti_reverse_questions", cleanId);
          batch.set(ref, {
            id: cleanId,
            axis: row.axis,
            direction: row.direction,
            question: row.question.trim(),
            order: index + 1,
            updatedAtServer: serverTimestamp(),
          });
        });
      } else if (tab === "mbtiConsistency") {
        const currentSnap = await getDocs(
          collection(db, "diagnosis_master_mbti_consistency_questions")
        );
        currentSnap.docs.forEach((item) => batch.delete(item.ref));

        mbtiConsistencyRows.forEach((row, index) => {
          const cleanId = row.id.trim() || `mbti-consistency-${index + 1}`;
          const ref = doc(
            db,
            "diagnosis_master_mbti_consistency_questions",
            cleanId
          );
          batch.set(ref, {
            id: cleanId,
            axis: row.axis,
            direction: row.direction,
            question: row.question.trim(),
            order: index + 1,
            updatedAtServer: serverTimestamp(),
          });
        });
      } else if (tab === "businessReverse") {
        const currentSnap = await getDocs(
          collection(db, "diagnosis_master_business_reverse_questions")
        );
        currentSnap.docs.forEach((item) => batch.delete(item.ref));

        businessReverseRows.forEach((row, index) => {
          const cleanId = row.id.trim() || `business-reverse-${index + 1}`;
          const ref = doc(
            db,
            "diagnosis_master_business_reverse_questions",
            cleanId
          );
          batch.set(ref, {
            id: cleanId,
            axis: row.axis,
            direction: row.direction,
            question: row.question.trim(),
            order: index + 1,
            updatedAtServer: serverTimestamp(),
          });
        });
      } else {
        const currentSnap = await getDocs(
          collection(db, "diagnosis_master_business_consistency_questions")
        );
        currentSnap.docs.forEach((item) => batch.delete(item.ref));

        businessConsistencyRows.forEach((row, index) => {
          const cleanId = row.id.trim() || `business-consistency-${index + 1}`;
          const ref = doc(
            db,
            "diagnosis_master_business_consistency_questions",
            cleanId
          );
          batch.set(ref, {
            id: cleanId,
            axis: row.axis,
            direction: row.direction,
            question: row.question.trim(),
            order: index + 1,
            updatedAtServer: serverTimestamp(),
          });
        });
      }

      await batch.commit();

      const [
        masterMbtiSnap,
        masterBusinessSnap,
        masterMbtiReverseSnap,
        masterMbtiConsistencySnap,
        masterBusinessReverseSnap,
        masterBusinessConsistencySnap,
      ] = await Promise.all([
        getDocs(collection(db, "diagnosis_master_mbti_questions")),
        getDocs(collection(db, "diagnosis_master_business_questions")),
        getDocs(collection(db, "diagnosis_master_mbti_reverse_questions")),
        getDocs(collection(db, "diagnosis_master_mbti_consistency_questions")),
        getDocs(collection(db, "diagnosis_master_business_reverse_questions")),
        getDocs(collection(db, "diagnosis_master_business_consistency_questions")),
      ]);

      setDbSummary((prev) => ({
        ...prev,
        masterMbti: masterMbtiSnap.size,
        masterBusiness: masterBusinessSnap.size,
        masterMbtiReverse: masterMbtiReverseSnap.size,
        masterMbtiConsistency: masterMbtiConsistencySnap.size,
        masterBusinessReverse: masterBusinessReverseSnap.size,
        masterBusinessConsistency: masterBusinessConsistencySnap.size,
      }));

      if (tab === "mbti") {
        const normalized = mbtiRows.map((row, index) => ({
          ...row,
          id: row.id.trim() || `mbti-${index + 1}`,
          text: row.text.trim(),
        }));
        setMbtiRows(normalized);
        setInitialMbtiRowsJson(JSON.stringify(normalized));
      } else if (tab === "business") {
        const normalized = businessRows.map((row, index) => ({
          ...row,
          id: row.id.trim() || `business-${index + 1}`,
          question: row.question.trim(),
          optionA: row.optionA.trim(),
          optionB: row.optionB.trim(),
        }));
        setBusinessRows(normalized);
        setInitialBusinessRowsJson(JSON.stringify(normalized));
      } else if (tab === "mbtiReverse") {
        const normalized = mbtiReverseRows.map((row, index) => ({
          ...row,
          id: row.id.trim() || `mbti-reverse-${index + 1}`,
          question: row.question.trim(),
        }));
        setMbtiReverseRows(normalized);
        setInitialMbtiReverseRowsJson(JSON.stringify(normalized));
      } else if (tab === "mbtiConsistency") {
        const normalized = mbtiConsistencyRows.map((row, index) => ({
          ...row,
          id: row.id.trim() || `mbti-consistency-${index + 1}`,
          question: row.question.trim(),
        }));
        setMbtiConsistencyRows(normalized);
        setInitialMbtiConsistencyRowsJson(JSON.stringify(normalized));
      } else if (tab === "businessReverse") {
        const normalized = businessReverseRows.map((row, index) => ({
          ...row,
          id: row.id.trim() || `business-reverse-${index + 1}`,
          question: row.question.trim(),
        }));
        setBusinessReverseRows(normalized);
        setInitialBusinessReverseRowsJson(JSON.stringify(normalized));
      } else {
        const normalized = businessConsistencyRows.map((row, index) => ({
          ...row,
          id: row.id.trim() || `business-consistency-${index + 1}`,
          question: row.question.trim(),
        }));
        setBusinessConsistencyRows(normalized);
        setInitialBusinessConsistencyRowsJson(JSON.stringify(normalized));
      }

      setMessageType("success");

      const tabLabelMap: Record<TabKey, string> = {
        mbti: "MBTI 質問",
        mbtiReverse: "MBTI 逆転設問",
        mbtiConsistency: "MBTI 整合性チェック",
        business: "ビジネス 質問",
        businessReverse: "ビジネス 逆転設問",
        businessConsistency: "ビジネス 整合性チェック",
      };

      setMessage(`${tabLabelMap[tab]}を保存しました。`);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("diagnosis master 保存失敗:", error);
      setMessageType("error");
      setMessage("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <P4LoadingScreen
        title="MASTER LOADING"
        subtitle="診断マスタを読み込み中..."
      />
    );
  }

  if (meRole !== "admin") {
    return (
      <>
        <main className="p4g-shell flex min-h-screen items-center justify-center p-4 pb-24 text-white md:pb-6">
          <div className="w-full max-w-3xl rounded-[20px] border-[4px] border-black bg-[#171717] p-5 shadow-[0_8px_0_#000] md:rounded-[24px] md:p-6 md:shadow-[0_10px_0_#000]">
            <h1 className="text-xl font-black md:text-2xl">
              このページは表示できません
            </h1>
            <p className="mt-3 text-[13px] leading-6 text-white/80 md:text-sm">
              admin アカウントのみ利用できます。
            </p>
            <div className="mt-5">
              <Link href="/home" className="p4g-button p4g-button-gold">
                HOMEへ戻る
              </Link>
            </div>
          </div>
        </main>

        <P4BottomNav role={normalizedRole} />
      </>
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-4 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div ref={pageTopRef} className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="min-w-0">
                <div className="inline-flex rounded-[999px] border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.14em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  ADMIN DIAGNOSIS MASTER
                </div>
                <h1 className="mt-3 text-[26px] font-black leading-tight md:mt-4 md:text-4xl">
                  診断マスタ管理
                </h1>
                <p className="mt-2 max-w-4xl text-[13px] font-bold leading-6 text-white/80 md:text-sm md:leading-normal">
                  MBTI / ビジネスの質問マスタ、逆転設問、整合性チェックを編集して
                  Firestore に保存できます。
                </p>
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={normalizedRole} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:mt-5 md:gap-4 xl:grid-cols-5 2xl:grid-cols-10">
              <StatCard
                label="ユーザー数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.users}
                  </p>
                }
              />
              <StatCard
                label="現在診断データ数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.diagnosticsCurrent}
                  </p>
                }
              />
              <StatCard
                label="診断履歴数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.diagnosticsHistory}
                  </p>
                }
              />
              <StatCard
                label="相性ルート数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.compatibilitiesRoots}
                  </p>
                }
              />
              <StatCard
                label="MBTI質問数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.masterMbti}
                  </p>
                }
              />
              <StatCard
                label="ビジネス質問数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.masterBusiness}
                  </p>
                }
              />
              <StatCard
                label="MBTI逆転数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.masterMbtiReverse}
                  </p>
                }
              />
              <StatCard
                label="MBTI整合性数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.masterMbtiConsistency}
                  </p>
                }
              />
              <StatCard
                label="ビジネス逆転数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.masterBusinessReverse}
                  </p>
                }
              />
              <StatCard
                label="ビジネス整合性数"
                value={
                  <p className="text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {dbSummary.masterBusinessConsistency}
                  </p>
                }
              />
            </div>
          </PanelFrame>

          {message && <NoticeBox type={messageType} message={message} />}

          <section className="grid gap-4 md:gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="flex flex-col gap-4 md:gap-5">
              <PanelFrame title="操作パネル">
                <div className="flex flex-wrap gap-2.5 md:gap-3">
                  <button
                    type="button"
                    className={`p4g-button ${tab === "mbti" ? "p4g-button-gold" : "p4g-button-dark"}`}
                    onClick={() => {
                      setTab("mbti");
                      setAxisFilter("all");
                      setMessage("");
                    }}
                  >
                    MBTI 質問
                  </button>

                  <button
                    type="button"
                    className={`p4g-button ${tab === "mbtiReverse" ? "p4g-button-gold" : "p4g-button-dark"}`}
                    onClick={() => {
                      setTab("mbtiReverse");
                      setAxisFilter("all");
                      setMessage("");
                    }}
                  >
                    MBTI 逆転
                  </button>

                  <button
                    type="button"
                    className={`p4g-button ${tab === "mbtiConsistency" ? "p4g-button-gold" : "p4g-button-dark"}`}
                    onClick={() => {
                      setTab("mbtiConsistency");
                      setAxisFilter("all");
                      setMessage("");
                    }}
                  >
                    MBTI 整合性
                  </button>

                  <button
                    type="button"
                    className={`p4g-button ${tab === "business" ? "p4g-button-gold" : "p4g-button-dark"}`}
                    onClick={() => {
                      setTab("business");
                      setAxisFilter("all");
                      setMessage("");
                    }}
                  >
                    ビジネス 質問
                  </button>

                  <button
                    type="button"
                    className={`p4g-button ${tab === "businessReverse" ? "p4g-button-gold" : "p4g-button-dark"}`}
                    onClick={() => {
                      setTab("businessReverse");
                      setAxisFilter("all");
                      setMessage("");
                    }}
                  >
                    ビジネス 逆転
                  </button>

                  <button
                    type="button"
                    className={`p4g-button ${tab === "businessConsistency" ? "p4g-button-gold" : "p4g-button-dark"}`}
                    onClick={() => {
                      setTab("businessConsistency");
                      setAxisFilter("all");
                      setMessage("");
                    }}
                  >
                    ビジネス 整合性
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:mt-5 md:gap-4 md:grid-cols-2">
                  <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]">
                    <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                      検索
                    </label>
                    <input
                      className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none placeholder:text-white/35 md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="ID / 質問文 / 選択肢 / 軸 / 方向で検索"
                    />
                  </div>

                  <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]">
                    <label className="text-[10px] font-black tracking-[0.14em] text-white/55 md:text-xs md:tracking-[0.15em]">
                      軸フィルタ
                    </label>
                    <select
                      className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                      value={axisFilter}
                      onChange={(e) => setAxisFilter(e.target.value)}
                    >
                      <option value="all">全軸</option>
                      {axisOptions.map((axis) => (
                        <option key={axis} value={axis}>
                          {axis}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2.5 md:mt-5 md:gap-3">
                  <button
                    type="button"
                    className="p4g-button p4g-button-gold"
                    onClick={handleAddRow}
                  >
                    {tab === "mbti"
                      ? "MBTI質問を追加"
                      : tab === "mbtiReverse"
                        ? "MBTI逆転設問を追加"
                        : tab === "mbtiConsistency"
                          ? "MBTI整合性設問を追加"
                          : tab === "business"
                            ? "ビジネス質問を追加"
                            : tab === "businessReverse"
                              ? "ビジネス逆転設問を追加"
                              : "ビジネス整合性設問を追加"}
                  </button>

                  <button
                    type="button"
                    className="p4g-button p4g-button-dark"
                    onClick={handleResetFromLocalMaster}
                  >
                    ローカルマスタに戻す
                  </button>

                  <button
                    type="button"
                    className="p4g-button p4g-button-gold"
                    onClick={handleSaveAll}
                    disabled={saving || hasValidationError || !hasUnsavedChanges}
                    title={
                      hasValidationError
                        ? "未入力または重複IDを解消してください"
                        : !hasUnsavedChanges
                          ? "変更がありません"
                          : undefined
                    }
                  >
                    {saving ? "保存中..." : "Firestoreへ保存"}
                  </button>

                  <button
                    type="button"
                    className="p4g-button p4g-button-dark"
                    onClick={() =>
                      window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      })
                    }
                  >
                    ページ上部へ戻る
                  </button>
                </div>

                <div className="mt-4 rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:mt-5 md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[13px] font-bold leading-6 text-white/80 md:text-sm">
                    現在表示中:
                    <span className="ml-2 text-[#ffe46a]">
                      {tab === "mbti"
                        ? "MBTI 質問"
                        : tab === "mbtiReverse"
                          ? "MBTI 逆転設問"
                          : tab === "mbtiConsistency"
                            ? "MBTI 整合性チェック"
                            : tab === "business"
                              ? "ビジネス 質問"
                              : tab === "businessReverse"
                                ? "ビジネス 逆転設問"
                                : "ビジネス 整合性チェック"}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[13px] leading-6 text-white/70 md:mt-2 md:text-sm">
                    フィルタ後件数: {filteredRows.length} / {currentRows.length}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-6 text-white/70 md:mt-2 md:text-sm">
                    未保存変更:{" "}
                    <span className={hasUnsavedChanges ? "text-[#ffe46a]" : "text-white/70"}>
                      {hasUnsavedChanges ? "あり" : "なし"}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[13px] leading-6 text-white/70 md:mt-2 md:text-sm">
                    未入力件数:{" "}
                    <span className={activeInvalidCount > 0 ? "text-[#ffd0d0]" : "text-white/70"}>
                      {activeInvalidCount}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[13px] leading-6 text-white/70 md:mt-2 md:text-sm">
                    重複ID件数:{" "}
                    <span
                      className={activeDuplicateIds.size > 0 ? "text-[#ffd0d0]" : "text-white/70"}
                    >
                      {activeDuplicateIds.size}
                    </span>
                  </p>
                </div>

                {hasValidationError && (
                  <div className="mt-4 rounded-[18px] border-[3px] border-black bg-[#ffd0d0] px-4 py-3 text-[13px] font-black leading-6 text-black shadow-[0_5px_0_#000] md:rounded-[20px] md:shadow-[0_6px_0_#000]">
                    未入力または重複IDがあります。保存前に解消してください。
                  </div>
                )}
              </PanelFrame>

              <PanelFrame title="軸ごとの件数">
                <div className="grid gap-3 md:gap-4">
                  {countsByAxis.map(([axis, count]) => (
                    <div
                      key={axis}
                      className="rounded-[18px] border-[3px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_6px_0_#000]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black md:text-base">{axis}</p>
                        <p className="text-xl font-black leading-none text-[#ffe46a] md:text-2xl">
                          {count}
                        </p>
                      </div>
                    </div>
                  ))}

                  {countsByAxis.length === 0 && (
                    <div className="rounded-[18px] border-[3px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_6px_0_#000]">
                      <p className="text-[13px] leading-6 text-white/80 md:text-sm">
                        軸データがありません。
                      </p>
                    </div>
                  )}
                </div>
              </PanelFrame>
            </div>

            <PanelFrame title="設問編集">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-4">
                <h2 className="text-xl font-black leading-tight md:text-2xl">
                  {tab === "mbti"
                    ? "MBTI質問編集"
                    : tab === "mbtiReverse"
                      ? "MBTI逆転設問編集"
                      : tab === "mbtiConsistency"
                        ? "MBTI整合性設問編集"
                        : tab === "business"
                          ? "ビジネス質問編集"
                          : tab === "businessReverse"
                            ? "ビジネス逆転設問編集"
                            : "ビジネス整合性設問編集"}
                </h2>
                <div className="w-fit rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1.5 text-[13px] font-black text-black shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-sm md:shadow-[0_4px_0_#000]">
                  {filteredRows.length}件
                </div>
              </div>

              <div className="grid gap-3 md:gap-4">
                {tab === "mbti" &&
                  filteredMbtiRows.map(({ row, originalIndex }, visibleIndex) => {
                    const isDuplicate = duplicateMbtiIds.has(row.id.trim());
                    const hasEmpty = row.id.trim() === "" || row.text.trim() === "";

                    return (
                      <div
                        key={`mbti-${originalIndex}`}
                        className={`rounded-[20px] border-[4px] border-black p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000] ${
                          isDuplicate || hasEmpty ? "bg-[#241313]" : "bg-[#111111]"
                        }`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
                          <p className="text-[13px] font-black text-white/60 md:text-sm">
                            MBTI Q{visibleIndex + 1}
                          </p>
                          <button
                            type="button"
                            className="rounded-full border-[3px] border-black bg-[#ffd0d0] px-3 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:text-xs md:shadow-[0_4px_0_#000]"
                            onClick={() => handleDeleteRow(originalIndex)}
                          >
                            削除
                          </button>
                        </div>

                        <div className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_0.7fr_0.5fr_auto]">
                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              ID
                            </p>
                            <input
                              className={`mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                                row.id.trim() === "" || isDuplicate ? "border-[#ff9d9d]" : ""
                              }`}
                              value={row.id}
                              onChange={(e) =>
                                handleMbtiChange(originalIndex, { id: e.target.value })
                              }
                            />
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              軸
                            </p>
                            <select
                              className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                              value={row.axis}
                              onChange={(e) =>
                                handleMbtiChange(originalIndex, {
                                  axis: e.target.value as MbtiQuestion["axis"],
                                })
                              }
                            >
                              {["EI", "SN", "TF", "JP"].map((axis) => (
                                <option key={axis} value={axis}>
                                  {axis}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              重み
                            </p>
                            <input
                              className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                              type="number"
                              min={0}
                              step="0.1"
                              value={row.weight}
                              onChange={(e) =>
                                handleMbtiChange(originalIndex, {
                                  weight: Number(e.target.value || 1),
                                })
                              }
                            />
                          </div>

                          <div className="flex items-end">
                            <label className="flex items-center gap-2 rounded-[14px] border-[3px] border-black bg-white px-3 py-2.5 text-[13px] font-black text-black shadow-[0_3px_0_#000] md:rounded-[16px] md:px-3 md:py-3 md:text-sm md:shadow-[0_4px_0_#000]">
                              <input
                                type="checkbox"
                                checked={row.reverse}
                                onChange={(e) =>
                                  handleMbtiChange(originalIndex, {
                                    reverse: e.target.checked,
                                  })
                                }
                              />
                              反転
                            </label>
                          </div>
                        </div>

                        <div className="mt-3 md:mt-4">
                          <p className="text-[10px] font-black text-white/60 md:text-xs">
                            質問文
                          </p>
                          <textarea
                            className={`mt-2 min-h-[104px] w-full resize-y rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:min-h-[120px] md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                              row.text.trim() === "" ? "border-[#ff9d9d]" : ""
                            }`}
                            value={row.text}
                            onChange={(e) =>
                              handleMbtiChange(originalIndex, { text: e.target.value })
                            }
                          />
                        </div>

                        {(isDuplicate || hasEmpty) && (
                          <div className="mt-3 text-[11px] font-black leading-5 text-[#ffd0d0] md:text-xs">
                            {isDuplicate ? "IDが重複しています。 " : ""}
                            {hasEmpty ? "必須項目が未入力です。" : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {tab === "business" &&
                  filteredBusinessRows.map(({ row, originalIndex }, visibleIndex) => {
                    const isDuplicate = duplicateBusinessIds.has(row.id.trim());
                    const hasEmpty =
                      row.id.trim() === "" ||
                      row.question.trim() === "" ||
                      row.optionA.trim() === "" ||
                      row.optionB.trim() === "";

                    return (
                      <div
                        key={`business-${originalIndex}`}
                        className={`rounded-[20px] border-[4px] border-black p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000] ${
                          isDuplicate || hasEmpty ? "bg-[#241313]" : "bg-[#111111]"
                        }`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
                          <p className="text-[13px] font-black text-white/60 md:text-sm">
                            ビジネス Q{visibleIndex + 1}
                          </p>
                          <button
                            type="button"
                            className="rounded-full border-[3px] border-black bg-[#ffd0d0] px-3 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:text-xs md:shadow-[0_4px_0_#000]"
                            onClick={() => handleDeleteRow(originalIndex)}
                          >
                            削除
                          </button>
                        </div>

                        <div className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_0.7fr_0.5fr_auto]">
                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              ID
                            </p>
                            <input
                              className={`mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                                row.id.trim() === "" || isDuplicate ? "border-[#ff9d9d]" : ""
                              }`}
                              value={row.id}
                              onChange={(e) =>
                                handleBusinessChange(originalIndex, {
                                  id: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              軸
                            </p>
                            <select
                              className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                              value={row.axis}
                              onChange={(e) =>
                                handleBusinessChange(originalIndex, {
                                  axis: e.target.value as BusinessQuestion["axis"],
                                })
                              }
                            >
                              {["MP", "QR", "VT", "CS"].map((axis) => (
                                <option key={axis} value={axis}>
                                  {axis}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              重み
                            </p>
                            <input
                              className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                              type="number"
                              min={0}
                              step="0.1"
                              value={row.weight}
                              onChange={(e) =>
                                handleBusinessChange(originalIndex, {
                                  weight: Number(e.target.value || 1),
                                })
                              }
                            />
                          </div>

                          <div className="flex items-end">
                            <label className="flex items-center gap-2 rounded-[14px] border-[3px] border-black bg-white px-3 py-2.5 text-[13px] font-black text-black shadow-[0_3px_0_#000] md:rounded-[16px] md:px-3 md:py-3 md:text-sm md:shadow-[0_4px_0_#000]">
                              <input
                                type="checkbox"
                                checked={row.reverse}
                                onChange={(e) =>
                                  handleBusinessChange(originalIndex, {
                                    reverse: e.target.checked,
                                  })
                                }
                              />
                              反転
                            </label>
                          </div>
                        </div>

                        <div className="mt-3 md:mt-4">
                          <p className="text-[10px] font-black text-white/60 md:text-xs">
                            質問文
                          </p>
                          <textarea
                            className={`mt-2 min-h-[96px] w-full resize-y rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:min-h-[100px] md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                              row.question.trim() === "" ? "border-[#ff9d9d]" : ""
                            }`}
                            value={row.question}
                            onChange={(e) =>
                              handleBusinessChange(originalIndex, {
                                question: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="mt-3 grid gap-3 md:mt-4 md:gap-4 lg:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              A選択肢
                            </p>
                            <textarea
                              className={`mt-2 min-h-[96px] w-full resize-y rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:min-h-[100px] md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                                row.optionA.trim() === "" ? "border-[#ff9d9d]" : ""
                              }`}
                              value={row.optionA}
                              onChange={(e) =>
                                handleBusinessChange(originalIndex, {
                                  optionA: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              B選択肢
                            </p>
                            <textarea
                              className={`mt-2 min-h-[96px] w-full resize-y rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:min-h-[100px] md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                                row.optionB.trim() === "" ? "border-[#ff9d9d]" : ""
                              }`}
                              value={row.optionB}
                              onChange={(e) =>
                                handleBusinessChange(originalIndex, {
                                  optionB: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        {(isDuplicate || hasEmpty) && (
                          <div className="mt-3 text-[11px] font-black leading-5 text-[#ffd0d0] md:text-xs">
                            {isDuplicate ? "IDが重複しています。 " : ""}
                            {hasEmpty ? "必須項目が未入力です。" : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {(tab === "mbtiReverse" || tab === "mbtiConsistency") &&
                  (tab === "mbtiReverse"
                    ? filteredMbtiReverseRows
                    : filteredMbtiConsistencyRows
                  ).map(({ row, originalIndex }, visibleIndex) => {
                    const activeSet =
                      tab === "mbtiReverse"
                        ? duplicateMbtiReverseIds
                        : duplicateMbtiConsistencyIds;
                    const isDuplicate = activeSet.has(row.id.trim());
                    const hasEmpty =
                      row.id.trim() === "" ||
                      row.question.trim() === "" ||
                      row.axis.trim() === "" ||
                      row.direction.trim() === "";

                    return (
                      <div
                        key={`${tab}-${originalIndex}`}
                        className={`rounded-[20px] border-[4px] border-black p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000] ${
                          isDuplicate || hasEmpty ? "bg-[#241313]" : "bg-[#111111]"
                        }`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
                          <p className="text-[13px] font-black text-white/60 md:text-sm">
                            {tab === "mbtiReverse" ? "MBTI 逆転" : "MBTI 整合性"} Q
                            {visibleIndex + 1}
                          </p>
                          <button
                            type="button"
                            className="rounded-full border-[3px] border-black bg-[#ffd0d0] px-3 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:text-xs md:shadow-[0_4px_0_#000]"
                            onClick={() => handleDeleteRow(originalIndex)}
                          >
                            削除
                          </button>
                        </div>

                        <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              ID
                            </p>
                            <input
                              className={`mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                                row.id.trim() === "" || isDuplicate ? "border-[#ff9d9d]" : ""
                              }`}
                              value={row.id}
                              onChange={(e) =>
                                handleMbtiLikertChange(
                                  tab === "mbtiReverse" ? "reverse" : "consistency",
                                  originalIndex,
                                  { id: e.target.value }
                                )
                              }
                            />
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              軸
                            </p>
                            <select
                              className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                              value={row.axis}
                              onChange={(e) =>
                                handleMbtiLikertChange(
                                  tab === "mbtiReverse" ? "reverse" : "consistency",
                                  originalIndex,
                                  {
                                    axis: e.target.value as MbtiLikertQuestion["axis"],
                                  }
                                )
                              }
                            >
                              {["EI", "SN", "TF", "JP"].map((axis) => (
                                <option key={axis} value={axis}>
                                  {axis}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              方向
                            </p>
                            <select
                              className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                              value={row.direction}
                              onChange={(e) =>
                                handleMbtiLikertChange(
                                  tab === "mbtiReverse" ? "reverse" : "consistency",
                                  originalIndex,
                                  {
                                    direction:
                                      e.target.value as MbtiLikertQuestion["direction"],
                                  }
                                )
                              }
                            >
                              {["E", "I", "S", "N", "T", "F", "J", "P"].map(
                                (direction) => (
                                  <option key={direction} value={direction}>
                                    {direction}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>

                        <div className="mt-3 md:mt-4">
                          <p className="text-[10px] font-black text-white/60 md:text-xs">
                            質問文
                          </p>
                          <textarea
                            className={`mt-2 min-h-[104px] w-full resize-y rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:min-h-[120px] md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                              row.question.trim() === "" ? "border-[#ff9d9d]" : ""
                            }`}
                            value={row.question}
                            onChange={(e) =>
                              handleMbtiLikertChange(
                                tab === "mbtiReverse" ? "reverse" : "consistency",
                                originalIndex,
                                { question: e.target.value }
                              )
                            }
                          />
                        </div>

                        {(isDuplicate || hasEmpty) && (
                          <div className="mt-3 text-[11px] font-black leading-5 text-[#ffd0d0] md:text-xs">
                            {isDuplicate ? "IDが重複しています。 " : ""}
                            {hasEmpty ? "必須項目が未入力です。" : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {(tab === "businessReverse" || tab === "businessConsistency") &&
                  (tab === "businessReverse"
                    ? filteredBusinessReverseRows
                    : filteredBusinessConsistencyRows
                  ).map(({ row, originalIndex }, visibleIndex) => {
                    const activeSet =
                      tab === "businessReverse"
                        ? duplicateBusinessReverseIds
                        : duplicateBusinessConsistencyIds;
                    const isDuplicate = activeSet.has(row.id.trim());
                    const hasEmpty =
                      row.id.trim() === "" ||
                      row.question.trim() === "" ||
                      row.axis.trim() === "" ||
                      row.direction.trim() === "";

                    return (
                      <div
                        key={`${tab}-${originalIndex}`}
                        className={`rounded-[20px] border-[4px] border-black p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000] ${
                          isDuplicate || hasEmpty ? "bg-[#241313]" : "bg-[#111111]"
                        }`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
                          <p className="text-[13px] font-black text-white/60 md:text-sm">
                            {tab === "businessReverse"
                              ? "ビジネス 逆転"
                              : "ビジネス 整合性"}{" "}
                            Q{visibleIndex + 1}
                          </p>
                          <button
                            type="button"
                            className="rounded-full border-[3px] border-black bg-[#ffd0d0] px-3 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:text-xs md:shadow-[0_4px_0_#000]"
                            onClick={() => handleDeleteRow(originalIndex)}
                          >
                            削除
                          </button>
                        </div>

                        <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              ID
                            </p>
                            <input
                              className={`mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                                row.id.trim() === "" || isDuplicate ? "border-[#ff9d9d]" : ""
                              }`}
                              value={row.id}
                              onChange={(e) =>
                                handleBusinessLikertChange(
                                  tab === "businessReverse" ? "reverse" : "consistency",
                                  originalIndex,
                                  { id: e.target.value }
                                )
                              }
                            />
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              軸
                            </p>
                            <select
                              className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                              value={row.axis}
                              onChange={(e) =>
                                handleBusinessLikertChange(
                                  tab === "businessReverse" ? "reverse" : "consistency",
                                  originalIndex,
                                  {
                                    axis:
                                      e.target.value as BusinessLikertQuestion["axis"],
                                  }
                                )
                              }
                            >
                              {["MP", "QR", "VT", "CS"].map((axis) => (
                                <option key={axis} value={axis}>
                                  {axis}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <p className="text-[10px] font-black text-white/60 md:text-xs">
                              方向
                            </p>
                            <select
                              className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:rounded-[14px] md:px-4 md:py-3 md:text-sm"
                              value={row.direction}
                              onChange={(e) =>
                                handleBusinessLikertChange(
                                  tab === "businessReverse" ? "reverse" : "consistency",
                                  originalIndex,
                                  {
                                    direction:
                                      e.target.value as BusinessLikertQuestion["direction"],
                                  }
                                )
                              }
                            >
                              {["M", "P", "Q", "R", "V", "T", "C", "S"].map(
                                (direction) => (
                                  <option key={direction} value={direction}>
                                    {direction}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>

                        <div className="mt-3 md:mt-4">
                          <p className="text-[10px] font-black text-white/60 md:text-xs">
                            質問文
                          </p>
                          <textarea
                            className={`mt-2 min-h-[104px] w-full resize-y rounded-[12px] border-[3px] border-black bg-[#1d1d1d] px-3.5 py-2.5 text-[13px] font-bold text-white outline-none md:min-h-[120px] md:rounded-[14px] md:px-4 md:py-3 md:text-sm ${
                              row.question.trim() === "" ? "border-[#ff9d9d]" : ""
                            }`}
                            value={row.question}
                            onChange={(e) =>
                              handleBusinessLikertChange(
                                tab === "businessReverse" ? "reverse" : "consistency",
                                originalIndex,
                                { question: e.target.value }
                              )
                            }
                          />
                        </div>

                        {(isDuplicate || hasEmpty) && (
                          <div className="mt-3 text-[11px] font-black leading-5 text-[#ffd0d0] md:text-xs">
                            {isDuplicate ? "IDが重複しています。 " : ""}
                            {hasEmpty ? "必須項目が未入力です。" : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {filteredRows.length === 0 && (
                  <div className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
                    <p className="text-[13px] font-bold leading-6 text-white/80 md:text-sm">
                      条件に一致する質問がありません。
                    </p>
                  </div>
                )}
              </div>
            </PanelFrame>
          </section>
        </div>
      </main>

      <P4BottomNav role={normalizedRole} />
    </>
  );
}