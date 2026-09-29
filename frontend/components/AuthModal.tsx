'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [activeView, setActiveView] = useState<'community_users' | 'email_form' | 'admin_pin'>('community_users');
  const [adminPin, setAdminPin] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await signIn('google', { callbackUrl: window.location.href });
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo conectar con Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Ingresa un correo electrónico.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: email.trim(),
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password.trim() || 'perritos123',
      });

      if (res?.error) {
        setErrorMsg('Error al iniciar sesión: ' + res.error);
      } else {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }
    } catch (err: any) {
      setErrorMsg('Error al conectar: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Verificación estricta del código de Administrador (230408)
  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin.trim() !== '230408') {
      setErrorMsg('⚠️ Código incorrecto. Solo el administrador autorizado puede acceder con este rol.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: 'admin@slp.com',
        name: 'Administrador General',
        adminCode: '230408',
        password: 'perritos123',
      });

      if (!res?.error) {
        setAdminPin('');
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      } else {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Acceso con 1 solo clic a los usuarios comunitarios de prueba
  const handleQuickLogin = async (quickEmail: string, quickName: string, adminCode?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: quickEmail,
        name: quickName,
        password: 'perritos123',
        adminCode,
      });
      if (!res?.error) {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      } else {
        setErrorMsg('Error al entrar: ' + res.error);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Cuentas creadas en PostgreSQL listas para probar mensajería comunitaria
  const communityUsers = [
    {
      id: 'mariana',
      name: 'Mariana López',
      roleDescription: 'Rescatista Tangamanga',
      email: 'mariana.rescatista@slp.com',
      password: 'perritos123',
      phone: '4448123456',
      avatarIcon: '🦮',
      themeBadge: 'bg-paliacate/10 text-paliacate border-paliacate/30',
    },
    {
      id: 'carlos',
      name: 'Dr. Carlos Méndez',
      roleDescription: 'Veterinaria Lomas',
      email: 'carlos.vet@slp.com',
      password: 'perritos123',
      phone: '4445567890',
      avatarIcon: '🩺',
      themeBadge: 'bg-confianza/10 text-confianza border-confianza/30',
    },
    {
      id: 'ana',
      name: 'Ana Lucía Torres',
      roleDescription: 'Vecina Pozos / Hogar Temporal',
      email: 'ana.comunidad@slp.com',
      password: 'perritos123',
      phone: '4441122334',
      avatarIcon: '🏡',
      themeBadge: 'bg-esperanza/10 text-esperanza border-esperanza/30',
    },
    {
      id: 'admin',
      name: 'Administrador General',
      roleDescription: 'Gestión y Moderación General',
      email: 'admin@slp.com',
      password: 'perritos123',
      phone: '4443211123',
      avatarIcon: '👑',
      themeBadge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      adminCode: '230408',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-lg p-6 shadow-2xl relative border border-theme my-6 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition"
        >
          ×
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-paliacate/10 text-paliacate rounded-full flex items-center justify-center mx-auto text-3xl mb-2 shadow-inner">
            🐶
          </div>
          <h2 className="text-2xl font-bold text-theme-main">Comunidad Perritos SLP</h2>
          <p className="text-xs text-theme-muted mt-1">
            Inicia sesión para chatear entre usuarios, reportar perritos y recibir alertas de coincidencia.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs p-3 rounded-xl mb-4 text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Pestañas de Vista */}
        <div className="flex border-b border-theme mb-4 gap-2">
          <button
            onClick={() => setActiveView('community_users')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeView === 'community_users'
                ? 'border-paliacate text-paliacate'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <span>👥</span> Cuentas Comunitarias
          </button>
          <button
            onClick={() => setActiveView('email_form')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeView === 'email_form'
                ? 'border-paliacate text-paliacate'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <span>✉️</span> Iniciar / Registrar Cuenta
          </button>
          <button
            onClick={() => setActiveView('admin_pin')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeView === 'admin_pin'
                ? 'border-paliacate text-paliacate'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <span>👑</span> Admin PIN
          </button>
        </div>

        {/* VISTA 1: CUENTAS COMUNITARIAS CON 1 CLIC (Requeridas por el usuario) */}
        {activeView === 'community_users' && (
          <div className="flex flex-col gap-3">
            <div className="bg-theme-input p-3 rounded-2xl border border-theme text-xs text-theme-muted">
              💡 <strong>Cuentas listas para probar comunicación:</strong> Selecciona cualquiera para iniciar sesión al instante y enviar mensajes a otros perfiles.
            </div>

            <div className="grid grid-cols-1 gap-2.5 max-h-[46vh] overflow-y-auto pr-1">
              {communityUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-theme-input/70 hover:bg-theme-input p-3 rounded-2xl border border-theme transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-theme-surface border border-theme flex items-center justify-center text-xl shrink-0 shadow-xs">
                      {u.avatarIcon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-xs text-theme-main truncate">{u.name}</h4>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${u.themeBadge}`}>
                          {u.roleDescription}
                        </span>
                      </div>
                      <p className="text-[11px] text-theme-muted font-mono truncate">
                        {u.email}
                      </p>
                      <p className="text-[10px] text-theme-muted">
                        Pass: <code className="bg-theme-surface px-1 py-0.2 rounded font-bold text-paliacate">{u.password}</code> • Tel: {u.phone}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleQuickLogin(u.email, u.name, u.adminCode)}
                    className="shrink-0 bg-paliacate hover:opacity-90 active:scale-95 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-xs transition disabled:opacity-50"
                  >
                    {isLoading ? '...' : '⚡ Entrar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 2: FORMULARIO CORREO / GOOGLE */}
        {activeView === 'email_form' && (
          <div className="flex flex-col gap-3">
            <div className="bg-theme-input p-2.5 rounded-2xl border border-theme text-[11px] text-theme-muted flex items-center gap-2">
              <span className="text-base shrink-0">✨</span>
              <span><strong>¿Nueva cuenta?</strong> Escribe tu correo y nombre; se creará y guardará automáticamente en el sistema.</span>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-theme-surface border border-theme hover:opacity-90 text-theme-main font-bold py-3 px-4 rounded-2xl shadow-sm transition active:scale-[0.98] disabled:opacity-50 text-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              Continuar con Google
            </button>

            <div className="relative my-1 text-center">
              <hr className="border-theme" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-theme-surface px-3 text-[10px] text-theme-muted uppercase font-bold tracking-wider">
                o con correo electrónico
              </span>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-theme-muted mb-1">Nombre Completo (Opcional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Roberto Gómez"
                  className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-theme-muted mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu-correo@ejemplo.com"
                  className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-theme-muted mb-1">Teléfono Público (Opcional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. 4441234567"
                  className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-theme-muted mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña (ej. perritos123)"
                  className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-confianza hover:opacity-90 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 flex items-center justify-center gap-2"
              >
                <span>{isLoading ? '⏳' : '🚀'}</span>
                <span>{isLoading ? 'Conectando...' : 'Iniciar Sesión / Crear Cuenta'}</span>
              </button>
            </form>
          </div>
        )}

        {/* VISTA 3: ADMIN CON PIN 230408 */}
        {activeView === 'admin_pin' && (
          <form onSubmit={handleAdminVerify} className="bg-theme-input p-4 rounded-2xl border border-theme flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔐</span>
              <div>
                <h3 className="font-bold text-xs text-theme-main">Panel de Administrador Autorizado</h3>
                <p className="text-[10px] text-theme-muted">Ingresa el PIN de seguridad confidencial para acceder con rol ADMIN.</p>
              </div>
            </div>

            <input
              type="password"
              maxLength={6}
              autoFocus
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="Código PIN"
              className="w-full bg-theme-surface border border-theme rounded-xl p-3 text-center tracking-widest text-base font-mono font-bold outline-none focus:border-paliacate text-theme-main"
            />

            <button
              type="submit"
              disabled={isLoading || !adminPin.trim()}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition disabled:opacity-50"
            >
              {isLoading ? 'Verificando PIN...' : 'Desbloquear y Acceder como Admin'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
