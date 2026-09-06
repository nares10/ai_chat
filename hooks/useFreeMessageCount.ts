import { useState, useEffect } from "react";
import { FREE_MESSAGE_LIMIT } from "@/lib/freeMessages";

interface User {
  id: string;
  email: string;
  name: string;
  freeMessagesUsed: number;
}

export function useFreeMessageCount(user: User | null) {
  const [freeMessagesUsed, setFreeMessagesUsed] = useState(user?.freeMessagesUsed || 0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setFreeMessagesUsed(0);
      return;
    }

    setFreeMessagesUsed(user.freeMessagesUsed);
  }, [user]);

  const refreshCount = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setFreeMessagesUsed(data.user.freeMessagesUsed);
      }
    } catch (error) {
      console.error("Failed to refresh free message count", error);
    } finally {
      setIsLoading(false);
    }
  };

  const remainingFreeMessages = Math.max(0, FREE_MESSAGE_LIMIT - freeMessagesUsed);
  const hasReachedLimit = freeMessagesUsed >= FREE_MESSAGE_LIMIT;

  return {
    freeMessagesUsed,
    remainingFreeMessages,
    hasReachedLimit,
    isLoading,
    refreshCount,
  };
}