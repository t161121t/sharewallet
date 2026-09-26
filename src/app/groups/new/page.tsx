"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "konsta/react";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import Header from "@/components/layout/Header";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import ColorPalette from "@/components/ui/ColorPalette";
import GroupAvatar from "@/components/ui/GroupAvatar";
import Card from "@/components/ui/Card";
import { ApiClientError, createGroup, setSelectedGroupId } from "@/lib/apiClient";

export default function NewGroupPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#c9a227");
  const [iconUrl, setIconUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("5MB以下の画像を選択してください");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        setIconUrl(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("グループ名を入力してください");
      return;
    }
    setLoading(true);
    try {
      const group = await createGroup({ name: name.trim(), color, iconUrl });
      setSelectedGroupId(group.id);
      toast.success("グループを作成しました");
      router.push("/dashboard");
    } catch (e) {
      if (e instanceof ApiClientError) {
        toast.error(e.message);
      } else {
        toast.error("グループ作成に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer header={<Header title="グループ作成" showBackButton />}>
      <PageTransition className="flex flex-col w-full gap-5">
        <TextInput
          label="グループ名"
          placeholder="例: 旅行メンバー"
          value={name}
          onChange={setName}
        />
        <Card contentWrapPadding="p-4">
          <p className="text-base font-medium text-[#4a4540] dark:text-[#c5c0b8] mb-3">
            グループアイコン
          </p>
          <div className="flex items-center gap-4">
            <GroupAvatar name={name || "グループ"} color={color} iconUrl={iconUrl} size={56} />
            <div className="flex items-center gap-2">
              <Button rounded small onClick={() => fileRef.current?.click()}>
                画像を選択
              </Button>
              {iconUrl && (
                <Button
                  rounded
                  small
                  outline
                  onClick={() => {
                    setIconUrl(undefined);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  削除
                </Button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
        </Card>
        <ColorPalette value={color} onChange={setColor} />
        <PrimaryButton onClick={handleCreate} loading={loading}>
          作成する
        </PrimaryButton>
      </PageTransition>
    </ScreenContainer>
  );
}
