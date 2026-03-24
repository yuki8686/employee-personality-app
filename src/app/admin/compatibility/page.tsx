"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { buildMatchesForUser } from "@/utils/compatibility";

type UserItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
};

type DiagnosticItem = {
  userId?: string;
  mbti?: string;
  businessCode?: string;
};

export default function AdminCompatibilityPage() {
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [diagnosticsMap, setDiagnosticsMap] = useState<Record<string, DiagnosticItem>>({});

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
        setCurrentRole(role);

        if (role !== "admin") {
          alert("この画面は Admin のみ利用できます");
          router.push("/home");
          return;
        }

        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersList = usersSnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<UserItem, "id">),
        }));
        setUsers(usersList);

        const diagnosticsSnapshot = await getDocs(collection(db, "diagnostics"));
        const nextMap: Record<string, DiagnosticItem> = {};

        diagnosticsSnapshot.docs.forEach((docItem) => {
          nextMap[docItem.id] = docItem.data() as DiagnosticItem;
        });

        setDiagnosticsMap(nextMap);
      } catch (error) {
        console.error("相性管理画面エラー:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleGenerate = async () => {
    try {
      setRunning(true);

      for (const user of users) {
        const result = buildMatchesForUser(user.id, users, diagnosticsMap);

        await setDoc(doc(db, "compatibilities", user.id), {
          userId: user.id,
          goodMatches: result.goodMatches.map((item) => ({
            userId: item.userId,
            name: item.name,
            mbti: item.mbti,
            businessCode: item.businessCode,
          })),
          conflictMatches: result.conflictMatches.map((item) => ({
            userId: item.userId,
            name: item.name,
            mbti: item.mbti,
            businessCode: item.businessCode,
          })),
        });
      }

      alert("相性データの自動生成が完了しました");
    } catch (error) {
      console.error("相性生成エラー:", error);
      alert("相性データ生成に失敗しました");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="相性自動生成">
        <div className="p4g-card">読み込み中...</div>
      </AppShell>
    );
  }

  if (currentRole !== "admin") {
    return (
      <AppShell title="相性自動生成" role={currentRole}>
        <div className="p4g-card">この画面は Admin のみ利用できます。</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="相性自動生成" role={currentRole}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="p4g-card">
          <h2 className="mb-4 text-xl font-extrabold">相性データ再生成</h2>
          <p className="mb-4 text-sm text-gray-600">
            diagnostics の MBTI / ビジネス人格をもとに、
            全社員の goodMatches / conflictMatches を自動で作成します。
          </p>

          <div className="mb-6 rounded-xl border-2 border-black bg-yellow-50 p-4 text-sm">
            <p>対象ユーザー数: {users.length}</p>
            <p>diagnostics件数: {Object.keys(diagnosticsMap).length}</p>
            <p>各ユーザーごとに上位3件ずつ保存します。</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={running}
              className="p4g-button p4g-button-yellow disabled:opacity-50"
            >
              {running ? "生成中..." : "相性データを生成する"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/home")}
              className="p4g-button p4g-button-dark"
            >
              ホームへ戻る
            </button>
          </div>
        </div>

        <div className="p4g-card">
          <h2 className="mb-4 text-xl font-extrabold">対象社員一覧</h2>

          {users.length > 0 ? (
            users.map((user) => (
              <div
                key={user.id}
                className="mb-3 rounded-xl border-2 border-black bg-white p-4"
              >
                <p className="font-bold">{user.name || "未設定"}</p>
                <p className="text-sm text-gray-600">UID: {user.id}</p>
                <p className="text-sm text-gray-600">
                  診断: {diagnosticsMap[user.id]?.mbti || "-"} / {diagnosticsMap[user.id]?.businessCode || "-"}
                </p>
              </div>
            ))
          ) : (
            <p>ユーザーがいません</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}