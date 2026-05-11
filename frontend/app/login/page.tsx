'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAuth, generateGuestId, isLoggedIn } from '@/lib/auth';
import ScholarMindLogo from '@/components/ScholarMindLogo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn()) router.replace('/');
  }, [router]);

  function handleGuest() {
    const guestId = generateGuestId();
    setAuth({ userId: guestId, username: 'Guest', token: 'guest' });
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <ScholarMindLogo size={120} />
          </div>
          <div>
            <h1 className="text-white font-bold text-2xl">ScholarMind</h1>
            <p className="text-[#9ca3af] text-sm mt-1">AI-powered study platform</p>
          </div>
        </div>

        <div className="bg-[#1c1e2e] border border-[#2a2d3e] rounded-xl p-6 space-y-3">
          <a
            href={`${API_BASE}/auth/github`}
            className="flex items-center justify-center gap-3 w-full bg-[#3ecf8e] text-[#0f1117] font-semibold py-3 px-6 rounded-full hover:bg-[#34b87a] transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Continue with GitHub
          </a>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#2a2d3e]" />
            <span className="text-[#9ca3af] text-xs">or</span>
            <div className="flex-1 h-px bg-[#2a2d3e]" />
          </div>

          <button
            onClick={handleGuest}
            className="w-full py-3 px-6 rounded-full border border-[#3ecf8e]/40 text-[#3ecf8e] text-sm font-medium hover:border-[#3ecf8e] hover:bg-[#3ecf8e]/10 transition-colors cursor-pointer"
          >
            Continue as Guest
          </button>
        </div>

        <p className="text-center text-[#9ca3af] text-xs">
          Guest sessions are stored locally and reset on page refresh.
        </p>
      </div>
    </div>
  );
}
