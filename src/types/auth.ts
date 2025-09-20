// Update to match your existing auth system
export interface User {
  userId: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}