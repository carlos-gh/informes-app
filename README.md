# Informes Mensuales

## Configuración de Google Sheets

1. Cree un Google Spreadsheet y copie su ID.
2. En Google Apps Script, cree un nuevo proyecto y agregue un Web App que reciba solicitudes `POST`.
3. En el script, configure el ID del Spreadsheet y escriba los datos recibidos en una nueva fila.
4. Publique el Web App con acceso "Cualquiera" y copie la URL de despliegue.
5. En este proyecto, cree un archivo `.env.local` y defina:
   - `VITE_GOOGLE_SCRIPT_URL`: URL del Web App de Google Apps Script.

## Despliegue en Vercel

1. Suba este repositorio a GitHub.
2. En Vercel, importe el repositorio.
3. En la configuración del proyecto, agregue la variable de entorno `VITE_GOOGLE_SCRIPT_URL`.
4. Ejecute el despliegue.
