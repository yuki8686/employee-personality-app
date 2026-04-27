"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";

type UserProfile = {
  uid: string;
  name?: string;
  nameKana?: string;
  email?: string;
  role?: string;
  departmentName?: string;
  departmentId?: string;
  partnerCompany?: string;
  status?: string;
  hobbies?: string;
  birthplace?: string;
  birthday?: string;
  bio?: string;
};

function normalizeRole(value?: string) {
  return (value || "").trim().toLowerCase();
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isValidBirthday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const [year, month, day] = value.split("-").map(Number);

  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  );
}

function splitBirthday(value?: string) {
  if (!value || !isValidBirthday(value)) {
    return { year: "", month: "", day: "" };
  }

  const [year, month, day] = value.split("-");
  return { year, month, day };
}

function PanelFrame({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[18px] border-[3px] border-black bg-[#171717] shadow-[0_5px_0_#000] md:rounded-[28px] md:border-[4px] md:shadow-[0_10px_0_#000] ${className}`}
    >
      <div className="absolute left-0 top-0 h-2 w-full bg-[#f3c400] md:h-3" />
      <div className="absolute right-3 top-3 h-3 w-3 rotate-45 border-2 border-black bg-[#ffe46a] md:right-4 md:top-4 md:h-4 md:w-4" />
      <div className="relative p-3 pt-4 md:p-5 md:pt-7">
        {title && (
          <div className="mb-2 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.06em] text-black shadow-[0_3px_0_#000] md:mb-4 md:px-3 md:text-xs md:tracking-normal md:shadow-[0_4px_0_#000]">
            {title}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <label className="block rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <span className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-2 w-full rounded-[12px] border-[3px] border-black bg-[#1a1a1a] px-3 py-2 text-[13px] font-bold text-white outline-none placeholder:text-white/35 focus:bg-[#202020] md:mt-3 md:rounded-[16px] md:px-4 md:py-3 md:text-sm"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <label className="block rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <span className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        className="mt-2 w-full resize-none rounded-[12px] border-[3px] border-black bg-[#1a1a1a] px-3 py-2 text-[13px] font-bold leading-6 text-white outline-none placeholder:text-white/35 focus:bg-[#202020] md:mt-3 md:rounded-[16px] md:px-4 md:py-3 md:text-sm md:leading-7"
      />
    </label>
  );
}

function SelectBox({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full appearance-none rounded-[12px] border-[3px] border-black bg-[#1a1a1a] px-3 py-2 text-[13px] font-black text-white outline-none focus:bg-[#202020] md:mt-3 md:rounded-[16px] md:px-4 md:py-3 md:text-sm"
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BirthdaySelect({
  birthYear,
  birthMonth,
  birthDay,
  setBirthYear,
  setBirthMonth,
  setBirthDay,
}: {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  setBirthYear: (value: string) => void;
  setBirthMonth: (value: string) => void;
  setBirthDay: (value: string) => void;
}) {
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1900 + 1 }, (_, index) =>
      String(currentYear - index)
    );

    return [
      { value: "", label: "年" },
      ...years.map((year) => ({ value: year, label: `${year}年` })),
    ];
  }, []);

  const monthOptions = useMemo(
    () => [
      { value: "", label: "月" },
      ...Array.from({ length: 12 }, (_, index) => {
        const value = pad2(index + 1);
        return { value, label: `${value}月` };
      }),
    ],
    []
  );

  const dayOptions = useMemo(
    () => [
      { value: "", label: "日" },
      ...Array.from({ length: 31 }, (_, index) => {
        const value = pad2(index + 1);
        return { value, label: `${value}日` };
      }),
    ],
    []
  );

  return (
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        誕生日
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 md:mt-3 md:gap-3">
        <SelectBox
          label="年"
          value={birthYear}
          onChange={setBirthYear}
          options={yearOptions}
        />
        <SelectBox
          label="月"
          value={birthMonth}
          onChange={setBirthMonth}
          options={monthOptions}
        />
        <SelectBox
          label="日"
          value={birthDay}
          onChange={setBirthDay}
          options={dayOptions}
        />
      </div>
    </div>
  );
}

export default function ProfileEditPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const [hobbies, setHobbies] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (!userSnap.exists()) {
          router.push("/login");
          return;
        }

        const data = {
          ...(userSnap.data() as Omit<UserProfile, "uid">),
          uid: user.uid,
        };

        const birthdayParts = splitBirthday(data.birthday);

        setProfile(data);
        setHobbies(typeof data.hobbies === "string" ? data.hobbies : "");
        setBirthplace(typeof data.birthplace === "string" ? data.birthplace : "");
        setBirthYear(birthdayParts.year);
        setBirthMonth(birthdayParts.month);
        setBirthDay(birthdayParts.day);
        setBio(typeof data.bio === "string" ? data.bio : "");
      } catch (e) {
        console.error("profile/edit 読み込み失敗:", e);
        setError("プロフィール情報の読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleSave() {
    if (!profile?.uid) return;

    setError("");
    setSavedMessage("");

    const hasAnyBirthdayValue = birthYear !== "" || birthMonth !== "" || birthDay !== "";
    const hasAllBirthdayValues = birthYear !== "" && birthMonth !== "" && birthDay !== "";
    const birthday = hasAllBirthdayValues
      ? `${birthYear}-${birthMonth}-${birthDay}`
      : "";

    if (hasAnyBirthdayValue && !hasAllBirthdayValues) {
      setError("誕生日は年・月・日をすべて選択してください。");
      return;
    }

    if (birthday !== "" && !isValidBirthday(birthday)) {
      setError("存在しない日付が選択されています。誕生日を確認してください。");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        hobbies: hobbies.trim() !== "" ? hobbies.trim() : deleteField(),
        birthplace:
          birthplace.trim() !== "" ? birthplace.trim() : deleteField(),
        birthday: birthday !== "" ? birthday : deleteField(),
        bio: bio.trim() !== "" ? bio.trim() : deleteField(),
      };

      await updateDoc(doc(db, "users", profile.uid), payload);

      setSavedMessage("プロフィールを保存しました。");
      setTimeout(() => {
        router.push("/profile");
      }, 700);
    } catch (e) {
      console.error("profile/edit 保存失敗:", e);
      setError("プロフィールの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  const role = normalizeRole(profile?.role);

  if (loading) {
    return (
      <P4LoadingScreen
        title="PROFILE EDIT LOADING"
        subtitle="プロフィール編集画面を読み込み中..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-3.5 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div>
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  PROFILE EDIT
                </div>
                <h1 className="mt-2.5 text-[24px] font-black leading-tight md:mt-4 md:text-4xl">
                  プロフィール編集
                </h1>
                <p className="mt-2 max-w-3xl text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-normal">
                  誕生日や出身地、趣味など、社員同士の会話のきっかけになる情報を編集できます。
                </p>
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={role} />
              </div>
            </div>
          </PanelFrame>

          {error && (
            <div className="rounded-[16px] border-[4px] border-black bg-[#ffd0d0] px-4 py-3 text-[13px] font-black text-[#7b1111] shadow-[0_5px_0_#000] md:rounded-[22px] md:text-sm md:shadow-[0_8px_0_#000]">
              {error}
            </div>
          )}

          {savedMessage && (
            <div className="rounded-[16px] border-[4px] border-black bg-[#d9f7ff] px-4 py-3 text-[13px] font-black text-black shadow-[0_5px_0_#000] md:rounded-[22px] md:text-sm md:shadow-[0_8px_0_#000]">
              {savedMessage}
            </div>
          )}

          <PanelFrame title="パーソナル情報">
            <div className="grid gap-3 md:gap-4 md:grid-cols-2">
              <BirthdaySelect
                birthYear={birthYear}
                birthMonth={birthMonth}
                birthDay={birthDay}
                setBirthYear={setBirthYear}
                setBirthMonth={setBirthMonth}
                setBirthDay={setBirthDay}
              />

              <TextInput
                label="出身地"
                value={birthplace}
                onChange={setBirthplace}
                placeholder="例：大阪府"
                maxLength={40}
              />

              <div className="md:col-span-2">
              <TextInput
                label="趣味・最近ハマっていることやもの"
                value={hobbies}
                onChange={setHobbies}
                placeholder="例：映画、ゲーム、カフェ巡り"
                maxLength={100}
              />
              </div>

              <div className="md:col-span-2">
                <TextArea
                  label="ひとこと自己紹介"
                  value={bio}
                  onChange={setBio}
                  placeholder="例：人の強みを見つけるのが好きです。"
                  maxLength={240}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5 md:mt-5 md:gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="group relative overflow-hidden rounded-[12px] border-[3px] border-black bg-[#f3c400] px-4 py-2 text-[12px] font-black text-black shadow-[0_5px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_8px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000] disabled:cursor-not-allowed disabled:opacity-60 md:rounded-[16px] md:text-sm md:shadow-[0_6px_0_#000]"
              >
                <span className="relative z-10">
                  {saving ? "保存中..." : "保存する"}
                </span>
                <span className="absolute inset-y-0 left-0 w-2 bg-white/15 transition-all duration-200 group-hover:w-4" />
              </button>

              <Link
                href="/profile"
                className="group relative overflow-hidden rounded-[12px] border-[3px] border-black bg-[#111111] px-4 py-2 text-[12px] font-black text-white shadow-[0_5px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1d1d1d] hover:shadow-[0_8px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000] md:rounded-[16px] md:text-sm md:shadow-[0_6px_0_#000]"
              >
                <span className="relative z-10">戻る</span>
                <span className="absolute inset-y-0 left-0 w-2 bg-white/15 transition-all duration-200 group-hover:w-4" />
              </Link>
            </div>
          </PanelFrame>
        </div>
      </main>

      <P4BottomNav role={role} />
    </>
  );
}
