import {
  DB_NAME,
  DB_VERSION,
  STORE_NAME
} from "@/lib/constants";

import type {
  AppSettings,
  Conversation
} from "@/types/chat";

type RecordValue = {
  key: string;
  value: unknown;
};

let dbPromise:
  | Promise<IDBDatabase>
  | null = null;

function openDb() {
  if (
    typeof window === "undefined"
  ) {
    return Promise.reject(
      new Error(
        "Browser storage is unavailable on the server."
      )
    );
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise =
    new Promise<IDBDatabase>(
      (resolve, reject) => {
        const request =
          indexedDB.open(
            DB_NAME,
            DB_VERSION
          );

        request.onupgradeneeded =
          () => {
            const db = request.result;

            if (
              !db.objectStoreNames.contains(
                STORE_NAME
              )
            ) {
              db.createObjectStore(
                STORE_NAME,
                {
                  keyPath: "key"
                }
              );
            }
          };

        request.onsuccess = () =>
          resolve(request.result);

        request.onerror = () =>
          reject(
            request.error ??
              new Error(
                "IndexedDB open failed."
              )
          );
      }
    );

  return dbPromise;
}

async function write<T>(
  key: string,
  value: T
) {
  const db = await openDb();

  await new Promise<void>(
    (resolve, reject) => {
      const tx =
        db.transaction(
          STORE_NAME,
          "readwrite"
        );

      tx.objectStore(
        STORE_NAME
      ).put({
        key,
        value
      } satisfies RecordValue);

      tx.oncomplete = () =>
        resolve();

      tx.onerror = () =>
        reject(
          tx.error ??
            new Error(
              "Storage write failed."
            )
        );
    }
  );
}

async function read<T>(
  key: string
): Promise<T | null> {
  const db = await openDb();

  return new Promise<T | null>(
    (resolve, reject) => {
      const request =
        db
          .transaction(
            STORE_NAME,
            "readonly"
          )
          .objectStore(
            STORE_NAME
          )
          .get(key);

      request.onsuccess = () =>
        resolve(
          (request.result
            ?.value as T | undefined) ??
            null
        );

      request.onerror = () =>
        reject(
          request.error ??
            new Error(
              "Storage read failed."
            )
        );
    }
  );
}

export const memoryStore = {
  async loadConversations() {
    return (
      (await read<Conversation[]>(
        "conversations"
      )) ?? []
    );
  },

  async saveConversations(
    items: Conversation[]
  ) {
    await write(
      "conversations",
      items
    );
  },

  async loadSettings() {
    return read<AppSettings>(
      "settings"
    );
  },

  async saveSettings(
    settings: AppSettings
  ) {
    await write(
      "settings",
      settings
    );
  },

  async saveSnapshot(
    conversations: Conversation[],
    settings: AppSettings
  ) {
    await write("snapshot", {
      conversations,
      settings,
      createdAt: Date.now()
    });
  },

  async loadSnapshot() {
    return read<{
      conversations: Conversation[];
      settings: AppSettings;
      createdAt: number;
    }>("snapshot");
  }
};