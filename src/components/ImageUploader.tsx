"use client";

import { useRef, useState } from "react";

type Props = {
  onUpload: (url: string) => void;
};

export default function ImageUploader({ onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "upload_preset",
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ""
      );

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (data.secure_url) {
        onUpload(data.secure_url);
      } else {
        console.error(data);
        alert("アップロードに失敗しました");
      }
    } catch (error) {
      console.error(error);
      alert("アップロード中にエラーが発生しました");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleUpload(e.target.files[0]);
          }
        }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full rounded-[16px] border-[3px] border-black bg-gradient-to-b from-[#ffe75b] to-[#f4cb14] px-4 py-3 text-base font-black text-black shadow-[0_4px_0_rgba(0,0,0,0.14)] disabled:opacity-50"
      >
        {uploading ? "アップロード中..." : "写真をアップロード"}
      </button>
    </div>
  );
}