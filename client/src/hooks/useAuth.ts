// Blueprint reference: javascript_log_in_with_replit
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: (failureCount, error) => {
      // Don't retry 401 errors (user is not authenticated)
      if (error.message.startsWith('401:')) {
        return false;
      }
      // Retry network/transient errors up to 3 times
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });

  // Check if error is a 401 (user not authenticated)
  // Query client throws Error("401: message") format
  const is401 = error?.message?.startsWith('401:');

  return {
    user: is401 ? undefined : user,
    isLoading: isLoading,
    isAuthenticated: !is401 && !!user,
  };
}
