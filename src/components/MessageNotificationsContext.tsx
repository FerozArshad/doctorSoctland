"use client";

import { createContext, useContext } from "react";
import type { MessageNotifications } from "@/lib/messages";

const MessageNotificationsContext = createContext<MessageNotifications>({
  recentSent: [],
  upcoming: [],
  alertCount: 0,
});

export function MessageNotificationsProvider({
  data,
  children,
}: {
  data: MessageNotifications;
  children: React.ReactNode;
}) {
  return <MessageNotificationsContext.Provider value={data}>{children}</MessageNotificationsContext.Provider>;
}

export function useMessageNotifications() {
  return useContext(MessageNotificationsContext);
}
