import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

interface SignupData {
  email: string;
  password: string;
  name: string;
}

interface SigninData {
  email: string;
  password: string;
}

type AuthResponse = {
  token?: string;
  user?: {
    email?: string;
    balance?: number;
  };
};

function persistSession(email: string, token: string) {
  localStorage.setItem('token', token);
  localStorage.setItem('userEmail', email);
}

export function readStoredSession() {
  if (typeof window === 'undefined') {
    return {
      token: null,
      userEmail: null,
      isAuthenticated: false,
    };
  }

  const token = localStorage.getItem('token');
  const userEmail = localStorage.getItem('userEmail');

  return {
    token,
    userEmail,
    isAuthenticated: Boolean(token),
  };
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SignupData) => {
      const response = await api.post('/auth/signup', data);
      const payload = response.data as AuthResponse;

      if (payload.token) {
        persistSession(data.email, payload.token);
      }

      if (typeof payload.user?.balance === 'number') {
        queryClient.setQueryData(['balance', data.email], {
          balance: payload.user.balance,
        });
      }

      return payload;
    },
  });
}

export function useSignin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SigninData) => {
      const response = await api.post('/auth/signin', data);
      const payload = response.data as AuthResponse;

      if (payload.token) {
        persistSession(data.email, payload.token);
      }

      if (typeof payload.user?.balance === 'number') {
        queryClient.setQueryData(['balance', data.email], {
          balance: payload.user.balance,
        });
      }

      return payload;
    },
  });
}

export function useLogout() {
  return () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    window.location.href = '/';
  };
}

export function isAuthenticated() {
  return readStoredSession().isAuthenticated;
}

export function getUserEmail() {
  return readStoredSession().userEmail;
}
