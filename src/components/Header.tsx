"use client";

type Props = {
  title: string;
  role?: string;
};

export default function Header({ title, role = "" }: Props) {
  return (
    <header className="p4g-topband px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-3">
        <div className="p4g-brand-ribbon">
          <span>Regal Cast Database</span>
        </div>

        <div>
          <p className="p4g-brand-sub">PERSONALITY DIAGNOSTIC SYSTEM</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          {role && (
            <div className="mt-3">
              <span className="p4g-pill">ROLE: {role}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}