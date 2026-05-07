export type AuthState = {
  token?: string;
  status: "anonymous" | "authenticated";
};

export const initialAuthState: AuthState = {
  status: "anonymous"
};
