import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

type AuthTab = 'login' | 'register' | 'forgot';

const TVIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const AuthPage: React.FC = () => {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearState = () => { setError(''); setSuccess(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();
    setLoading(true);
    try {
      if (tab === 'login') {
        await signIn(email, password);
      } else if (tab === 'register') {
        if (password !== confirm) { setError('As senhas não coincidem.'); return; }
        if (password.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return; }
        await signUp(email, password, name);
      } else {
        await resetPassword(email);
        setSuccess('Link de recuperação enviado para o seu e-mail!');
      }
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
        'auth/invalid-credential': 'E-mail ou senha inválidos.',
        'auth/unauthorized-domain':
          'Domínio não autorizado: adicione o domínio do site em Authentication → Settings → Authorized domains no Firebase.',
        'auth/operation-not-allowed':
          'Login com Google não habilitado: ative o provedor Google em Authentication → Sign-in method.',
        'auth/popup-blocked':
          'O pop-up foi bloqueado pelo navegador. Permita pop-ups e tente de novo.',
        'auth/popup-closed-by-user': 'Login cancelado.',
        'auth/invalid-oauth-client-id':
          'Configuração OAuth do Google inválida no Firebase.',
        'auth/account-exists-with-different-credential':
          'Já existe uma conta com este e-mail usando outro método de login.',
      };
      setError(msg[err.code] || err?.message || 'Ocorreu um erro. Tente novamente.');
      console.error('Erro de autenticação:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    clearState();
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/unauthorized-domain':
          'Domínio não autorizado: adicione o domínio do site em Authentication → Settings → Authorized domains no Firebase.',
        'auth/operation-not-allowed':
          'Login com Google não habilitado: ative o provedor Google em Authentication → Sign-in method.',
        'auth/popup-blocked':
          'O pop-up foi bloqueado pelo navegador. Permita pop-ups e tente de novo.',
        'auth/popup-closed-by-user': 'Login cancelado.',
        'auth/invalid-oauth-client-id':
          'Configuração OAuth do Google inválida no Firebase.',
      };
      setError(msg[err.code] || 'Erro ao entrar com Google. Tente novamente.');
      console.error('Erro ao entrar com Google:', err);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animation-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-brand-600 rounded-2xl text-white mb-4 shadow-lg shadow-brand-900/50">
            <TVIcon />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Time to Watch</h1>
          <p className="text-gray-400 text-sm mt-1">Rastreie o que você assiste</p>
        </div>

        <div className="card p-8">
          {/* Tabs */}
          {tab !== 'forgot' && (
            <div className="flex bg-dark-800 rounded-xl p-1 mb-6">
              {(['login', 'register'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); clearState(); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === t
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'login' ? 'Entrar' : 'Cadastrar'}
                </button>
              ))}
            </div>
          )}

          {tab === 'forgot' && (
            <div className="mb-6">
              <button
                onClick={() => { setTab('login'); clearState(); }}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                ← Voltar ao login
              </button>
              <h2 className="text-xl font-bold text-white mt-3">Recuperar senha</h2>
              <p className="text-gray-400 text-sm mt-1">Enviaremos um link para o seu e-mail.</p>
            </div>
          )}

          {/* Error/Success */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 text-green-400 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  className="input-field"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="input-field"
              />
            </div>

            {tab !== 'forgot' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input-field"
                />
              </div>
            )}

            {tab === 'register' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Confirmar senha</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field"
                />
              </div>
            )}

            {tab === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setTab('forgot'); clearState(); }}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {tab === 'login' ? 'Entrando...' : tab === 'register' ? 'Cadastrando...' : 'Enviando...'}
                </span>
              ) : tab === 'login' ? 'Entrar' : tab === 'register' ? 'Criar conta' : 'Enviar link'}
            </button>
          </form>

          {tab !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <span className="flex-1 h-px bg-dark-400" />
                <span className="text-gray-500 text-xs">ou</span>
                <span className="flex-1 h-px bg-dark-400" />
              </div>

              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="btn-secondary w-full flex items-center justify-center gap-3"
              >
                {googleLoading ? (
                  <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continuar com Google
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
