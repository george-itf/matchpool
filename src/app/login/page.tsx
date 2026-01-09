"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (authError) {
        setError(authError.message || "Failed to send link");
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex flex-col justify-center px-5 py-12 safe-t safe-b">
      <div className="max-w-xs mx-auto w-full">
        <h1 className="text-lg font-medium mb-6">
          {sent ? "Check your email" : "Sign in"}
        </h1>

        {sent ? (
          <div className="text-sm text-[var(--muted)]">
            <p>Link sent to {email}</p>
            <button 
              onClick={() => setSent(false)} 
              className="mt-4 text-[var(--text)]"
            >
              Try different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            {error && <p className="text-sm text-[var(--red)]">{error}</p>}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2.5 bg-[var(--white)] text-[var(--bg)] rounded text-sm font-medium"
            >
              {loading ? "Sending..." : "Send link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
