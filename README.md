# Informes Mensuales

## Base de datos en Vercel (Neon)

1. En Vercel, cree un proyecto y agregue una base de datos Postgres (Neon).
2. Vincule la base de datos al proyecto.
3. Vercel inyectará las variables de conexión necesarias (como `POSTGRES_URL`).
4. La primera vez que se use el API, la tabla `reports` se crea automáticamente.

## Variables de entorno

Defina estas variables en Vercel y en `.env.local` para desarrollo local:

- `ADMIN_USERNAME`: usuario administrador.
- `ADMIN_PASSWORD`: contraseña del administrador.
- `ADMIN_TOKEN_SECRET`: cadena secreta para firmar los tokens (larga y aleatoria).
- `TURNSTILE_SECRET_KEY`: clave secreta de Cloudflare Turnstile.
- `VITE_TURNSTILE_SITE_KEY`: clave pública de Cloudflare Turnstile.

Si desarrolla localmente, agregue también la cadena de conexión de Postgres en:

- `POSTGRES_URL`: URL de conexión de la base de datos.

## Flujo de trabajo

- Ruta pública: `/` (formulario de informes).
- Ruta de acceso: `/login`.
- Panel de administración: `/admin`.

## Captcha en login (Cloudflare Turnstile)

1. Cree un sitio en Cloudflare Turnstile.
2. Copie la clave pública (site key) y la clave secreta (secret key).
3. Configure las variables:
   - `VITE_TURNSTILE_SITE_KEY` (frontend).
   - `TURNSTILE_SECRET_KEY` (backend).

## Despliegue en Vercel

1. Suba este repositorio a GitHub.
2. En Vercel, importe el repositorio.
3. Configure las variables de entorno indicadas arriba.
4. Ejecute el despliegue.

## Desarrollo local

1. Instale dependencias: `npm install`.
2. Inicie el frontend: `npm run dev`.
3. Para probar el backend localmente, use `vercel dev` con las variables de entorno configuradas.
