"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

type Props = {
  onUpload: (url: string) => void;
};

const MAX_FILE_SIZE_MB = 5;
const ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatAcceptTypes() {
  return "JPEG / PNG / WEBP";
}

function validateFile(file: File) {
  if (!ACCEPT_TYPES.includes(file.type)) {
    return `対応形式は ${formatAcceptTypes()} です。`;
  }

  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `ファイルサイズは ${MAX_FILE_SIZE_MB}MB 以下にしてください。`;
  }

  return "";
}

export default function ImageUploader({ onUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [error, setError] = useState("");

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";

  const isConfigReady = useMemo(() => {
    return cloudName !== "" && uploadPreset !== "";
  }, [cloudName, uploadPreset]);

  const openPicker = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isConfigReady) {
      setError(
        "Cloudinary の環境変数が未設定です。NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME と NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET を確認してください。"
      );
      return;
    }

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Cloudinary error:", data);
        setError("画像のアップロードに失敗しました。設定または通信状態を確認してください。");
        return;
      }

      if (data?.secure_url) {
        onUpload(data.secure_url);
      } else {
        console.error("Unexpected Cloudinary response:", data);
        setError("画像URLの取得に失敗しました。");
      }
    } catch (uploadError) {
      console.error(uploadError);
      setError("アップロード中にエラーが発生しました。");
    } finally {
      setUploading(false);
    }
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    setSelectedFileName(file.name);
    await uploadFile(file);
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_TYPES.join(",")}
        className="hidden"
        onChange={handleChange}
      />

      <div className="rounded-[22px] border-[3px] border-black bg-[linear-gradient(180deg,#fff7cf_0%,#f4e194_100%)] p-4 shadow-[0_5px_0_rgba(0,0,0,0.14)]">
        <div className="flex flex-col gap-3">
          <div className="rounded-[18px] border-[2px] border-black bg-white px-4 py-3">
            <p className="text-xs font-black text-[#6a624f]">アップロード対応形式</p>
            <p className="mt-1 text-sm font-black">{formatAcceptTypes()}</p>
          </div>

          <div className="rounded-[18px] border-[2px] border-black bg-white px-4 py-3">
            <p className="text-xs font-black text-[#6a624f]">ファイルサイズ上限</p>
            <p className="mt-1 text-sm font-black">{MAX_FILE_SIZE_MB}MB</p>
          </div>

          {selectedFileName && (
            <div className="rounded-[18px] border-[2px] border-black bg-[#fffdf2] px-4 py-3">
              <p className="text-xs font-black text-[#6a624f]">選択中のファイル</p>
              <p className="mt-1 break-all text-sm font-black">{selectedFileName}</p>
            </div>
          )}

          {error && (
            <div className="rounded-[18px] border-[3px] border-black bg-[#ffd7d7] px-4 py-3 text-sm font-black text-[#861717]">
              {error}
            </div>
          )}

          {!isConfigReady && !error && (
            <div className="rounded-[18px] border-[3px] border-black bg-[#dff4ff] px-4 py-3 text-sm font-black text-[#0c4e80]">
              Cloudinary設定が未入力です。環境変数を設定するとアップロードできます。
            </div>
          )}

          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="w-full rounded-[18px] border-[3px] border-black bg-[linear-gradient(180deg,#fff174_0%,#f7c90b_100%)] px-4 py-3 text-base font-black text-black shadow-[0_5px_0_rgba(0,0,0,0.16)] transition hover:brightness-105 disabled:opacity-50"
          >
            {uploading ? "アップロード中..." : "写真をアップロード"}
          </button>
        </div>
      </div>
    </div>
  );
}