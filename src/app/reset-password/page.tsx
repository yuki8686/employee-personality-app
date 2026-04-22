"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("メールアドレスを入力してください。");
      setSuccessMessage("");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccessMessage("");

      await sendPasswordResetEmail(auth, email.trim());

      setSuccessMessage(
        "パスワード再設定用のメールを送信しました。受信ボックスをご確認ください。"
      );
    } catch (e) {
      console.error("パスワード再設定メール送信失敗:", e);
      setError(
        "再設定メールの送信に失敗しました。メールアドレスを確認して再度お試しください。"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="p4g-shell flex min-h-screen items-center justify-center p-4 text-white">
      <div className="w-full max-w-md overflow-hidden rounded-[30px] border-[4px] border-black bg-[linear-gradient(180deg,#0f0f0f_0%,#181818_100%)] shadow-[0_14px_0_rgba(0,0,0,0.25),0_24px_54px_rgba(0,0,0,0.34)]">
        <div className="relative overflow-hidden border-b-[4px] border-black bg-[linear-gradient(90deg,#111111_0%,#1a1a1a_100%)] px-5 py-4 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0_58%,rgba(255,213,0,0.18)_58%_63%,transparent_63%_100%),linear-gradient(90deg,rgba(255,213,0,0.16),rgba(255,213,0,0))]" />
          <div className="relative z-10">
            <div className="p4g-brand-ribbon">
              <span>Regal Cast Database</span>
            </div>
            <p className="mt-4 text-xs font-black tracking-[0.18em] text-white/80">
              PASSWORD RESET
            </p>
            <h1 className="mt-1 text-3xl font-black text-white">
              パスワード再設定
            </h1>
          </div>
        </div>

        <div className="px-5 py-6 text-white">
          <div className="mb-5">
            <div className="inline-flex items-center rounded-full border-2 border-[#f3cb16] bg-black px-3 py-1 text-xs font-black text-[#ffe46a]">
              RESET
            </div>
            <p className="mt-4 text-sm leading-6 text-white/80">
              登録済みのメールアドレスを入力すると、パスワード再設定用のメールを送信します。
            </p>
          </div>

          <div className="mb-4">
            <label className="p4g-label">メールアドレス</label>
            <input
              className="p4g-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sample@company.com"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-[18px] border-[3px] border-black bg-[#ffd0d0] px-4 py-3 text-sm font-black text-[#7b1111]">
              {error}
            </p>
          )}

          {successMessage && (
            <p className="mb-4 rounded-[18px] border-[3px] border-black bg-[#fff27a] px-4 py-3 text-sm font-black text-black">
              {successMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={submitting}
            className="p4g-button p4g-button-gold w-full disabled:opacity-50"
          >
            {submitting ? "送信中..." : "再設定メールを送信"}
          </button>

          <div className="mt-4 flex justify-center">
            <Link
              href="/login"
              className="text-sm font-bold text-[#ffe46a] underline underline-offset-4 transition hover:text-white"
            >
              ログイン画面に戻る
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}