"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  markInvitationUsed,
  validateInvitationToken,
} from "@/lib/invitations";

type InvitationView = {
  id: string;
  token: string;
  role: string;
  departmentId: string;
  departmentName: string;
  status: string;
  expiresAt: string;
};

export default function RegisterByInvitationPage() {
  const params = useParams();
  const router = useRouter();

  const token = useMemo(() => {
    const raw = params?.token;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0] || "";
    return "";
  }, [params]);

  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState<InvitationView | null>(null);

  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [partnerCompany, setPartnerCompany] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setError("招待トークンが見つかりません。");
        setChecking(false);
        return;
      }

      try {
        const result = await validateInvitationToken(token);

        if (!result.ok || !result.invitation?.id) {
          setError(result.reason || "招待リンクを確認できませんでした。");
          setChecking(false);
          return;
        }

        setInvitation({
          id: result.invitation.id,
          token: result.invitation.token,
          role: result.invitation.role,
          departmentId: result.invitation.departmentId,
          departmentName: result.invitation.departmentName,
          status: result.invitation.status,
          expiresAt: result.invitation.expiresAt,
        });
      } catch (e) {
        console.error(e);
        setError("招待リンクの確認中にエラーが発生しました。");
      } finally {
        setChecking(false);
      }
    };

    run();
  }, [token]);

  const handleRegister = async () => {
    if (!invitation) return;

    if (!name.trim()) {
      setError("氏名を入力してください。");
      return;
    }

    if (!nameKana.trim()) {
      setError("フリガナを入力してください。");
      return;
    }

    if (!email.trim()) {
      setError("メールアドレスを入力してください。");
      return;
    }

    if (!password.trim()) {
      setError("パスワードを入力してください。");
      return;
    }

    if (invitation.role === "partner" && !partnerCompany.trim()) {
      setError("Partner は所属会社名を入力してください。");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const authResult = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const uid = authResult.user.uid;
      const nowIso = new Date().toISOString();

      await setDoc(doc(db, "users", uid), {
        uid,
        name: name.trim(),
        nameKana: nameKana.trim(),
        email: email.trim(),
        departmentId: invitation.departmentId,
        departmentName: invitation.departmentName,
        role: invitation.role,
        partnerCompany:
          invitation.role === "partner" ? partnerCompany.trim() : "",
        profileImageUrl: "",
        status: "pending",
        inviteId: invitation.id,
        currentWizardStep: 1,
        lastSavedQuestionGroup: 0,
        lastDiagnosedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      });

      await setDoc(doc(db, "diagnosis_sessions", uid), {
        userId: uid,
        status: "in_progress",
        step: "profile",
        mbtiAnswers: {},
        businessAnswers: {},
        savedAt: nowIso,
        savedAtServer: serverTimestamp(),
      });

      await markInvitationUsed(invitation.id, uid);

      router.push("/register/wizard");
    } catch (e: unknown) {
      console.error(e);

      const message =
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "登録に失敗しました。";

      if (message.includes("auth/email-already-in-use")) {
        setError("このメールアドレスは既に使用されています。");
      } else if (message.includes("auth/invalid-email")) {
        setError("メールアドレスの形式が正しくありません。");
      } else if (message.includes("auth/weak-password")) {
        setError("パスワードは6文字以上で入力してください。");
      } else {
        setError("登録に失敗しました。入力内容を確認してください。");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <main className="p4g-shell flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-xl p4g-card-dark p-6">
          <p className="text-lg font-black text-white">招待情報を確認中...</p>
        </div>
      </main>
    );
  }

  if (!invitation) {
    return (
      <main className="p4g-shell flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-xl p4g-card-dark p-6 text-white">
          <div className="p4g-section-title-dark">INVITATION ERROR</div>
          <p className="mt-4 text-sm font-bold text-white/80">
            {error || "招待リンクが無効です。"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="p4g-shell flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border-[4px] border-black bg-[linear-gradient(180deg,#0f0f0f_0%,#181818_100%)] shadow-[0_14px_0_rgba(0,0,0,0.25),0_24px_54px_rgba(0,0,0,0.34)]">
        <div className="relative overflow-hidden border-b-[4px] border-black bg-[linear-gradient(90deg,#111111_0%,#1a1a1a_100%)] px-5 py-4 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0_58%,rgba(255,213,0,0.18)_58%_63%,transparent_63%_100%),linear-gradient(90deg,rgba(255,213,0,0.16),rgba(255,213,0,0))]" />
          <div className="relative z-10">
            <div className="p4g-brand-ribbon">
              <span>Regal Cast Database</span>
            </div>
            <p className="mt-4 text-xs font-black tracking-[0.18em] text-white/80">
              INVITATION REGISTRATION
            </p>
            <h1 className="mt-1 text-3xl font-black text-white">新規登録</h1>
          </div>
        </div>

        <div className="px-5 py-6 text-white">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[20px] border-[3px] border-black bg-[#fff8d9] p-4 text-black">
              <p className="text-xs font-black text-[#6a624f]">ROLE</p>
              <p className="mt-1 text-lg font-black">{invitation.role}</p>
            </div>

            <div className="rounded-[20px] border-[3px] border-black bg-[#fff8d9] p-4 text-black">
              <p className="text-xs font-black text-[#6a624f]">DEPARTMENT</p>
              <p className="mt-1 text-lg font-black">
                {invitation.departmentName}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="p4g-label">氏名</label>
              <input
                className="p4g-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
              />
            </div>

            <div>
              <label className="p4g-label">フリガナ</label>
              <input
                className="p4g-input"
                value={nameKana}
                onChange={(e) => setNameKana(e.target.value)}
                placeholder="ヤマダ タロウ"
              />
            </div>

            <div>
              <label className="p4g-label">メールアドレス</label>
              <input
                className="p4g-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sample@company.com"
              />
            </div>

            <div>
              <label className="p4g-label">パスワード</label>
              <input
                className="p4g-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
              />
            </div>

            {invitation.role === "partner" && (
              <div>
                <label className="p4g-label">所属会社名</label>
                <input
                  className="p4g-input"
                  value={partnerCompany}
                  onChange={(e) => setPartnerCompany(e.target.value)}
                  placeholder="会社名を入力"
                />
              </div>
            )}

            {error && (
              <p className="rounded-[18px] border-[3px] border-black bg-[#ffd0d0] px-4 py-3 text-sm font-black text-[#7b1111]">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleRegister}
              disabled={submitting}
              className="p4g-button p4g-button-gold w-full disabled:opacity-50"
            >
              {submitting ? "登録中..." : "登録して診断へ進む"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}