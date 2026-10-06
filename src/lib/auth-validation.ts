// Mensajes propios para los formularios de cuenta: las burbujas nativas salen en inglés.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

export function emailProblem(email: string): string | null {
  const clean = email.trim();
  if (!clean) return 'Escribe tu correo';
  return EMAIL.test(clean) ? null : 'Ese correo no parece válido';
}

export function passwordProblem(password: string): string | null {
  return password.length >= MIN_PASSWORD ? null : `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
}
