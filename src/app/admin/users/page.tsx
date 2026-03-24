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

type UserItem = {
  id: string;
  name?: string;
  role?: string;
};

type CsvRow = {
  uid: string;
  name: string;
  email: string;
  role: string;
  department: string;
  mbti: string;
  businessCode: string;
  confidence: string;
  strengths: string;
  weaknesses: string;
  traits: string;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [currentRole, setCurrentRole] = useState("");
  const [loading, setLoading] = useState(true);

  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [department, setDepartment] = useState("");
  const [mbti, setMbti] = useState("");
  const [businessCode, setBusinessCode] = useState("");
  const [confidence, setConfidence] = useState("80");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [traits, setTraits] = useState("");

  const [users, setUsers] = useState<UserItem[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);

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

        const meData = meDoc.data();
        const myRole = (meData.role || "").trim().toLowerCase();
        setCurrentRole(myRole);

        if (myRole !== "admin") {
          alert("この画面は Admin のみ利用できます");
          router.push("/home");
          return;
        }

        await refreshUsers();
      } catch (error) {
        console.error("管理画面取得エラー:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const refreshUsers = async () => {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const usersList = usersSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as Omit<UserItem, "id">),
    }));
    setUsers(usersList);
  };

  const toArrayFromComma = (value: string) => {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  };

  const toArrayFromPipe = (value: string) => {
    return value
      .split("|")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  };

  const handleCreate = async () => {
    if (!uid || !name || !email || !role || !department) {
      alert("必須項目を入力してください");
      return;
    }

    try {
      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        role,
        department,
        profileImageUrl: "",
      });

      await setDoc(doc(db, "diagnostics", uid), {
        userId: uid,
        mbti,
        businessCode,
        confidence: Number(confidence),
        diagnosedAt: new Date().toISOString().slice(0, 10),
        strengths: toArrayFromComma(strengths),
        weaknesses: toArrayFromComma(weaknesses),
        traits: toArrayFromComma(traits),
      });

      await setDoc(doc(db, "compatibilities", uid), {
        userId: uid,
        goodMatches: [],
        conflictMatches: [],
      });

      alert("Firestore登録が完了しました。Authアカウントは Firebase Authentication 側で作成してください。");

      setUid("");
      setName("");
      setEmail("");
      setRole("employee");
      setDepartment("");
      setMbti("");
      setBusinessCode("");
      setConfidence("80");
      setStrengths("");
      setWeaknesses("");
      setTraits("");

      await refreshUsers();
    } catch (error) {
      console.error("登録エラー:", error);
      alert("登録に失敗しました");
    }
  };

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");

    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const cleaned = values.map((v) => v.replace(/^"|"$/g, "").trim());

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cleaned[index] || "";
      });

      return row as CsvRow;
    });
  };

  const handleCsvUpload = async (file: File) => {
    try {
      setCsvLoading(true);

      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length === 0) {
        alert("CSVの中身が見つかりません");
        return;
      }

      for (const row of rows) {
        if (!row.uid || !row.name || !row.email || !row.role || !row.department) {
          console.warn("必須項目不足のためスキップ:", row);
          continue;
        }

        await setDoc(doc(db, "users", row.uid), {
          uid: row.uid,
          name: row.name,
          email: row.email,
          role: row.role.trim().toLowerCase(),
          department: row.department,
          profileImageUrl: "",
        });

        await setDoc(doc(db, "diagnostics", row.uid), {
          userId: row.uid,
          mbti: row.mbti || "",
          businessCode: row.businessCode || "",
          confidence: Number(row.confidence || 0),
          diagnosedAt: new Date().toISOString().slice(0, 10),
          strengths: toArrayFromPipe(row.strengths || ""),
          weaknesses: toArrayFromPipe(row.weaknesses || ""),
          traits: toArrayFromPipe(row.traits || ""),
        });

        await setDoc(doc(db, "compatibilities", row.uid), {
          userId: row.uid,
          goodMatches: [],
          conflictMatches: [],
        });
      }

      alert("CSV一括登録が完了しました");
      await refreshUsers();
    } catch (error) {
      console.error("CSV登録エラー:", error);
      alert("CSV登録に失敗しました");
    } finally {
      setCsvLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="ユーザー管理">
        <div className="p4g-card">読み込み中...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="ユーザー管理" role={currentRole}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="p4g-card">
          <h2 className="mb-4 text-xl font-extrabold">新規ユーザー登録</h2>

          <div className="mb-4">
            <label className="p4g-label">UID</label>
            <input
              className="p4g-input"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="Authenticationで作成したUID"
            />
          </div>

          <div className="mb-4">
            <label className="p4g-label">名前</label>
            <input
              className="p4g-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="p4g-label">メール</label>
            <input
              className="p4g-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="p4g-label">権限</label>
            <select
              className="p4g-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="admin">admin</option>
              <option value="manager">manager</option>
              <option value="employee">employee</option>
              <option value="partner">partner</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="p4g-label">部署</label>
            <input
              className="p4g-input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="p4g-label">MBTI</label>
              <input
                className="p4g-input"
                value={mbti}
                onChange={(e) => setMbti(e.target.value)}
                placeholder="ENTJ"
              />
            </div>

            <div>
              <label className="p4g-label">ビジネス人格</label>
              <input
                className="p4g-input"
                value={businessCode}
                onChange={(e) => setBusinessCode(e.target.value)}
                placeholder="MQVC"
              />
            </div>

            <div>
              <label className="p4g-label">信頼度</label>
              <input
                className="p4g-input"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                placeholder="80"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="p4g-label">強み（カンマ区切り）</label>
            <input
              className="p4g-input"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="意思決定が速い, 推進力がある"
            />
          </div>

          <div className="mb-4">
            <label className="p4g-label">弱み（カンマ区切り）</label>
            <input
              className="p4g-input"
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              placeholder="独断的になりやすい"
            />
          </div>

          <div className="mb-6">
            <label className="p4g-label">特性（カンマ区切り）</label>
            <input
              className="p4g-input"
              value={traits}
              onChange={(e) => setTraits(e.target.value)}
              placeholder="論理的, 挑戦志向"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreate}
              className="p4g-button p4g-button-yellow"
            >
              Firestore登録
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
          <h2 className="mb-4 text-xl font-extrabold">CSV一括登録</h2>
          <p className="mb-4 text-sm text-gray-600">
            CSV形式で users / diagnostics / compatibilities を一括登録します。
          </p>

          <div className="mb-4">
            <label className="p4g-label">CSVファイル</label>
            <input
              type="file"
              accept=".csv"
              className="p4g-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleCsvUpload(file);
                }
              }}
            />
          </div>

          {csvLoading && (
            <p className="mb-4 text-sm font-bold text-blue-600">
              CSV登録中...
            </p>
          )}

          <div className="rounded-xl border-2 border-black bg-yellow-50 p-4 text-sm">
            <p className="mb-2 font-bold">CSVヘッダー</p>
            <p className="break-all">
              uid,name,email,role,department,mbti,businessCode,confidence,strengths,weaknesses,traits
            </p>
            <p className="mt-3 font-bold">配列項目の区切り</p>
            <p>strengths / weaknesses / traits は「|」区切り</p>
          </div>

          <div className="mt-6">
            <h2 className="mb-4 text-xl font-extrabold">登録済みユーザー</h2>

            {users.length > 0 ? (
              users.map((user) => (
                <div
                  key={user.id}
                  className="mb-3 rounded-xl border-2 border-black bg-white p-4"
                >
                  <p className="font-bold">{user.name || "未設定"}</p>
                  <p className="text-sm text-gray-600">UID: {user.id}</p>
                  <p className="text-sm text-gray-600">権限: {user.role || "-"}</p>
                </div>
              ))
            ) : (
              <p>ユーザーがいません</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}