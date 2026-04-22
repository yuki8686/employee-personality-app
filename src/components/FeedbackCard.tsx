"use client";

type Props = {
  fromUserName?: string;
  createdAt?: string;
  challenge?: string;
  impression?: string;
  expectation?: string;
  comment?: string;
};

export default function FeedbackCard({
  fromUserName = "匿名",
  createdAt = "-",
  challenge = "-",
  impression = "-",
  expectation = "-",
  comment = "-",
}: Props) {
  return (
    <div className="p4g-feedback-card overflow-hidden">
      <div className="border-b-[3px] border-black bg-[linear-gradient(90deg,#111_0%,#1e1e1e_100%)] px-4 py-3 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-[#ffe46a]">
              FEEDBACK LOG
            </p>
            <p className="mt-1 text-lg font-black">{fromUserName}</p>
          </div>

          <span className="rounded-full border-[2px] border-[#ffe46a] bg-black px-3 py-1 text-xs font-black text-[#ffe46a]">
            {createdAt}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5">
        <div className="rounded-[16px] border-[2px] border-black bg-white px-4 py-3">
          <p className="text-xs font-black text-[#6a624f]">現在の課題</p>
          <p className="mt-1 text-sm font-bold leading-6">{challenge}</p>
        </div>

        <div className="rounded-[16px] border-[2px] border-black bg-white px-4 py-3">
          <p className="text-xs font-black text-[#6a624f]">印象</p>
          <p className="mt-1 text-sm font-bold leading-6">{impression}</p>
        </div>

        <div className="rounded-[16px] border-[2px] border-black bg-white px-4 py-3">
          <p className="text-xs font-black text-[#6a624f]">期待していること</p>
          <p className="mt-1 text-sm font-bold leading-6">{expectation}</p>
        </div>

        <div className="rounded-[16px] border-[2px] border-black bg-[#fff7d0] px-4 py-3">
          <p className="text-xs font-black text-[#6a624f]">コメント</p>
          <p className="mt-1 text-sm font-bold leading-6">{comment}</p>
        </div>
      </div>
    </div>
  );
}