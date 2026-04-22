"use client";

import Image from "next/image";

type Props = {
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  profileImageUrl?: string;
  mbti?: string;
  businessCode?: string;
  confidence?: number;
  diagnosedAt?: string;
  compact?: boolean;
  showEmail?: boolean;
  showDepartment?: boolean;
  showRole?: boolean;
  showConfidence?: boolean;
};

export default function ProfileCard({
  name = "名前未設定",
  email = "-",
  role = "-",
  department = "-",
  profileImageUrl = "",
  mbti = "-",
  businessCode = "-",
  confidence,
  diagnosedAt = "-",
  compact = false,
  showEmail = true,
  showDepartment = true,
  showRole = true,
  showConfidence = true,
}: Props) {
  const infoCards = [
    showEmail
      ? {
          key: "email",
          label: "MAIL",
          value: email,
        }
      : null,
    showDepartment
      ? {
          key: "department",
          label: "DEPARTMENT",
          value: department,
        }
      : null,
    showRole
      ? {
          key: "role",
          label: "ROLE",
          value: role,
        }
      : null,
    showConfidence
      ? {
          key: "confidence",
          label: "CONFIDENCE",
          value: typeof confidence === "number" ? `${confidence}%` : "-",
        }
      : null,
  ].filter(
    (item): item is { key: string; label: string; value: string } => item !== null
  );

  return (
    <div className="p4g-card overflow-hidden">
      <div className="relative overflow-hidden border-b-[3px] border-black bg-[linear-gradient(180deg,#ffe547_0%,#ffd82e_36%,#ffcf17_100%)] p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.42),transparent_22%),radial-gradient(circle_at_78%_24%,rgba(255,255,255,0.18),transparent_20%),linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute inset-y-0 left-[14%] w-14 skew-x-[-28deg] bg-[linear-gradient(180deg,rgba(255,248,199,0.9)_0%,rgba(255,248,199,0.2)_100%)] sm:w-20" />
        <div className="pointer-events-none absolute inset-y-0 left-[33%] w-8 skew-x-[-28deg] bg-[linear-gradient(180deg,rgba(255,240,170,0.65)_0%,rgba(255,240,170,0.12)_100%)] sm:w-12" />
        <div className="pointer-events-none absolute right-[7%] top-0 h-full w-10 skew-x-[-28deg] bg-[linear-gradient(180deg,rgba(196,113,0,0.36)_0%,rgba(196,113,0,0.08)_100%)] sm:w-14" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-10 w-full bg-[linear-gradient(180deg,rgba(255,179,0,0)_0%,rgba(232,142,0,0.28)_100%)]" />

        <div
          className={`relative z-10 grid gap-4 ${
            compact ? "md:grid-cols-[96px_1fr]" : "md:grid-cols-[120px_1fr]"
          }`}
        >
          <div className="flex items-center justify-center md:justify-start">
            <div
              className={`${
                compact ? "h-24 w-24" : "h-28 w-28"
              } overflow-hidden rounded-[24px] border-[4px] border-black bg-[linear-gradient(180deg,#fff9df_0%,#efe2a8_100%)] shadow-[0_6px_0_rgba(0,0,0,0.18)]`}
            >
              {profileImageUrl ? (
                <Image
                  src={profileImageUrl}
                  alt={name}
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#666]">
                  NO IMAGE
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <div className="inline-flex w-fit rounded-[8px] border-[3px] border-black bg-[rgba(30,20,0,0.86)] px-3 py-1 shadow-[0_3px_0_rgba(0,0,0,0.16)]">
              <p className="text-[11px] font-black tracking-[0.18em] text-[#fff1a8]">
                REGAL CAST DATABASE
              </p>
            </div>

            <h3 className="mt-3 text-2xl font-black leading-tight text-[#3b2200] [text-shadow:0_2px_0_rgba(255,247,204,0.35)] sm:text-4xl">
              {name}
            </h3>

            <p className="mt-3 text-3xl font-black leading-none text-[#5a3200] [text-shadow:0_2px_0_rgba(255,247,204,0.4)] sm:text-5xl">
              {mbti} <span className="text-[#8a4f00]">×</span> {businessCode}
            </p>

            <div className="mt-3 inline-flex w-fit rounded-[10px] border-[3px] border-[#c97700] bg-[rgba(255,246,188,0.82)] px-3 py-1 shadow-[0_3px_0_rgba(0,0,0,0.12)]">
              <p className="text-sm font-black text-[#6e4200]">
                診断日 | {diagnosedAt}
              </p>
            </div>
          </div>
        </div>
      </div>

      {infoCards.length > 0 && (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {infoCards.map((card) => (
            <div
              key={card.key}
              className="rounded-[18px] border-[3px] border-[#f3cb16] bg-[linear-gradient(180deg,#121212_0%,#1c1c1c_100%)] px-4 py-3 text-white shadow-[inset_0_0_0_1px_rgba(255,235,120,0.06)]"
            >
              <p className="text-xs font-black tracking-[0.08em] text-[#ffd95c]">
                {card.label}
              </p>
              <p className="mt-1 break-all text-sm font-black text-white">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}