"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState({ name: '', role: '', credits: 0 });
  const router = useRouter();

  const fetchUser = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/user', {
        headers: { 'user-id': userId }
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        router.push('/login');
      }
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchUser();
      const interval = setInterval(fetchUser, 10000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
