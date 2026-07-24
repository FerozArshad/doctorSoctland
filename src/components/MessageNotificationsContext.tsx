"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MessageNotifications, NotificationItem } from "@/lib/messages";
import { dismissNotification, markNotificationRead } from "@/app/admin/notification-actions";

const EMPTY: MessageNotifications = {
  items: [],
  recentSent: [],
  upcoming: [],
  alertCount: 0,
};

type Ctx = MessageNotifications & {
  markRead: (key: string) => void;
  remove: (key: string) => void;
  refresh: () => void;
  loading: boolean;
};

const MessageNotificationsContext = createContext<Ctx>({
  ...EMPTY,
  markRead: () => {},
  remove: () => {},
  refresh: () => {},
  loading: true,
});

function applyRead(items: NotificationItem[], key: string) {
  return items.map((i) => (i.key === key ? { ...i, unread: false } : i));
}

export function MessageNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MessageNotifications>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch("/api/admin/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((json: MessageNotifications) => setData(json))
      .catch(() => setData(EMPTY))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = useCallback((key: string) => {
    setData((prev) => ({
      ...prev,
      items: applyRead(prev.items, key),
      alertCount: Math.max(0, prev.alertCount - 1),
    }));
    void markNotificationRead(key);
  }, []);

  const remove = useCallback((key: string) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.key !== key),
      alertCount: Math.max(0, prev.alertCount - 1),
    }));
    void dismissNotification(key);
  }, []);

  return (
    <MessageNotificationsContext.Provider
      value={{
        items: data.items,
        recentSent: data.recentSent,
        upcoming: data.upcoming,
        alertCount: data.alertCount,
        loading,
        markRead,
        remove,
        refresh,
      }}
    >
      {children}
    </MessageNotificationsContext.Provider>
  );
}

export function useMessageNotifications() {
  return useContext(MessageNotificationsContext);
}
