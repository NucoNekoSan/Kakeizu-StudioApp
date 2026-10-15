import { ApiError } from "../api/errors";

let generation = 0;

export const invalidateStores = () => {
  generation += 1;
};

export const storageResetError = () =>
  new ApiError(
    409,
    "STORAGE_RESET",
    "保存先が変更または削除されました。保存方法を選び直してから操作してください。",
  );

/** A previously acquired store must never reopen after deletion or mode change. */
export function createStoreLifetime() {
  const acquired = generation;
  let revoked = false;
  return {
    revoke: () => {
      revoked = true;
    },
    assertActive: () => {
      if (revoked || acquired !== generation) throw storageResetError();
    },
  };
}
