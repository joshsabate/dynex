import { useEffect, useRef } from "react";
import { replaceLibraryItems } from "../lib/librarySupabase";

export default function useSupabaseCollectionSync({
  items,
  libraryKey,
  enabled = true,
  debounceMs = 400,
}) {
  const hasInitializedRef = useRef(false);
  const lastSyncedValueRef = useRef("");

  useEffect(() => {
    if (!enabled) {
      hasInitializedRef.current = false;
      lastSyncedValueRef.current = "";
      return undefined;
    }

    const serializedItems = JSON.stringify(items || []);

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      lastSyncedValueRef.current = serializedItems;
      return undefined;
    }

    if (serializedItems === lastSyncedValueRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await replaceLibraryItems(libraryKey, items || []);
        lastSyncedValueRef.current = serializedItems;
      } catch (error) {
        console.error(`Failed to sync ${libraryKey} to Supabase:`, error);
      }
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, enabled, items, libraryKey]);
}
