"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

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
        const meDoc = await getDoc(doc(db, "users", user.uid));
        if (!meDoc.exists()) {
          alert("ユーザー情報が存在しません");
          router.push("/home");
          return;
        }

        const meData = meDoc.data();
        const role = (meData.role || "").trim().toLowerCase();
        const department = meData.department || "";

        setCurrentRole(role);
        setCurrentDepartment(department);

        if (role !== "admin" && role !== "manager") {
          setLoading(false);
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
        console.error("組織マップエラー:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const departments = useMemo(() => {
    const list = users
      .map((u) => u.department || "")
      .filter((v) => v !== "");
    return Array.from(new Set(list));
  }, [users]);

  const filteredUsers = useMemo(() => {
    let list = [...users];

    if (currentRole === "manager") {
      list = list.filter((u) => u.department === currentDepartment);
    }

    if (searchText.trim()) {
      const keyword = searchText.toLowerCase();
      list = list.filter((u) => {
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(keyword) || email.includes(keyword);
      });
    }

    if (departmentFilter) {
      list = list.filter((u) => u.department === departmentFilter);
    }

    return list;
  }, [users, currentRole, currentDepartment, searchText, departmentFilter]);

  if (loading) {
    return (
      <AppShell title="組織マップ">
        <div className="p4g-card">読み込み中...</div>
      </AppShell>
    );
  }

  if (currentRole !== "admin" && currentRole !== "manager") {
    return (
      <AppShell title="組織マップ" role={currentRole}>
        <div className="p4g-card">
          この画面は Admin / Manager のみ利用できます
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="組織マップ" role={currentRole}>
      <div className="p4g-card mb-6">
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="p4g-label">検索</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="名前 or メール"
              className="p4g-input"
            />
          </div>

          <div>
            <label className="p4g-label">部署</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="p4g-select"
            >
              <option value="">すべて</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => router.push("/home")}
              className="p4g-button p4g-button-dark"
            >
              ホームへ戻る
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600">表示件数: {filteredUsers.length}</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredUsers.map((user) => {
          const diag = diagnosticsMap[user.id];

          return (
            <div key={user.id} className="p4g-card">
              <div className="flex gap-4 mb-4 items-center">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    className="w-16 h-16 rounded-full object-cover border-2 border-black"
                    alt="profile"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-black flex items-center justify-center text-xs">
                    画像なし
                  </div>
                )}

                <div>
                  <h2 className="font-extrabold">{user.name || "未設定"}</h2>
                  <p className="text-sm text-gray-600">{user.email || "-"}</p>
                </div>
              </div>

              <div className="text-sm space-y-1">
                <p>部署: {user.department || "-"}</p>
                <p>権限: {user.role || "-"}</p>
                <p>MBTI: {diag?.mbti || "-"}</p>
                <p>ビジネス人格: {diag?.businessCode || "-"}</p>
                <p>信頼度: {typeof diag?.confidence === "number" ? `${diag.confidence}%` : "-"}</p>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => router.push(`/profile/${user.id}`)}
                  className="p4g-button p4g-button-yellow"
                >
                  詳細を見る
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredUsers.length === 0 && (
        <div className="mt-6 p4g-card text-center">
          該当する社員がいません
        </div>
      )}
    </AppShell>
  );
}