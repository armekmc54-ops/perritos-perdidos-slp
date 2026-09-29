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
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Campos para Registro (Crear Cuenta)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);

  // Campos para Recuperar Contraseña
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Campos para Administrador
  const [adminEmail, setAdminEmail] = useState('armekmc54@gmail.com');
  const [adminPassword, setAdminPassword] = useState('TeAmoXimena230408@');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
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
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      if (res?.error) {
        if (res.error === 'CredentialsSignin') {
          setErrorMsg('Correo o contraseña incorrectos. Verifica tus datos o usa "¿Olvidaste tu contraseña?".');
        } else {
          setErrorMsg(res.error);
        }
      } else {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. CREAR CUENTA NUEVA CON VALIDACIÓN Y TÉRMINOS
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setTermsError(false);

    const emailTrimmed = regEmail.trim().toLowerCase();

    // Si el usuario ingresa el correo de administración
    if (emailTrimmed === 'armekmc54@gmail.com') {
      setErrorMsg('👑 Este correo ya pertenece a la cuenta de Administrador. Por favor ingresa en la pestaña "Administrador" de arriba.');
      return;
    }

    if (!regName.trim() || !emailTrimmed || !regPhone.trim() || !regPassword.trim() || !regConfirmPassword.trim()) {
      setErrorMsg('Por favor llena todos los campos obligatorios (*).');
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('El número de teléfono debe tener al menos 10 dígitos.');
      return;
    }

    if (regPassword.length < 4) {
      setErrorMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Puedes usar el icono del ojo 👁️ para comprobar lo que escribiste.');
      return;
    }

    if (!acceptedTerms) {
      setTermsError(true);
      setErrorMsg('⚠️ Debes marcar la casilla para aceptar los Términos, Condiciones y Deslinde Legal.');
      return;
    }

    setIsLoading(true);
    try {
      // Registrar en el backend
      await registerUser({
        name: regName.trim(),
        email: emailTrimmed,
        phone: regPhone.trim(),
        password: regPassword,
      });

      // Iniciar sesión automáticamente tras el registro exitoso
      const res = await signIn('credentials', {
        redirect: false,
        email: emailTrimmed,
        password: regPassword,
      });

      if (res?.error) {
        setErrorMsg('Cuenta creada correctamente. Por favor inicia sesión: ' + res.error);
        setUserView('login');
        setLoginEmail(emailTrimmed);
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

    const emailTrimmed = forgotEmail.trim().toLowerCase();

    if (!emailTrimmed || !forgotPhone.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setErrorMsg('Por favor llena todos los campos.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Las contraseñas no coinciden. Verifícalas usando el icono 👁️.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword({
        email: emailTrimmed,
        phone: forgotPhone.trim(),
        newPassword: newPassword,
      });

      setResetSuccessMsg(res.message || '¡Contraseña restablecida exitosamente!');
      setLoginEmail(emailTrimmed);
      setLoginPassword(newPassword);
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
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
      });

      if (res?.error) {
        if (res.error === 'CredentialsSignin') {
          setErrorMsg('Credenciales incorrectas de Administrador.');
        } else {
          setErrorMsg(res.error);
        }
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-theme-surface text-theme-main rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative border border-theme my-4 max-h-[94vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-theme-muted hover:text-theme-main font-bold text-2xl w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            ×
          </button>

          <div className="text-center mb-3">
            <div className="w-12 h-12 bg-paliacate/10 text-paliacate rounded-full flex items-center justify-center mx-auto text-2xl mb-1.5 shadow-inner">
              🐶
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-theme-main">Perritos o Animales Perdidos</h2>
            <p className="text-[11px] text-theme-muted mt-0.5">
              Plataforma comunitaria de reporte, búsqueda y protección animal en San Luis Potosí.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs p-3 rounded-xl mb-3 text-center font-medium animate-pulse">
              {errorMsg}
            </div>
          )}

          {resetSuccessMsg && (
            <div className="bg-esperanza/10 border border-esperanza/30 text-esperanza text-xs p-3 rounded-xl mb-3 text-center font-bold">
              {resetSuccessMsg}
            </div>
          )}

          {/* Pestañas Principales: Comunidad vs Administrador */}
          <div className="flex border-b border-theme mb-3 gap-2">
            <button
              onClick={() => {
                setActiveTab('user');
                setErrorMsg(null);
                setTermsError(false);
              }}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
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
                setTermsError(false);
              }}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
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
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="font-bold text-sm text-theme-main">Iniciar Sesión</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setUserView('register');
                        setErrorMsg(null);
                        setTermsError(false);
                      }}
                      className="text-xs text-paliacate font-bold hover:underline cursor-pointer"
                    >
                      ¿No tienes cuenta? Regístrate
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
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
                        className="text-[10px] text-confianza hover:underline font-semibold cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Tu contraseña"
                        className="w-full bg-theme-input border border-theme rounded-xl p-2.5 pr-10 text-xs outline-none focus:border-paliacate text-theme-main"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-main text-xs p-1 cursor-pointer"
                        title={showLoginPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      >
                        {showLoginPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-paliacate hover:opacity-90 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isLoading ? '⏳' : '🐾'}</span>
                    <span>{isLoading ? 'Comprobando datos...' : 'Ingresar a Mi Cuenta'}</span>
                  </button>

                  <div className="text-center pt-2 border-t border-theme/60 mt-0.5">
                    <p className="text-xs text-theme-muted">
                      ¿Eres nuevo en la plataforma?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setUserView('register');
                          setErrorMsg(null);
                          setTermsError(false);
                        }}
                        className="text-paliacate font-bold hover:underline cursor-pointer"
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
                        setTermsError(false);
                      }}
                      className="text-xs text-confianza font-bold hover:underline cursor-pointer"
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
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                    {/* Alerta inteligente si escribe el correo del administrador */}
                    {regEmail.toLowerCase().trim() === 'armekmc54@gmail.com' && (
                      <div className="mt-1.5 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex flex-col gap-1">
                        <div>👑 <strong>¡Hola Administrador!</strong> Este correo ya es la cuenta de Administración.</div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('admin');
                            setErrorMsg(null);
                          }}
                          className="text-left font-bold text-paliacate underline cursor-pointer"
                        >
                          👉 Haz clic aquí para entrar directamente en la pestaña Administrador
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">
                      Teléfono de Contacto * <span className="text-[10px] text-theme-muted font-normal">(10 dígitos)</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={15}
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="Ej. 4441234567"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-theme-muted mb-1">Contraseña *</label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Mínimo 4 caracteres"
                          className="w-full bg-theme-input border border-theme rounded-xl p-2.5 pr-8 text-xs outline-none focus:border-paliacate text-theme-main"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-main text-xs p-1 cursor-pointer"
                          title={showRegPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {showRegPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-theme-muted mb-1">Confirmar *</label>
                      <div className="relative">
                        <input
                          type={showRegConfirmPassword ? 'text' : 'password'}
                          required
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          placeholder="Repite la contraseña"
                          className="w-full bg-theme-input border border-theme rounded-xl p-2.5 pr-8 text-xs outline-none focus:border-paliacate text-theme-main"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-main text-xs p-1 cursor-pointer"
                          title={showRegConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {showRegConfirmPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Indicador en tiempo real de coincidencia de contraseñas */}
                  {regConfirmPassword.length > 0 && (
                    <div className="text-[11px] font-semibold -mt-1">
                      {regPassword === regConfirmPassword ? (
                        <span className="text-esperanza flex items-center gap-1">
                          ✓ Las contraseñas coinciden
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1">
                          ✗ Las contraseñas no coinciden aún
                        </span>
                      )}
                    </div>
                  )}

                  {/* CASILLA OBLIGATORIA DE TÉRMINOS Y CONDICIONES (TOTALMENTE TÁCTIL E INTERACTIVA) */}
                  <div
                    onClick={() => {
                      setAcceptedTerms(!acceptedTerms);
                      setTermsError(false);
                    }}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer select-none flex items-start gap-3 mt-1 ${
                      acceptedTerms
                        ? 'bg-esperanza/10 border-esperanza/70 shadow-xs'
                        : termsError
                          ? 'bg-red-500/10 border-red-500 ring-2 ring-red-500/30'
                          : 'bg-theme-input/80 border-theme hover:border-theme-muted'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-black transition-all shrink-0 mt-0.5 ${
                        acceptedTerms
                          ? 'bg-esperanza text-white shadow-sm scale-105'
                          : termsError
                            ? 'border-2 border-red-500 bg-white dark:bg-zinc-800'
                            : 'border-2 border-theme-muted/60 bg-theme-surface text-transparent'
                      }`}
                    >
                      {acceptedTerms ? '✓' : ''}
                    </div>
                    <div className="flex-1 text-[11px] leading-snug text-theme-main">
                      <span>He leído y acepto los </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsTermsModalOpen(true);
                        }}
                        className="text-paliacate font-bold underline hover:opacity-80 transition inline cursor-pointer"
                      >
                        Términos, Condiciones y Deslinde Legal
                      </button>{' '}
                      de la plataforma.
                      {termsError && (
                        <p className="text-red-500 font-bold mt-1 text-[10px]">
                          ⚠️ Toca aquí para marcar la casilla obligatoria.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-paliacate hover:opacity-90 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isLoading ? '⏳' : '✨'}</span>
                    <span>{isLoading ? 'Validando y creando...' : 'Crear Mi Cuenta'}</span>
                  </button>

                  <div className="text-center pt-2 border-t border-theme/60 mt-0.5">
                    <p className="text-xs text-theme-muted">
                      ¿Ya te habías registrado?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setUserView('login');
                          setErrorMsg(null);
                          setTermsError(false);
                        }}
                        className="text-confianza font-bold hover:underline cursor-pointer"
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
                      className="text-xs text-theme-muted hover:text-theme-main cursor-pointer"
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
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
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
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-theme-muted mb-1">Nueva Contraseña *</label>
                      <div className="relative">
                        <input
                          type={showForgotNewPassword ? 'text' : 'password'}
                          required
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Nueva contraseña"
                          className="w-full bg-theme-input border border-theme rounded-xl p-2.5 pr-8 text-xs outline-none focus:border-paliacate text-theme-main"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-main text-xs p-1 cursor-pointer"
                          title={showForgotNewPassword ? 'Ocultar' : 'Ver'}
                        >
                          {showForgotNewPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-theme-muted mb-1">Confirmar Nueva *</label>
                      <div className="relative">
                        <input
                          type={showForgotConfirmPassword ? 'text' : 'password'}
                          required
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Repite la nueva"
                          className="w-full bg-theme-input border border-theme rounded-xl p-2.5 pr-8 text-xs outline-none focus:border-paliacate text-theme-main"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-main text-xs p-1 cursor-pointer"
                          title={showForgotConfirmPassword ? 'Ocultar' : 'Ver'}
                        >
                          {showForgotConfirmPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
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

                  <div className="text-center pt-2 border-t border-theme/60 mt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserView('login');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-theme-muted hover:text-theme-main font-semibold cursor-pointer"
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
                  className={`py-2 px-3 rounded-xl border transition cursor-pointer ${
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
                  className={`py-2 px-3 rounded-xl border transition cursor-pointer ${
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
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="armekmc54@gmail.com"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Contraseña Maestra</label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Contraseña de Administrador"
                        className="w-full bg-theme-input border border-theme rounded-xl p-2.5 pr-8 text-xs outline-none focus:border-paliacate text-theme-main font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-main text-xs p-1 cursor-pointer"
                        title={showAdminPassword ? 'Ocultar' : 'Ver'}
                      >
                        {showAdminPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
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
