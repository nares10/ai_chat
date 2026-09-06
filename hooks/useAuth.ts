import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatUser } from "@/lib/chat-types";

export function useAuth() {
	const router = useRouter();
	const [user, setUser] = useState<ChatUser | null>(null);
	const [isCheckingAuth, setIsCheckingAuth] = useState(true);

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const response = await fetch("/api/auth/me");
				if (response.ok) {
					const data = await response.json();
					setUser(data.user);
				} else {
					router.push("/login");
				}
			} catch {
				router.push("/login");
			} finally {
				setIsCheckingAuth(false);
			}
		};

		void checkAuth();
	}, [router]);

	return { user, setUser, isCheckingAuth };
}