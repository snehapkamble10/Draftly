"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState, useEffect} from "react";


export default function LoginPage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || status === "loading") {
    return (
      <div className="p-10" suppressHydrationWarning>
        Checking authentication...
      </div>
    );
  }

  if (session) {
    return (
      <div className="p-10 flex flex-col items-start gap-4">
        <h1 className="text-2xl font-bold">Welcome, {session.user?.name}</h1>
        <p className="text-gray-600">Logged in as: {session.user?.email}</p>
        <button 
          onClick={() => signOut()}
          className="bg-gray-800 text-white px-6 py-2 rounded-lg"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="p-10 flex flex-col items-center justify-center min-h-screen">
      <div className="border p-8 rounded-xl shadow-lg bg-white text-center">
        <h1 className="text-3xl font-bold mb-6">AI Email Assistant</h1>
        <p className="mb-6 text-gray-500">Log in to sync your Gmail and generate replies.</p>
        
        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-3 bg-white border border-gray-300 px-6 py-3 rounded-full hover:bg-gray-50 transition-all font-medium"
        >
          <img 
            src="https://authjs.dev/img/providers/google.svg" 
            alt="Google" 
            className="w-5 h-5" 
          />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}