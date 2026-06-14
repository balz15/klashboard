import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import { navigate } from '../lib/router';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  displayName: string;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function fullNameFromMetadata(authUser: User | null | undefined): string {
  const raw =
    authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.name;
  return typeof raw === 'string' ? raw.trim() : '';
}

function resolveDisplayName(profile: Profile | null, authUser: User | null): string {
  return (
    profile?.full_name?.trim() ||
    fullNameFromMetadata(authUser) ||
    profile?.email?.split('@')[0] ||
    authUser?.email?.split('@')[0] ||
    'User'
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = useMemo(() => resolveDisplayName(profile, user), [profile, user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void syncProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void syncProfile(session.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncProfile = async (authUser: User, preferredName?: string) => {
    try {
      const name = (preferredName ?? fullNameFromMetadata(authUser)).trim();
      const email = authUser.email ?? '';

      const { data: existing, error: readError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (readError) throw readError;

      if (existing) {
        if (name && !existing.full_name?.trim()) {
          const { data: updated, error: updateError } = await supabase
            .from('profiles')
            .update({ full_name: name })
            .eq('id', authUser.id)
            .select('*')
            .maybeSingle();
          if (updateError) throw updateError;
          setProfile(updated ?? { ...existing, full_name: name });
          return;
        }
        setProfile(existing);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email,
          full_name: name,
        })
        .select('*')
        .single();

      if (insertError) {
        const { data: upserted, error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            { id: authUser.id, email, full_name: name },
            { onConflict: 'id' }
          )
          .select('*')
          .single();
        if (upsertError) throw upsertError;
        setProfile(upserted);
        return;
      }

      setProfile(inserted);
    } catch (error) {
      console.error('Error syncing profile:', error);
      setProfile({
        id: authUser.id,
        email: authUser.email ?? '',
        full_name: fullNameFromMetadata(authUser),
        created_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const trimmedName = fullName.trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: trimmedName,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      setUser(data.user);
      if (data.session) {
        await syncProfile(data.user, trimmedName);
        navigate('/dashboard');
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      setUser(data.user);
      await syncProfile(data.user);
      navigate('/dashboard');
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, displayName, loading, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
