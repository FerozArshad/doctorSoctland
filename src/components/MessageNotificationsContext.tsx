"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MessageNotifications, NotificationItem } from "@/lib/messages";
import { dismissNotification, markNotificationRead } from "@/app/admin/notification-actions";

type Ctx = MessageNotifications & {
  markRead: (key: string) => void;
  remove: (key: string) => void;
};

const MessageNotificationsContext = createContext<Ctx>({
  items: [],
  recentSent: [],
  upcoming: [],
  alertCount: 0,
  markRead: () => {},
  remove: () => {},
});

function applyRead(items: NotificationItem[], key: string) {
  return items.map((i) => (i.key === key ? { ...i, unread: false } : i));
}

export function MessageNotificationsProvider({
  data,
  children,
}: {
  data: MessageNotifications;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState(data.items);
  const [alertCount, setAlertCount] = useState(data.alertCount);

  useEffect(() => {
    setItems(data.items);
    setAlertCount(data.alertCount);
  }, [data]);

  const markRead = useCallback((key: string) => {
    setItems((prev) => applyRead(prev, key));
    setAlertCount((c) => Math.max(0, c - 1));
    void markNotificationRead(key);
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    setAlertCount((c) => Math.max(0, c - 1));
    void dismissNotification(key);
  }, []);

  return (
    <MessageNotificationsContext.Provider
      value={{
        items,
        recentSent: data.recentSent,
        upcoming: data.upcoming,
        alertCount,
        markRead,
        remove,
      }}
    >
      {children}
    </MessageNotificationsContext.Provider>
  );
}

export function useMessageNotifications() {
  return useContext(MessageNotificationsContext);
}
