'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import TermsModal from './TermsModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [activeView, setActiveView] = useState<'user_auth' | 'admin_auth'>('user_auth');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  // Estados para Acceso de Administrador
  const [adminEmail, setAdminEmail] = useState('armekmc54@gmail.com');
  const [adminPassword, setAdminPassword] = useState('TeAmoXimena230408@');
  const [adminPin, setAdminPin] = useState('');
  const [adminAuthType, setAdminAuthType] = useState<'credentials' | 'pin'>('credentials');

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

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Ingresa un correo electrónico.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMsg('⚠️ Debes aceptar los Términos, Condiciones y Deslinde Legal para crear tu cuenta o iniciar sesión.');
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

  const handleAdminCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim()) {
      setErrorMsg('Ingresa el correo de administración.');
      return;
    }

    if (adminPassword !== 'TeAmoXimena230408@') {
      setErrorMsg('⚠️ Contraseña de Administrador incorrecta.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: adminEmail.trim(),
        name: 'Armando (Administrador M&A)',
        phone: '4443211123',
        password: adminPassword,
        adminCode: '230408',
      });

      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }
    } catch (err: any) {
      setErrorMsg('Error al acceder como Admin: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin.trim() !== '230408') {
      setErrorMsg('⚠️ Código PIN incorrecto. Acceso reservado para el administrador autorizado.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: 'armekmc54@gmail.com',
        name: 'Armando (Administrador M&A)',
        phone: '4443211123',
        adminCode: '230408',
        password: 'TeAmoXimena230408@',
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

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-theme my-6 max-h-[92vh] overflow-y-auto">
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
            <h2 className="text-xl md:text-2xl font-bold text-theme-main">Perritos o Animales Perdidos</h2>
            <p className="text-xs text-theme-muted mt-1">
              Inicia sesión o crea tu cuenta para reportar animales, enviar mensajes comunitarios y recibir alertas de avistamiento en SLP.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs p-3 rounded-xl mb-4 text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* Pestañas de Navegación: Usuario Comunitario vs Administrador */}
          <div className="flex border-b border-theme mb-4 gap-2">
            <button
              onClick={() => {
                setActiveView('user_auth');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeView === 'user_auth'
                  ? 'border-paliacate text-paliacate'
                  : 'border-transparent text-theme-muted hover:text-theme-main'
              }`}
            >
              <span>👤</span> Iniciar / Crear Cuenta
            </button>
            <button
              onClick={() => {
                setActiveView('admin_auth');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeView === 'admin_auth'
                  ? 'border-paliacate text-paliacate'
                  : 'border-transparent text-theme-muted hover:text-theme-main'
              }`}
            >
              <span>👑</span> Administrador
            </button>
          </div>

          {/* VISTA 1: USUARIO COMUNITARIO (CON CASILLA OBLIGATORIA DE TÉRMINOS) */}
          {activeView === 'user_auth' && (
            <div className="flex flex-col gap-3">
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
                  o con tu correo
                </span>
              </div>

              <form onSubmit={handleUserSubmit} className="flex flex-col gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-theme-muted mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
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
                  <label className="block text-[11px] font-bold text-theme-muted mb-1">Teléfono Público (Para contacto de rescates)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 4441234567"
                    className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-theme-muted mb-1">Contraseña *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Crea o escribe tu contraseña"
                    className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                  />
                </div>

                {/* CASILLA OBLIGATORIA DE TÉRMINOS Y CONDICIONES */}
                <div className="bg-theme-input/60 p-3 rounded-xl border border-theme flex items-start gap-2.5 mt-1">
                  <input
                    type="checkbox"
                    id="terms-checkbox"
                    required
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-theme text-paliacate focus:ring-paliacate cursor-pointer shrink-0"
                  />
                  <label htmlFor="terms-checkbox" className="text-[11px] text-theme-muted leading-tight cursor-pointer">
                    He leído y acepto los{' '}
                    <button
                      type="button"
                      onClick={() => setIsTermsModalOpen(true)}
                      className="text-paliacate font-bold hover:underline inline"
                    >
                      Términos, Condiciones y Deslinde Legal
                    </button>{' '}
                    de la plataforma.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-paliacate hover:opacity-90 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isLoading ? '⏳' : '🐾'}</span>
                  <span>{isLoading ? 'Conectando...' : 'Iniciar Sesión / Crear Mi Cuenta'}</span>
                </button>
              </form>
            </div>
          )}

          {/* VISTA 2: ACCESO DE ADMINISTRADOR */}
          {activeView === 'admin_auth' && (
            <div className="flex flex-col gap-3">
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-center gap-2.5">
                <span className="text-2xl shrink-0">👑</span>
                <div>
                  <h4 className="font-bold text-xs text-amber-700 dark:text-amber-400">Acceso Maestro de Administración</h4>
                  <p className="text-[10px] text-theme-muted">
                    Panel exclusivo para gestión, moderación y control de la plataforma.
                  </p>
                </div>
              </div>

              {/* Selector de método Admin: Credenciales vs PIN */}
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAdminAuthType('credentials')}
                  className={`py-2 px-3 rounded-xl border transition ${
                    adminAuthType === 'credentials'
                      ? 'bg-paliacate text-white border-paliacate'
                      : 'bg-theme-input text-theme-muted border-theme'
                  }`}
                >
                  ✉️ Correo y Clave
                </button>
                <button
                  type="button"
                  onClick={() => setAdminAuthType('pin')}
                  className={`py-2 px-3 rounded-xl border transition ${
                    adminAuthType === 'pin'
                      ? 'bg-paliacate text-white border-paliacate'
                      : 'bg-theme-input text-theme-muted border-theme'
                  }`}
                >
                  🔐 Código PIN
                </button>
              </div>

              {adminAuthType === 'credentials' ? (
                <form onSubmit={handleAdminCredentialsSubmit} className="flex flex-col gap-2.5 mt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Correo Administrador</label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="armekmc54@gmail.com"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Contraseña Maestra</label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Contraseña de Administrador"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isLoading ? '⏳' : '👑'}</span>
                    <span>{isLoading ? 'Verificando credenciales...' : 'Entrar como Administrador'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminPinSubmit} className="flex flex-col gap-3 mt-1">
                  <label className="block text-[11px] font-bold text-theme-muted">Ingresa el PIN de seguridad confidencial:</label>
                  <input
                    type="password"
                    maxLength={6}
                    autoFocus
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="PIN confidencial"
                    className="w-full bg-theme-input border border-theme rounded-xl p-3 text-center tracking-widest text-base font-mono font-bold outline-none focus:border-paliacate text-theme-main"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !adminPin.trim()}
                    className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? 'Comprobando PIN...' : 'Desbloquear y Acceder'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE TÉRMINOS Y CONDICIONES (Para lectura directa sin salir del login) */}
      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />
    </>
  );
}
