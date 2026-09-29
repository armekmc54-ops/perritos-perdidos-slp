'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { registerUser, resetPassword, requestResetCode } from '../services/api';
import TermsModal from './TermsModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  // Pestaña principal: 'user' (Comunidad) o 'admin' (Administración discreta)
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
  const [resetCode, setResetCode] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetCodeNotice, setResetCodeNotice] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Campos para Administrador (Completamente vacíos por seguridad)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminAuthType, setAdminAuthType] = useState<'credentials' | 'pin'>('credentials');

  // Modales y Estados de Control
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. INICIAR SESIÓN DE USUARIO (O ADMINISTRADOR)
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
        setErrorMsg('Cuenta creada correctamente. Por favor inicia sesión con tu correo y contraseña.');
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

  // 3. RECUPERAR / RESTABLECER CONTRASEÑA EN 2 PASOS CON VERIFICACIÓN OTP
  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSuccessMsg(null);

    const emailTrimmed = forgotEmail.trim().toLowerCase();
    const phoneTrimmed = forgotPhone.trim();

    if (emailTrimmed === 'armekmc54@gmail.com') {
      setErrorMsg('🔒 Por seguridad institucional, la cuenta de Administrador Maestro está blindada contra modificaciones.');
      return;
    }

    if (!emailTrimmed || !phoneTrimmed) {
      setErrorMsg('Por favor ingresa tu correo y tu teléfono registrado para verificar tu identidad.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestResetCode({
        email: emailTrimmed,
        phone: phoneTrimmed,
      });

      setResetStep('verify');
      if (res.code) {
        setResetCode(res.code);
        setResetCodeNotice(`🔐 Código de seguridad de un solo uso generado: ${res.code}`);
      } else {
        setResetCodeNotice('Revisa tu correo electrónico para obtener tu código de 6 dígitos.');
      }
      setResetSuccessMsg('¡Identidad validada! Ingresa el código de 6 dígitos para crear tu nueva contraseña.');
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo generar el código de verificación.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSuccessMsg(null);

    const emailTrimmed = forgotEmail.trim().toLowerCase();
    const phoneTrimmed = forgotPhone.trim();
    const codeTrimmed = resetCode.trim();

    if (emailTrimmed === 'armekmc54@gmail.com') {
      setErrorMsg('🔒 Por seguridad institucional, la cuenta de Administrador Maestro está protegida contra modificaciones externas.');
      return;
    }

    if (!codeTrimmed || codeTrimmed.length !== 6) {
      setErrorMsg('Por favor ingresa el código de verificación de 6 dígitos.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
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
        phone: phoneTrimmed,
        code: codeTrimmed,
        newPassword: newPassword,
      });

      setResetSuccessMsg(res.message || '¡Contraseña restablecida exitosamente!');
      setLoginEmail(emailTrimmed);
      setLoginPassword(newPassword);
      setTimeout(() => {
        setUserView('login');
        setResetStep('request');
        setResetSuccessMsg(null);
        setResetCodeNotice(null);
        setResetCode('');
        setNewPassword('');
        setConfirmNewPassword('');
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. ACCESO DE ADMINISTRADOR (Campos seguros y vacíos)
  const handleAdminCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      setErrorMsg('Ingresa tu correo y contraseña de administración.');
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
      setErrorMsg('Error al acceder: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPin.trim()) {
      setErrorMsg('Ingresa tu PIN confidencial de administrador.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: 'armekmc54@gmail.com',
        adminCode: adminPin.trim(),
      });

      if (res?.error) {
        if (res.error === 'CredentialsSignin') {
          setErrorMsg('Código PIN de Administrador incorrecto.');
        } else {
          setErrorMsg(res.error);
        }
      } else {
        setAdminPin('');
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al validar PIN.');
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

          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-paliacate/10 text-paliacate rounded-full flex items-center justify-center mx-auto text-2xl mb-1.5 shadow-inner">
              🐶
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-theme-main">Perritos o Animales Perdidos</h2>
            <p className="text-[11px] text-theme-muted mt-0.5">
              Plataforma comunitaria de reporte, búsqueda y protección animal en San Luis Potosí.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs p-3 rounded-xl mb-3 text-center font-medium">
              {errorMsg}
            </div>
          )}

          {resetSuccessMsg && (
            <div className="bg-esperanza/10 border border-esperanza/30 text-esperanza text-xs p-3 rounded-xl mb-3 text-center font-bold">
              {resetSuccessMsg}
            </div>
          )}

          {/* ===================== VISTA 1: COMUNIDAD (POR DEFECTO PARA TODOS) ===================== */}
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
                    <span>{isLoading ? 'Iniciando sesión...' : 'Ingresar a Mi Cuenta'}</span>
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

              {/* SUB-VISTA C: RECUPERAR CONTRASEÑA EN 2 PASOS */}
              {userView === 'forgot' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="font-bold text-sm text-theme-main">
                      {resetStep === 'request' ? 'Recuperar Contraseña (Paso 1/2)' : 'Validar Identidad (Paso 2/2)'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setUserView('login');
                        setResetStep('request');
                        setErrorMsg(null);
                        setResetCodeNotice(null);
                      }}
                      className="text-xs text-theme-muted hover:text-theme-main cursor-pointer"
                    >
                      ← Cancelar
                    </button>
                  </div>

                  {resetStep === 'request' ? (
                    <form onSubmit={handleRequestResetCode} className="flex flex-col gap-2.5">
                      <p className="text-[11px] text-theme-muted">
                        Ingresa el correo y teléfono registrados en tu cuenta para enviarte un código de seguridad de 6 dígitos.
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
                          placeholder="El teléfono registrado en tu cuenta"
                          className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main font-mono"
                        />
                      </div>

                      {forgotEmail.trim().toLowerCase() === 'armekmc54@gmail.com' && (
                        <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-500 font-semibold flex items-center gap-1.5">
                          <span>🛡️</span> La cuenta de Administrador Maestro está blindada contra modificaciones externas.
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading || forgotEmail.trim().toLowerCase() === 'armekmc54@gmail.com'}
                        className="w-full bg-paliacate hover:opacity-90 active:scale-95 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{isLoading ? '⏳' : '📨'}</span>
                        <span>{isLoading ? 'Generando código...' : 'Solicitar Código de 6 Dígitos'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleResetSubmit} className="flex flex-col gap-2.5">
                      {resetCodeNotice && (
                        <div className="p-2.5 bg-esperanza/15 border border-esperanza/40 rounded-xl text-xs text-esperanza font-bold flex items-center gap-2">
                          <span>🔐</span>
                          <span>{resetCodeNotice}</span>
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-bold text-theme-muted">Código de Seguridad (6 dígitos) *</label>
                          <span className="text-[10px] text-theme-muted font-mono">{forgotEmail}</span>
                        </div>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          className="w-full bg-theme-input border-2 border-esperanza/60 rounded-xl p-2.5 text-center text-lg font-mono font-black tracking-widest outline-none focus:border-esperanza text-theme-main"
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
                              placeholder="Mín. 4 caracteres"
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
                              placeholder="Repite la contraseña"
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
                        <span>{isLoading ? 'Validando y actualizando...' : 'Actualizar Contraseña'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResetStep('request');
                          setErrorMsg(null);
                        }}
                        className="text-xs text-center text-theme-muted hover:text-theme-main underline mt-1 cursor-pointer"
                      >
                        ← Cambiar datos o pedir nuevo código
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* ENLACE DISCRETO DE ADMINISTRACIÓN (NO VISIBLE COMO PESTAÑA PRINCIPAL) */}
              <div className="text-center pt-3 mt-3 border-t border-theme/40">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('admin');
                    setErrorMsg(null);
                    setAdminEmail('');
                    setAdminPassword('');
                    setAdminPin('');
                  }}
                  className="text-[10px] text-theme-muted/40 hover:text-theme-muted transition cursor-pointer"
                >
                  Acceso de moderación y administración
                </button>
              </div>
            </div>
          )}

          {/* ===================== VISTA 2: PANEL DISCRETO DE ADMINISTRADOR ===================== */}
          {activeTab === 'admin' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-theme">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👑</span>
                  <div>
                    <h4 className="font-bold text-xs text-theme-main">Acceso Administrativo</h4>
                    <p className="text-[10px] text-theme-muted">Panel restringido para moderadores y administradores.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('user');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-theme-muted hover:text-theme-main font-semibold cursor-pointer"
                >
                  ← Volver
                </button>
              </div>

              {/* Selector de método Admin: Credenciales vs PIN */}
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAdminAuthType('credentials');
                    setErrorMsg(null);
                  }}
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
                  onClick={() => {
                    setAdminAuthType('pin');
                    setErrorMsg(null);
                  }}
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
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Correo de Administrador</label>
                    <input
                      type="email"
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@ejemplo.com"
                      className="w-full bg-theme-input border border-theme rounded-xl p-2.5 text-xs outline-none focus:border-paliacate text-theme-main"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-theme-muted mb-1">Contraseña</label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full bg-theme-input border border-theme rounded-xl p-2.5 pr-8 text-xs outline-none focus:border-paliacate text-theme-main"
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
                    <span>{isLoading ? 'Verificando...' : 'Entrar como Administrador'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminPinSubmit} className="flex flex-col gap-3 mt-1">
                  <label className="block text-[11px] font-bold text-theme-muted">Ingresa el PIN confidencial:</label>
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
