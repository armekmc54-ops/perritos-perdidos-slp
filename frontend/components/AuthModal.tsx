'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { registerUser, resetPassword } from '../services/api';
import TermsModal from './TermsModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  // Pestaña principal: 'user' (Comunidad) o 'admin' (Administración)
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  // Sub-vistas dentro de Usuario: 'login' | 'register' | 'forgot'
  const [userView, setUserView] = useState<'login' | 'register' | 'forgot'>('login');

  // Campos para Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Campos para Registro (Crear Cuenta)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Campos para Recuperar Contraseña
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Campos para Administrador
  const [adminEmail, setAdminEmail] = useState('armekmc54@gmail.com');
  const [adminPassword, setAdminPassword] = useState('TeAmoXimena230408@');
  const [adminPin, setAdminPin] = useState('');
  const [adminAuthType, setAdminAuthType] = useState<'credentials' | 'pin'>('credentials');

  // Modales y Estados de Control
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. INICIAR SESIÓN DE USUARIO
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMsg('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: loginEmail.trim(),
        password: loginPassword.trim(),
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
      setErrorMsg(err.message || 'Error al conectar.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. CREAR CUENTA NUEVA CON VALIDACIÓN Y TÉRMINOS
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword.trim()) {
      setErrorMsg('Por favor llena todos los campos obligatorios (*).');
      return;
    }

    if (regPhone.replace(/\D/g, '').length < 10) {
      setErrorMsg('El número de teléfono debe tener al menos 10 dígitos.');
      return;
    }

    if (regPassword.length < 4) {
      setErrorMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMsg('⚠️ Debes aceptar los Términos, Condiciones y Deslinde Legal para crear tu cuenta.');
      return;
    }

    setIsLoading(true);
    try {
      // Registrar en el backend (valida correo único y teléfono único)
      await registerUser({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        password: regPassword.trim(),
      });

      // Iniciar sesión automáticamente tras el registro exitoso
      const res = await signIn('credentials', {
        redirect: false,
        email: regEmail.trim(),
        password: regPassword.trim(),
      });

      if (res?.error) {
        setErrorMsg('Cuenta creada, pero ocurrió un problema al iniciar sesión: ' + res.error);
      } else {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar tu cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. RECUPERAR / RESTABLECER CONTRASEÑA
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSuccessMsg(null);

    if (!forgotEmail.trim() || !forgotPhone.trim() || !newPassword.trim()) {
      setErrorMsg('Por favor llena todos los campos.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Las nuevas contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword({
        email: forgotEmail.trim(),
        phone: forgotPhone.trim(),
        newPassword: newPassword.trim(),
      });

      setResetSuccessMsg(res.message || '¡Contraseña restablecida exitosamente!');
      setLoginEmail(forgotEmail.trim());
      setLoginPassword(newPassword.trim());
      setTimeout(() => {
        setUserView('login');
        setResetSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. ACCESO DE ADMINISTRADOR (Credenciales o PIN)
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
        password: adminPassword,
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

          <div className="text-center mb-4">
            <div className="w-14 h-14 bg-paliacate/10 text-paliacate rounded-full flex items-center justify-center mx-auto text-3xl mb-2 shadow-inner">
              🐶
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-theme-main">Perritos o Animales Perdidos</h2>
            <p className="text-xs text-theme-muted mt-1">
              Plataforma comunitaria de reporte, búsqueda y protección animal en San Luis Potosí.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs p-3 rounded-xl mb-4 text-center font-medium">
              {errorMsg}
            </div>
          )}

          {resetSuccessMsg && (
            <div className="bg-esperanza/10 border border-esperanza/30 text-esperanza text-xs p-3 rounded-xl mb-4 text-center font-bold">
              {resetSuccessMsg}
            </div>
          )}

          {/* Pestañas Principales: Comunidad vs Administrador */}
          <div className="flex border-b border-theme mb-4 gap-2">
            <button
              onClick={() => {
                setActiveTab('user');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeTab === 'user'
                  ? 'border-paliacate text-paliacate'
                  : 'border-transparent text-theme-muted hover:text-theme-main'
              }`}
            >
              <span>👥</span> Comunidad
            </button>
            <button
              onClick={() => {
                setActiveTab('admin');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'border-paliacate text-paliacate'
                  : 'border-transparent text-theme-muted hover:text-theme-main'
              }`}
            >
              <span>👑</span> Administrador
            </button>
          </div>

          {/* ===================== TAB 1: COMUNIDAD ===================== */}
          {activeTab === 'user' && (
            <div>
              {/* SUB-VISTA A: INICIAR SESIÓN */}
              {userView === 'login' && (
                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-sm text-theme-main">Iniciar Sesión</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setUserView('register');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-paliacate font-bold hover:underline"
                    >
                      ¿No tienes cuenta? Regístrate
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="tu-correo@ejemplo.com"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-theme-muted">Contraseña</label>
                      <button
                        type="button"
                        onClick={() => {
                          setUserView('forgot');
                          setErrorMsg(null);
                        }}
                        className="text-[10px] text-confianza hover:underline font-semibold"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Tu contraseña"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-paliacate hover:opacity-90 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isLoading ? '⏳' : '🐾'}</span>
                    <span>{isLoading ? 'Comprobando datos...' : 'Ingresar a Mi Cuenta'}</span>
                  </button>

                  <div className="text-center pt-2 border-t border-theme/60 mt-1">
                    <p className="text-xs text-theme-muted">
                      ¿Eres nuevo en la plataforma?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setUserView('register');
                          setErrorMsg(null);
                        }}
                        className="text-paliacate font-bold hover:underline"
                      >
                        Crea tu cuenta aquí
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* SUB-VISTA B: CREAR CUENTA NUEVA (REGISTRO) */}
              {userView === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-2.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="font-bold text-sm text-theme-main">Crear Cuenta Comunitaria</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setUserView('login');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-confianza font-bold hover:underline"
                    >
                      ¿Ya tienes cuenta? Entra
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Ej. María Fernanda Gómez"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Correo Electrónico *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">
                      Teléfono de Contacto * <span className="text-[10px] text-theme-muted font-normal">(10 dígitos)</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="Ej. 4441234567"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-theme-muted mb-1">Contraseña *</label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-theme-muted mb-1">Confirmar Contraseña *</label>
                      <input
                        type="password"
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Repite la contraseña"
                        className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                      />
                    </div>
                  </div>

                  {/* CASILLA OBLIGATORIA DE TÉRMINOS Y CONDICIONES */}
                  <div className="bg-theme-input/70 p-3 rounded-xl border border-theme flex items-start gap-2.5 mt-1">
                    <input
                      type="checkbox"
                      id="terms-checkbox-reg"
                      required
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-theme text-paliacate focus:ring-paliacate cursor-pointer shrink-0"
                    />
                    <label htmlFor="terms-checkbox-reg" className="text-[11px] text-theme-muted leading-tight cursor-pointer">
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
                    <span>{isLoading ? '⏳' : '✨'}</span>
                    <span>{isLoading ? 'Validando y creando...' : 'Crear Mi Cuenta'}</span>
                  </button>

                  <div className="text-center pt-2 border-t border-theme/60 mt-1">
                    <p className="text-xs text-theme-muted">
                      ¿Ya te habías registrado?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setUserView('login');
                          setErrorMsg(null);
                        }}
                        className="text-confianza font-bold hover:underline"
                      >
                        Inicia sesión aquí
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* SUB-VISTA C: RECUPERAR CONTRASEÑA */}
              {userView === 'forgot' && (
                <form onSubmit={handleForgotSubmit} className="flex flex-col gap-2.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="font-bold text-sm text-theme-main">Recuperar Contraseña</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setUserView('login');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-theme-muted hover:text-theme-main"
                    >
                      ← Volver
                    </button>
                  </div>

                  <p className="text-[11px] text-theme-muted">
                    Ingresa tu correo y el teléfono registrado en tu cuenta para validar tu identidad y crear tu nueva contraseña.
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Correo Registrado *</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="tu-correo@ejemplo.com"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Teléfono Registrado *</label>
                    <input
                      type="tel"
                      required
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="El teléfono asociado a tu cuenta"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-theme-muted mb-1">Nueva Contraseña *</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nueva contraseña"
                        className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-theme-muted mb-1">Confirmar Nueva *</label>
                      <input
                        type="password"
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repite la nueva"
                        className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-esperanza hover:opacity-90 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isLoading ? '⏳' : '🔑'}</span>
                    <span>{isLoading ? 'Verificando datos...' : 'Restablecer Mi Contraseña'}</span>
                  </button>

                  <div className="text-center pt-2 border-t border-theme/60 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserView('login');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-theme-muted hover:text-theme-main font-semibold"
                    >
                      ← Regresar al Inicio de Sesión
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ===================== TAB 2: ADMINISTRADOR ===================== */}
          {activeTab === 'admin' && (
            <div className="flex flex-col gap-3">
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-center gap-2.5">
                <span className="text-2xl shrink-0">👑</span>
                <div>
                  <h4 className="font-bold text-xs text-amber-700 dark:text-amber-400">Acceso Maestro de Administración</h4>
                  <p className="text-[10px] text-theme-muted">
                    Panel exclusivo para gestión, moderación y control total de la plataforma.
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

      {/* MODAL DE TÉRMINOS Y CONDICIONES (Para lectura directa sin salir del formulario) */}
      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />
    </>
  );
}
