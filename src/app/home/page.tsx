"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { getUserRole } from "@/utils/role";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { collection, getDocs } from "firebase/firestore";

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }

      try {
        setUser(firebaseUser);

        const userRole = await getUserRole(firebaseUser.uid);
        setRole(userRole || "");

        const usersSnapshot = await getDocs(collection(db, "users"));
        setUserCount(usersSnapshot.docs.length);

        const feedbackSnapshot = await getDocs(collection(db, "feedbacks"));
        setFeedbackCount(feedbackSnapshot.docs.length);
      } catch (error) {
        console.error("ホーム取得エラー:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <AppShell title="ホーム">
        <div className="p4g-card">読み込み中...</div>
      </AppShell>
    );
  }

  const normalizedRole = (role || "").trim().toLowerCase();

  return (
    <AppShell title="ホーム" role={role}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="p4g-stat">
          <p className="text-sm text-gray-600">ログイン中</p>
          <p className="mt-2 text-lg font-extrabold">{user?.email || "-"}</p>
        </div>

        <div className="p4g-stat">
          <p className="text-sm text-gray-600">社員数</p>
          <p className="mt-2 text-3xl font-extrabold">{userCount}</p>
        </div>

        <div className="p4g-stat">
          <p className="text-sm text-gray-600">フィードバック件数</p>
          <p className="mt-2 text-3xl font-extrabold">{feedbackCount}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="p4g-card">
          <h2 className="mb-3 text-lg font-extrabold">プロフィール</h2>
          <p className="mb-4 text-sm text-gray-600">
            自分の診断結果、相性、フィードバックを確認します。
          </p>
          <button
            onClick={() => router.push("/profile")}
            className="p4g-button p4g-button-blue"
          >
            詳細を見る
          </button>
        </div>

        {(normalizedRole === "admin" || normalizedRole === "manager") && (
          <div className="p4g-card">
            <h2 className="mb-3 text-lg font-extrabold">組織マップ</h2>
            <p className="mb-4 text-sm text-gray-600">
              社員一覧や部署ごとの状態を確認します。
            </p>
            <button
              onClick={() => router.push("/org-map")}
              className="p4g-button p4g-button-green"
            >
              確認する
            </button>
          </div>
        )}

        {(normalizedRole === "admin" || normalizedRole === "manager") && (
          <div className="p4g-card">
            <h2 className="mb-3 text-lg font-extrabold">フィードバック</h2>
            <p className="mb-4 text-sm text-gray-600">
              対象社員にフィードバックを入力します。
            </p>
            <button
              onClick={() => router.push("/feedback")}
              className="p4g-button p4g-button-yellow"
            >
              入力する
            </button>
          </div>
        )}

        {normalizedRole === "admin" && (
          <div className="p4g-card">
            <h2 className="mb-3 text-lg font-extrabold">管理機能</h2>
            <p className="mb-4 text-sm text-gray-600">
              ユーザー管理や相性データ再生成を行います。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push("/admin/users")}
                className="p4g-button p4g-button-dark"
              >
                ユーザー管理
              </button>
              <button
                onClick={() => router.push("/admin/compatibility")}
                className="p4g-button p4g-button-red"
              >
                相性再生成
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button onClick={handleLogout} className="p4g-button p4g-button-red">
          ログアウト
        </button>
      </div>
    </AppShell>
  );
}