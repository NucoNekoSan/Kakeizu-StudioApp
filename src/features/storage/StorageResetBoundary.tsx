import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeStorageReset } from "../../storage/storageReset";
import { clearStorageMode } from "../../storage/storageMode";
import { resetStoreCache } from "../../storage/localApi";

/** 再読み込みの確認に依存せず、削除前の画面・フォーム・キャッシュを捨てる。 */
export default function StorageResetBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const client = useQueryClient();
  const [generation, setGeneration] = useState(0);
  useEffect(
    () =>
      subscribeStorageReset(() => {
        clearStorageMode();
        resetStoreCache({ invalidate: true });
        client.clear();
        setGeneration((current) => current + 1);
      }),
    [client],
  );
  return <Fragment key={generation}>{children}</Fragment>;
}
