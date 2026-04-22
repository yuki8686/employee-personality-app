import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { businessQuestions, mbtiQuestions } from "@/lib/diagnosis/master";

export type MbtiQuestion = {
  id: string;
  text: string;
  axis: string;
  weight?: number;
  reverse?: boolean;
};

export type BusinessQuestion = {
  id: string;
  textA: string;
  textB: string;
  axis: string;
  weight?: number;
  reverse?: boolean;
};

function normalizeMbtiQuestion(
  value: Record<string, unknown>,
  fallbackIndex: number
): MbtiQuestion {
  return {
    id:
      typeof value.id === "string" && value.id.trim() !== ""
        ? value.id
        : `mbti-${fallbackIndex + 1}`,
    text: typeof value.text === "string" ? value.text : "",
    axis: typeof value.axis === "string" && value.axis.trim() !== "" ? value.axis : "EI",
    weight: typeof value.weight === "number" ? value.weight : 1,
    reverse: value.reverse === true,
  };
}

function normalizeBusinessQuestion(
  value: Record<string, unknown>,
  fallbackIndex: number
): BusinessQuestion {
  return {
    id:
      typeof value.id === "string" && value.id.trim() !== ""
        ? value.id
        : `business-${fallbackIndex + 1}`,
    textA: typeof value.textA === "string" ? value.textA : "",
    textB: typeof value.textB === "string" ? value.textB : "",
    axis: typeof value.axis === "string" && value.axis.trim() !== "" ? value.axis : "MP",
    weight: typeof value.weight === "number" ? value.weight : 1,
    reverse: value.reverse === true,
  };
}

function buildLocalMbtiFallback(): MbtiQuestion[] {
  return (mbtiQuestions as Array<Record<string, unknown>>).map((item, index) =>
    normalizeMbtiQuestion(item, index)
  );
}

function buildLocalBusinessFallback(): BusinessQuestion[] {
  return (businessQuestions as Array<Record<string, unknown>>).map((item, index) =>
    normalizeBusinessQuestion(item, index)
  );
}

export async function loadMbtiQuestionBank(): Promise<MbtiQuestion[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "diagnosis_master_mbti_questions"), orderBy("order", "asc"))
    );

    if (snap.empty) {
      return buildLocalMbtiFallback();
    }

    return snap.docs.map((doc, index) =>
      normalizeMbtiQuestion(doc.data() as Record<string, unknown>, index)
    );
  } catch (error) {
    console.error("MBTI質問マスタ読み込み失敗:", error);
    return buildLocalMbtiFallback();
  }
}

export async function loadBusinessQuestionBank(): Promise<BusinessQuestion[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "diagnosis_master_business_questions"),
        orderBy("order", "asc")
      )
    );

    if (snap.empty) {
      return buildLocalBusinessFallback();
    }

    return snap.docs.map((doc, index) =>
      normalizeBusinessQuestion(doc.data() as Record<string, unknown>, index)
    );
  } catch (error) {
    console.error("Business質問マスタ読み込み失敗:", error);
    return buildLocalBusinessFallback();
  }
}

export async function loadDiagnosisQuestionBanks(): Promise<{
  mbti: MbtiQuestion[];
  business: BusinessQuestion[];
}> {
  const [mbti, business] = await Promise.all([
    loadMbtiQuestionBank(),
    loadBusinessQuestionBank(),
  ]);

  return { mbti, business };
}