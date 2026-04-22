export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-md mx-auto bg-black min-h-screen">
      {children}

      {/* ボトムナビ */}
      <div className="fixed bottom-0 w-full max-w-md bg-black border-t border-yellow-400 flex justify-around p-2">
        <button>ホーム</button>
        <button>マップ</button>
        <button>履歴</button>
        <button>設定</button>
      </div>
    </div>
  );
}