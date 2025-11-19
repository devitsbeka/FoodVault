import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Check if error is a network error (backend unavailable)
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // TypeError typically means network error (fetch failed)
    return error.message.includes("fetch") || 
           error.message.includes("Failed to fetch") ||
           error.message.includes("NetworkError") ||
           error.message.includes("Network request failed");
  }
  if (error instanceof Error) {
    return error.message.includes("NetworkError") ||
           error.message.includes("Failed to fetch") ||
           error.message.includes("network") ||
           error.message.includes("aborted") ||
           error.name === "AbortError";
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return false;
}

// Create abort signal with timeout (polyfill for older browsers)
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  // Use native timeout if available
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }
  // Fallback: create manual abort controller
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Re-throw network errors so callers can handle them
    if (isNetworkError(error)) {
      throw error;
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
type NetworkErrorBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  onNetworkError?: NetworkErrorBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, onNetworkError = "returnNull" }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
        // Add timeout to prevent hanging - shorter timeout for faster failure
        signal: createTimeoutSignal(3000), // 3 second timeout
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Handle network errors gracefully
      if (isNetworkError(error)) {
        if (onNetworkError === "returnNull") {
          return null as T;
        }
        throw error;
      }
      // Re-throw other errors (HTTP errors, etc.)
      throw error;
    }
  };

// Stub query function that returns empty data instead of making API calls
const stubQueryFn: QueryFunction<any> = async () => {
  // Return empty data for all queries (no backend)
  return null;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: stubQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
      // Don't throw errors - just return null
      throwOnError: false,
    },
    mutations: {
      retry: false,
      throwOnError: false,
    },
  },
});
