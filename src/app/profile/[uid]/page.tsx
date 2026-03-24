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
  where,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
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

export default function UserProfileDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;

  const [currentUserRole, setCurrentUserRole] = useState("");
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
        const meDoc = await getDoc(doc(db, "users", user.uid));
        if (!meDoc.exists()) {
          alert("ログイン中ユーザーの情報がありません");
          router.push("/home");
          return;
        }

        const me = meDoc.data();
        const role = (me.role || "").trim().toLowerCase();
        setCurrentUserRole(role);

        if (role !== "admin" && role !== "manager") {
          alert("この画面は Admin または Manager のみ利用できます");
          router.push("/home");
          return;
        }

        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
        }

        const diagnosticDoc = await getDoc(doc(db, "diagnostics", uid));
        if (diagnosticDoc.exists()) {
          setDiagnostic(diagnosticDoc.data());
        }

        const compatibilityDoc = await getDoc(doc(db, "compatibilities", uid));
        if (compatibilityDoc.exists()) {
          setCompatibility(compatibilityDoc.data());
        }

        const feedbackQuery = query(
          collection(db, "feedbacks"),
          where("targetUserId", "==", uid)
        );
        const feedbackSnapshot = await getDocs(feedbackQuery);
        const feedbackList = feedbackSnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<FeedbackItem, "id">),
        }));
        setFeedbacks(feedbackList);
      } catch (error) {
        console.error("他人プロフィール取得エラー:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, uid]);

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
      <AppShell title="社員詳細プロフィール" role={currentUserRole}>
        <div className="p4g-card">読み込み中...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="社員詳細プロフィール" role={currentUserRole}>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push("/org-map")}
          className="p4g-button p4g-button-dark"
        >
          組織マップへ戻る
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="p4g-card">
          <h2 className="mb-4 text-xl font-extrabold">基本情報</h2>

          {profile?.profileImageUrl ? (
            <img
              src={profile.profileImageUrl}
              alt="profile"
              className="mb-4 h-32 w-32 rounded-full border-2 border-black object-cover"
            />
          ) : (
            <div className="mb-4 flex h-32 w-32 items-center justify-center rounded-full border-2 border-black bg-gray-100 text-sm text-gray-500">
              画像なし
            </div>
          )}

          <div className="space-y-2 text-sm">
            <p>名前: {profile?.name || "-"}</p>
            <p>メール: {profile?.email || "-"}</p>
            <p>部署: {profile?.department || "-"}</p>
            <p>権限: {profile?.role || "-"}</p>
          </div>
        </div>

        <div className="p4g-card lg:col-span-2">
          <h2 className="mb-4 text-xl font-extrabold">診断結果</h2>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="p4g-stat">
              <p className="text-sm text-gray-500">MBTI</p>
              <p className="mt-1 text-lg font-extrabold">{diagnostic?.mbti || "-"}</p>
            </div>
            <div className="p4g-stat">
              <p className="text-sm text-gray-500">ビジネス人格</p>
              <p className="mt-1 text-lg font-extrabold">{diagnostic?.businessCode || "-"}</p>
            </div>
            <div className="p4g-stat">
              <p className="text-sm text-gray-500">信頼度</p>
              <p className="mt-1 text-lg font-extrabold">
                {typeof diagnostic?.confidence === "number"
                  ? `${diagnostic.confidence}%`
                  : "-"}
              </p>
            </div>
            <div className="p4g-stat">
              <p className="text-sm text-gray-500">診断日</p>
              <p className="mt-1 text-lg font-extrabold">{diagnostic?.diagnosedAt || "-"}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="p4g-card">
              <p className="mb-2 font-extrabold">強み</p>
              <ul className="list-disc pl-5">
                {Array.isArray(diagnostic?.strengths)
                  ? diagnostic.strengths.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))
                  : <li>データがありません</li>}
              </ul>
            </div>

            <div className="p4g-card">
              <p className="mb-2 font-extrabold">弱み</p>
              <ul className="list-disc pl-5">
                {Array.isArray(diagnostic?.weaknesses)
                  ? diagnostic.weaknesses.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))
                  : <li>データがありません</li>}
              </ul>
            </div>

            <div className="p4g-card">
              <p className="mb-2 font-extrabold">特性</p>
              <ul className="list-disc pl-5">
                {Array.isArray(diagnostic?.traits)
                  ? diagnostic.traits.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))
                  : <li>データがありません</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="p4g-card">
          <h2 className="mb-4 text-xl font-extrabold">相性が良い社員</h2>
          {goodMatches.length > 0 ? (
            goodMatches.map((person: MatchPerson, index: number) => (
              <div
                key={person.userId || `${person.name}-${index}`}
                className="mb-3 rounded-xl border-2 border-black bg-green-50 p-4"
              >
                <p>名前: {person.name || "不明"}</p>
                <p>診断結果: {person.mbti || "-"} × {person.businessCode || "-"}</p>
              </div>
            ))
          ) : (
            <p>データがありません</p>
          )}
        </div>

        <div className="p4g-card">
          <h2 className="mb-4 text-xl font-extrabold">衝突の可能性がある社員</h2>
          {conflictMatches.length > 0 ? (
            conflictMatches.map((person: MatchPerson, index: number) => (
              <div
                key={person.userId || `${person.name}-${index}`}
                className="mb-3 rounded-xl border-2 border-black bg-red-50 p-4"
              >
                <p>名前: {person.name || "不明"}</p>
                <p>診断結果: {person.mbti || "-"} × {person.businessCode || "-"}</p>
              </div>
            ))
          ) : (
            <p>データがありません</p>
          )}
        </div>
      </div>

      <div className="mt-6 p4g-card">
        <h2 className="mb-4 text-xl font-extrabold">過去のフィードバック</h2>
        <p className="mb-3 text-sm text-gray-500">件数: {feedbacks.length}</p>

        {feedbacks.length > 0 ? (
          feedbacks.map((item) => (
            <div key={item.id} className="mb-4 rounded-xl border-2 border-black p-4">
              <p className="mb-1 text-sm text-gray-500">投稿日: {item.createdAt}</p>
              <p className="mb-1">投稿者: {item.fromUserName}</p>
              <p className="mb-1">現在の課題: {item.challenge}</p>
              <p className="mb-1">印象: {item.impression}</p>
              <p className="mb-1">期待していること: {item.expectation}</p>
              <p>コメント: {item.comment}</p>
            </div>
          ))
        ) : (
          <p>フィードバックはまだありません</p>
        )}
      </div>
    </AppShell>
  );
}