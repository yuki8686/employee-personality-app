"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type UserItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  profileImageUrl?: string;
};

type DiagnosticItem = {
  userId?: string;
  mbti?: string;
  businessCode?: string;
  confidence?: number;
  diagnosedAt?: string;
};

export default function OrgMapPage() {
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState("");
  const [currentDepartment, setCurrentDepartment] = useState("");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [diagnosticsMap, setDiagnosticsMap] = useState<Record<string, DiagnosticItem>>({});
  const [searchText, setSearchText] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        // ログイン中ユーザー情報取得
        const meDoc = await getDoc(doc(db, "users", user.uid));
        if (!meDoc.exists()) {
          alert("users コレクションにログイン中ユーザーの情報がありません");
          router.push("/home");
          return;
        }

        const meData = meDoc.data();
        const role = (meData.role || "").trim().toLowerCase();
        const department = meData.department || "";

        setCurrentRole(role);
        setCurrentDepartment(department);

        // Admin / Manager 以外は利用不可
        if (role !== "admin" && role !== "manager") {
          setLoading(false);
          return;
        }

        // users 取得
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersList = usersSnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<UserItem, "id">),
        }));

        setUsers(usersList);

        // diagnostics 取得
        const diagnosticsSnapshot = await getDocs(collection(db, "diagnostics"));
        const nextDiagnosticsMap: Record<string, DiagnosticItem> = {};

        diagnosticsSnapshot.docs.forEach((docItem) => {
          nextDiagnosticsMap[docItem.id] = docItem.data() as DiagnosticItem;
        });

        setDiagnosticsMap(nextDiagnosticsMap);
      } catch (error) {
        console.error("組織マップ取得エラー:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const departments = useMemo(() => {
    const values = users
      .map((user) => user.department || "")
      .filter((value) => value !== "");
    return Array.from(new Set(values));
  }, [users]);

  const filteredUsers = useMemo(() => {
    let list = [...users];

    // role制御
    if (currentRole === "manager") {
      list = list.filter((user) => user.department === currentDepartment);
    }

    // 検索
    if (searchText.trim()) {
      const keyword = searchText.trim().toLowerCase();
      list = list.filter((user) => {
        const name = (user.name || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        return name.includes(keyword) || email.includes(keyword);
      });
    }

    // 部署フィルター
    if (departmentFilter) {
      list = list.filter((user) => user.department === departmentFilter);
    }

    return list;
  }, [users, currentRole, currentDepartment, searchText, departmentFilter]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
          読み込み中...
        </div>
      </main>
    );
  }

  if (currentRole !== "admin" && currentRole !== "manager") {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">組織マップ</h1>
          <p>この画面は Admin または Manager のみ利用できます。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-2xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">組織マップ</h1>

          <div className="mb-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold">検索</label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="名前 または メールで検索"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">部署フィルター</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full rounded-lg border p-3"
              >
                <option value="">すべて</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => router.push("/home")}
                className="rounded-lg bg-gray-800 px-4 py-3 font-bold text-white"
              >
                ホームへ戻る
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            表示件数: {filteredUsers.length} 件
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredUsers.map((user) => {
            const diagnostic = diagnosticsMap[user.id];

            return (
              <div key={user.id} className="rounded-2xl bg-white p-5 shadow">
                <div className="mb-4 flex items-center gap-4">
                  {user.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt="profile"
                      className="h-16 w-16 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-gray-100 text-xs text-gray-500">
                      画像なし
                    </div>
                  )}

                  <div>
                    <h2 className="text-lg font-bold">{user.name || "名前未設定"}</h2>
                    <p className="text-sm text-gray-600">{user.email || "-"}</p>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <p>部署: {user.department || "-"}</p>
                  <p>権限: {user.role || "-"}</p>
                  <p>MBTI: {diagnostic?.mbti || "-"}</p>
                  <p>ビジネス人格: {diagnostic?.businessCode || "-"}</p>
                  <p>
                    信頼度:{" "}
                    {typeof diagnostic?.confidence === "number"
                      ? `${diagnostic.confidence}%`
                      : "-"}
                  </p>
                  <p>診断日: {diagnostic?.diagnosedAt || "-"}</p>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => router.push("/profile")}
                    className="rounded-lg bg-yellow-400 px-4 py-2 font-bold"
                  >
                    プロフィールを見る
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <div className="mt-6 rounded-2xl bg-white p-6 text-center shadow">
            該当する社員がいません
          </div>
        )}
      </div>
    </main>
  );
}