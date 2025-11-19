// Stub implementation for static frontend - no authentication needed
export function useAuth() {
  return {
    user: undefined,
    isLoading: false,
    isAuthenticated: false,
  };
}
