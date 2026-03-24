"use client";

import { useState } from "react";

type Props = {
  onUpload: (url: string) => void;
};

export default function ImageUploader({ onUpload }: Props) {
  const [uploading, setUploading] = useState(false);

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
        alert("アップロード失敗");
      }
    } catch (error) {
      console.error(error);
      alert("アップロード中にエラーが発生しました");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleUpload(e.target.files[0]);
          }
        }}
      />
      {uploading && <p className="mt-2 text-sm text-gray-500">アップロード中...</p>}
    </div>
  );
}