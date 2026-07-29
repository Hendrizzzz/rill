import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  bootstrapSession,
  deleteAccount as deleteAccountRequest,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  saveAccountResult,
  SESSION_EXPIRED_EVENT,
  ApiError,
  type AccountUser,
  type SessionSnapshot,
} from "../../api/client";
import { flushAccountResults } from "../../api/pendingResults";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(null);

  const flushFor = useCallback((nextUser: AccountUser) => {
    setSyncNotice(null);
    void flushAccountResults(
      nextUser.id,
      async (result) => {
        if (activeUserId.current !== nextUser.id) {
          throw new Error("The active account changed before queue flush.");
        }
        return saveAccountResult(result);
      },
    ).then(({ discarded }) => {
      if (activeUserId.current === nextUser.id && discarded > 0) {
        setSyncNotice(
          discarded === 1
            ? "One queued result could not be synced and was removed."
            : `${String(discarded)} queued results could not be synced and were removed.`,
        );
      }
    });
  }, []);

  const applySession = useCallback(
    (snapshot: SessionSnapshot) => {
      const nextUser = snapshot.authenticated ? (snapshot.user ?? null) : null;
      activeUserId.current = nextUser?.id ?? null;
      setUser(nextUser);
      setStatus(nextUser === null ? "guest" : "authenticated");
      if (nextUser !== null) {
        flushFor(nextUser);
      }
    },
    [flushFor],
  );

  const markOffline = useCallback(() => {
    activeUserId.current = null;
    setUser(null);
    setSyncNotice(null);
    setStatus("offline");
  }, []);

  const retry = useCallback(async () => {
    setStatus("loading");
    try {
      applySession(await bootstrapSession());
    } catch {
      markOffline();
    }
  }, [applySession, markOffline]);

  useEffect(() => {
    let active = true;
    void bootstrapSession().then(
      (snapshot) => {
        if (active) {
          applySession(snapshot);
        }
      },
      () => {
        if (active) {
          markOffline();
        }
      },
    );
    return () => {
      active = false;
    };
  }, [applySession, markOffline]);

  useEffect(() => {
    const expireSession = () => {
      activeUserId.current = null;
      setUser(null);
      setSyncNotice(null);
      setStatus("guest");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession);
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      applySession(await loginRequest(username, password));
    },
    [applySession],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      applySession(await registerRequest(username, password));
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    const previousUserId = activeUserId.current;
    activeUserId.current = null;
    try {
      await logoutRequest();
      setUser(null);
      setSyncNotice(null);
      setStatus("guest");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setSyncNotice(null);
        setStatus("guest");
        return;
      }
      activeUserId.current = previousUserId;
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    const previousUserId = activeUserId.current;
    activeUserId.current = null;
    try {
      await deleteAccountRequest(password);
      setUser(null);
      setSyncNotice(null);
      setStatus("guest");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setSyncNotice(null);
        setStatus("guest");
        return;
      }
      activeUserId.current = previousUserId;
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      syncNotice,
      clearSyncNotice: () => setSyncNotice(null),
      signIn,
      register,
      signOut,
      deleteAccount,
      retry,
    }),
    [deleteAccount, register, retry, signIn, signOut, status, syncNotice, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
