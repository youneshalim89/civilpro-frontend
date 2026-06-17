'use client';
// src/app/login/page.tsx — Page de connexion
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Building2, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { authService } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const schema = z.object({
  email:        z.string().email('Email invalide'),
  mot_de_passe: z.string().min(6, 'Minimum 6 caractères'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router    = useRouter();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const [showPwd, setShowPwd] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authService.login(data.email, data.mot_de_passe);
      const payload = (res.data as any).data ?? res.data;
      setAuth(payload.user, payload.token);
      toast.success(`Bienvenue, ${payload.user.prenom} !`);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Identifiants incorrects';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500 rounded-2xl mb-4 shadow-lg">
            <Building2 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">CivilPro</h1>
          <p className="text-brand-400 mt-1 text-sm">Golden Leader — Gestion des Marchés</p>
        </div>

        {/* Carte */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Connexion</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="label">Adresse email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="vous@goldenleader.ma"
                  className={cn('input pl-10', errors.email && 'border-red-400')}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            {/* Mot de passe */}
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('mot_de_passe')}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cn('input pl-10 pr-10', errors.mot_de_passe && 'border-red-400')}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.mot_de_passe && <p className="text-xs text-red-500 mt-1">{errors.mot_de_passe.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 h-11 text-sm"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            CivilPro Golden Leader v1.0 · Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
