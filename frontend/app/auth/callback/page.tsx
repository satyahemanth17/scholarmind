'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAuth } from '@/lib/auth';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    const userId = params.get('userId');
    const username = params.get('username');
    const avatarUrl = params.get('avatarUrl') ?? undefined;

    if (token && userId && username) {
      setAuth({ userId, username, avatarUrl, token });
      router.replace('/');
    } else {
      router.replace('/login?error=auth_failed');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-[#3ecf8e]/20 flex items-center justify-center mx-auto">
          <span className="text-[#3ecf8e] font-bold">S</span>
        </div>
        <p className="text-[#9ca3af] text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
