import { useEffect, useState } from "react";
import type { ApiKey, ChatUser } from "@/lib/chat-types";

export function useApiKeys(user: ChatUser | null) {
	const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

	useEffect(() => {
		if (!user) return;

		const loadApiKeys = async () => {
			try {
				const response = await fetch("/api/keys");
				if (response.ok) {
					const data = await response.json();
					setApiKeys(data.apiKeys || []);
				}
			} catch (error) {
				console.error("Failed to load API keys", error);
			}
		};

		void loadApiKeys();
	}, [user]);

	return { apiKeys, setApiKeys };
}
