import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useEffect } from "react";

export function useAuth() {
  const { user: clerkUser, isLoaded } = useUser();
  
  // Sync Clerk user to our database
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!clerkUser) return;
      
      await apiRequest("/api/auth/sync", "POST", {
        userId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || null,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  // Sync user on first load
  useEffect(() => {
    if (isLoaded && clerkUser && !syncMutation.isPending) {
      syncMutation.mutate();
    }
  }, [isLoaded, clerkUser?.id]);

  // Fetch our database user
  const { data: user, isLoading: isDbLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isLoaded && !!clerkUser,
  });

  return {
    user,
    isLoading: !isLoaded || isDbLoading || syncMutation.isPending,
    isAuthenticated: isLoaded && !!clerkUser,
  };
}
