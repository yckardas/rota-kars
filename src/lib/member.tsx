import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, post } from "./api";
export type Member = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  emailVerified: boolean;
  phone: string;
};
export type Coupon = {
  id: string;
  percent: number;
  source: string;
  policy_json?: string;
  expires_at: number;
  used_reservation: string | null;
};
export type MemberDashboard = {
  member: Member;
  coupons: Coupon[];
  spin: {
    prize_index: number;
    coupon_id: string;
    sectors_json?: string;
  } | null;
  referrals: { total: number; rewarded: number };
  reservations: {
    reference: string;
    total: number;
    status: string;
    date: string;
    tourId: string;
  }[];
};
type AuthState = {
  member: Member | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const MemberContext = createContext<AuthState>({
  member: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});
export function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null),
    [loading, setLoading] = useState(true);
  async function refresh() {
    try {
      const data = await api<{ member: Member | null }>("/auth/me");
      setMember(data.member);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh().catch(() => {});
  }, []);
  async function logout() {
    await post("/auth/logout", {});
    setMember(null);
  }
  return (
    <MemberContext.Provider value={{ member, loading, refresh, logout }}>
      {children}
    </MemberContext.Provider>
  );
}
export const useMember = () => useContext(MemberContext);
