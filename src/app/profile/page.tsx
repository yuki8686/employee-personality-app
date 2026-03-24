"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import AppShell from "@/components/AppShell";

type MatchPerson = {
  userId?: string;
  name?: string;
  mbti?: string;
  businessCode?: string;
};

type FeedbackItem = {
  id: string;
  targetUserId: string;
  fromUserId: string;
  fromUserName: string;
  challenge: string;
  impression: string;
  expectation: string;
  comment: string;
  createdAt: string;
};

function normalizeMatches(value: any): MatchPerson[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object");
  }
  return [];
}

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [compatibility, setCompatibility] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
        }

        const diagnosticDoc = await getDoc(doc(db, "diagnostics", user.uid));
        if (diagnosticDoc.exists()) {
          setDiagnostic(diagnosticDoc.data());
        }

        const compatibilityDoc = await getDoc(doc(db, "compatibilities", user.uid));
        if (compatibilityDoc.exists()) {
          setCompatibility(compatibilityDoc.data());
        }

        const feedbackQuery = query(
          collection(db, "feedbacks"),
          where("targetUserId", "==", user.uid)
        );
        const feedbackSnapshot = await getDocs(feedbackQuery);

        const feedbackList = feedbackSnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<FeedbackItem, "id">),
        }));

        setFeedbacks(feedbackList);
      } catch (error) {
        console.error("プロフィール取得エラー:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleImageUpload = async (url: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        profileImageUrl: url,
      });

      setProfile((prev: any) => ({
        ...prev,
        profileImageUrl: url,
      }));

      alert("プロフィール画像を更新しました");
    } catch (error) {
      console.error("画像更新エラー:", error);
      alert("画像の更新に失敗しました");
    }
  };

  const goodMatches = useMemo(
    () => normalizeMatches(compatibility?.goodMatches),
    [compatibility]
  );

  const conflictMatches = useMemo(
    () => normalizeMatches(compatibility?.conflictMatches),
    [compatibility]
  );

  if (loading) {
    return (
      <AppShell title="プロフィール">
        <div className="rounded-[22px] border-[3px] border-black bg-white p-6 shadow-[0_6px_0_rgba(0,0,0,0.12)]">
          読み込み中...
        </div>
      </AppShell>
    );
  }

  const normalizedRole = (profile?.role || "").trim().toLowerCase();

  return (
    <AppShell title="プロフィール" role={profile?.role}>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-[24px] border-[3px] border-black bg-[#f8f7f2] p-5 shadow-[0_6px_0_rgba(0,0,0,0.12)]">
          <h2 className="mb-5 text-2xl font-black">基本情報</h2>

          {profile?.profileImageUrl ? (
            <img
              src={profile.profileImageUrl}
              alt="profile"
              className="mb-4 h-40 w-40 rounded-full border-2 border-gray-500 object-cover"
            />
          ) : (
            <div className="mb-4 flex h-40 w-40 items-center justify-center rounded-full border-2 border-gray-500 bg-gray-100 text-2xl text-gray-500">
              画像なし
            </div>
          )}

          <ImageUploader onUpload={handleImageUpload} />

          <div className="mt-6 space-y-3 text-xl font-semibold leading-relaxed">
            <p>名前: {profile?.name || "-"}</p>
            <p>メール: {profile?.email || "-"}</p>
            <p>部署: {profile?.department || "-"}</p>
            <p>権限: {profile?.role || "-"}</p>
          </div>
        </div>

        <div className="rounded-[24px] border-[3px] border-black bg-[#f8f7f2] p-5 shadow-[0_6px_0_rgba(0,0,0,0.12)] lg:col-span-2">
          <h2 className="mb-5 text-2xl font-black">診断結果</h2>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[20px] border-[3px] border-black bg-gradient-to-b from-[#f4f2ea] to-[#f4eab0] p-5 shadow-[0_5px_0_rgba(0,0,0,0.12)]">
              <p className="text-lg font-bold text-gray-500">MBTI</p>
              <p className="mt-3 text-4xl font-black">{diagnostic?.mbti || "-"}</p>
            </div>

            <div className="rounded-[20px] border-[3px] border-black bg-gradient-to-b from-[#f4f2ea] to-[#f4eab0] p-5 shadow-[0_5px_0_rgba(0,0,0,0.12)]">
              <p className="text-lg font-bold text-gray-500">ビジネス人格</p>
              <p className="mt-3 text-4xl font-black">
                {diagnostic?.businessCode || "-"}
              </p>
            </div>

            <div className="rounded-[20px] border-[3px] border-black bg-gradient-to-b from-[#f4f2ea] to-[#f4eab0] p-5 shadow-[0_5px_0_rgba(0,0,0,0.12)]">
              <p className="text-lg font-bold text-gray-500">信頼度</p>
              <p className="mt-3 text-4xl font-black">
                {typeof diagnostic?.confidence === "number"
                  ? `${diagnostic.confidence}%`
                  : "-"}
              </p>
            </div>

            <div className="rounded-[20px] border-[3px] border-black bg-gradient-to-b from-[#f4f2ea] to-[#f4eab0] p-5 shadow-[0_5px_0_rgba(0,0,0,0.12)]">
              <p className="text-lg font-bold text-gray-500">診断日</p>
              <p className="mt-3 text-3xl font-black">
                {diagnostic?.diagnosedAt || "-"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border-[3px] border-black bg-[#f8f7f2] p-5 shadow-[0_5px_0_rgba(0,0,0,0.1)]">
              <p className="mb-3 text-2xl font-black">強み</p>
              <ul className="list-disc pl-6 text-xl font-semibold leading-relaxed">
                {Array.isArray(diagnostic?.strengths) && diagnostic.strengths.length > 0 ? (
                  diagnostic.strengths.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))
                ) : (
                  <li>データがありません</li>
                )}
              </ul>
            </div>

            <div className="rounded-[20px] border-[3px] border-black bg-[#f8f7f2] p-5 shadow-[0_5px_0_rgba(0,0,0,0.1)]">
              <p className="mb-3 text-2xl font-black">弱み</p>
              <ul className="list-disc pl-6 text-xl font-semibold leading-relaxed">
                {Array.isArray(diagnostic?.weaknesses) && diagnostic.weaknesses.length > 0 ? (
                  diagnostic.weaknesses.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))
                ) : (
                  <li>データがありません</li>
                )}
              </ul>
            </div>

            <div className="rounded-[20px] border-[3px] border-black bg-[#f8f7f2] p-5 shadow-[0_5px_0_rgba(0,0,0,0.1)]">
              <p className="mb-3 text-2xl font-black">特性</p>
              <ul className="list-disc pl-6 text-xl font-semibold leading-relaxed">
                {Array.isArray(diagnostic?.traits) && diagnostic.traits.length > 0 ? (
                  diagnostic.traits.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))
                ) : (
                  <li>データがありません</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {normalizedRole !== "partner" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] border-[3px] border-black bg-[#f8f7f2] p-5 shadow-[0_6px_0_rgba(0,0,0,0.12)]">
            <h2 className="mb-4 text-2xl font-black">相性が良い社員</h2>
            {goodMatches.length > 0 ? (
              goodMatches.map((person: MatchPerson, index: number) => (
                <div
                  key={person.userId || `${person.name}-${index}`}
                  className="mb-3 rounded-[18px] border-[3px] border-black bg-[#edf9df] p-4"
                >
                  <p className="text-xl font-black">名前: {person.name || "不明"}</p>
                  <p className="mt-1 text-lg font-semibold">
                    診断結果: {person.mbti || "-"} × {person.businessCode || "-"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-lg font-semibold">データがありません</p>
            )}
          </div>

          <div className="rounded-[24px] border-[3px] border-black bg-[#f8f7f2] p-5 shadow-[0_6px_0_rgba(0,0,0,0.12)]">
            <h2 className="mb-4 text-2xl font-black">衝突の可能性がある社員</h2>
            {conflictMatches.length > 0 ? (
              conflictMatches.map((person: MatchPerson, index: number) => (
                <div
                  key={person.userId || `${person.name}-${index}`}
                  className="mb-3 rounded-[18px] border-[3px] border-black bg-[#fde7e7] p-4"
                >
                  <p className="text-xl font-black">
                    名前:{" "}
                    {normalizedRole === "employee"
                      ? "非表示"
                      : person.name || "不明"}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    診断結果: {person.mbti || "-"} × {person.businessCode || "-"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-lg font-semibold">データがありません</p>
            )}
          </div>
        </div>
      )}

      {normalizedRole !== "partner" && (
        <div className="mt-5 rounded-[24px] border-[3px] border-black bg-[#f8f7f2] p-5 shadow-[0_6px_0_rgba(0,0,0,0.12)]">
          <h2 className="mb-4 text-2xl font-black">過去のフィードバック</h2>
          <p className="mb-4 text-base font-bold text-gray-500">件数: {feedbacks.length}</p>

          {feedbacks.length > 0 ? (
            feedbacks.map((item) => (
              <div
                key={item.id}
                className="mb-4 rounded-[18px] border-[3px] border-black bg-white p-4"
              >
                <p className="mb-1 text-sm font-bold text-gray-500">投稿日: {item.createdAt}</p>
                <p className="mb-1 text-lg font-semibold">投稿者: {item.fromUserName}</p>
                <p className="mb-1 text-lg font-semibold">現在の課題: {item.challenge}</p>
                <p className="mb-1 text-lg font-semibold">印象: {item.impression}</p>
                <p className="mb-1 text-lg font-semibold">
                  期待していること: {item.expectation}
                </p>
                <p className="text-lg font-semibold">コメント: {item.comment}</p>
              </div>
            ))
          ) : (
            <p className="text-lg font-semibold">フィードバックはまだありません</p>
          )}
        </div>
      )}
    </AppShell>
  );
}