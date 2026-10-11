# I.E.A.R — Sistema de Gestión de Aulas (con servidor propio)

> **Actualizado:** este proyecto ya incluye todas las funciones agregadas en la versión de un solo archivo: foto por aula, ocupación actual vs. capacidad, jornada (Mañana/Tarde/Completa), favoritos por usuario, recuperar contraseña con pregunta de seguridad, notificaciones, modo oscuro, reportes por franja horaria y jornada, exportar a PDF y enviar reporte por correo (abre tu cliente de correo).


Backend en **Node.js + Express**, con la información guardada en un archivo `data/db.json`
en el servidor (no en el navegador), para que **todos los usuarios vean la misma información**
sin importar desde qué computador o celular entren.

## ¿Qué cambió respecto a la versión anterior?

- Antes: los datos vivían en `localStorage` de cada navegador (cada persona veía su propia copia).
- Ahora: los datos viven en el **servidor** (`data/db.json`), y el navegador solo guarda un
  **token de sesión** (JWT) después de iniciar sesión. Todas las operaciones (crear aula, reservar,
  cambiar estado, etc.) pasan por una API REST protegida.
- Las contraseñas se guardan **cifradas** (bcrypt), no en texto plano.
- El rol (`coordinador` / `estudiante`) lo valida el servidor en cada petición, no solo el navegador.

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior instalado en tu computador o en el servidor donde lo vayas a alojar.

## 1. Instalación local (para probarlo en tu computador)

```bash
cd iear-server
npm install
npm start
```

Abre `http://localhost:3000` en el navegador. Ya puedes entrar con las cuentas de demostración:

- 🗂️ Coordinador — usuario: `coordinador` · contraseña: `coord123`
- 🎒 Estudiante — usuario: `estudiante` · contraseña: `est123`

Los datos se guardan automáticamente en `data/db.json` cada vez que algo cambia.

## 2. Variables de entorno (opcional pero recomendado)

Copia `.env.example` a `.env` y cambia el valor de `JWT_SECRET` por una clave propia y larga
(es la clave que firma las sesiones; si la dejas por defecto, cualquiera que la vea en este
código podría falsificar sesiones). Luego, antes de `npm start`, exporta las variables:

```bash
export PORT=3000
export JWT_SECRET="una-clave-larga-y-aleatoria"
npm start
```

(En Windows PowerShell: `$env:JWT_SECRET="..."`).

## 3. Cómo ponerlo en línea para que todos entren desde un link

Tienes varias opciones, de más sencilla a más avanzada:

### Opción A — Render / Railway (gratis para empezar, recomendado)
1. Sube esta carpeta a un repositorio de GitHub.
2. Crea una cuenta en [Render](https://render.com) o [Railway](https://railway.app).
3. Crea un nuevo "Web Service" apuntando a tu repositorio.
4. Comando de build: `npm install`. Comando de inicio: `npm start`.
5. Agrega la variable de entorno `JWT_SECRET` en el panel de la plataforma.
6. Al desplegar, te dan una URL pública (ej. `https://iear.onrender.com`) — esa es la que compartes.

### Opción B — Tu propio VPS (DigitalOcean, Hostinger VPS, etc.)
1. Instala Node.js en el servidor.
2. Sube la carpeta del proyecto (por ejemplo con `scp` o `git clone`).
3. `npm install` y luego usa [PM2](https://pm2.keymetrics.io/) para mantenerlo corriendo:
   ```bash
   npm install -g pm2
   pm2 start server.js --name iear
   pm2 save
   pm2 startup
   ```
4. Configura un dominio y, si quieres HTTPS, pon Nginx + Certbot delante del servidor Node.

### Opción C — Un hosting compartido con soporte Node.js
Algunos hostings (cPanel con "Setup Node.js App", por ejemplo) permiten subir el proyecto,
indicar `server.js` como archivo de inicio e instalar dependencias desde el panel.

## 4. Respaldo de datos

Todo vive en `data/db.json`. Haz copias periódicas de ese archivo (o automatízalo con un
cron job) para no perder información. Si más adelante quieres una base de datos "de verdad"
(PostgreSQL, MySQL, MongoDB), la estructura del proyecto ya está organizada por capas
(`db.js` concentra toda la lectura/escritura de datos) para que sea sencillo reemplazarla.

## 5. Activar el envío real de correos (botón "Enviar por correo")

Por defecto, si no configuras esto, el botón mostrará un error pidiendo configuración. Para activarlo:

1. **Activa la verificación en dos pasos** en la cuenta de Gmail que quieras usar como remitente: ve a [myaccount.google.com/security](https://myaccount.google.com/security) → "Verificación en dos pasos" → actívala si no lo está.
2. Con eso activado, entra a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), ponle un nombre (ej. "IEAR") y genera una **contraseña de aplicación** — son 16 caracteres, sin espacios al copiarla.
3. Agrega estas dos variables de entorno donde tengas desplegado el servidor:
   - `GMAIL_USER` → tu correo completo de Gmail (ej. `reportes.iear@gmail.com`)
   - `GMAIL_APP_PASSWORD` → la contraseña de 16 caracteres que generaste (no tu contraseña normal de Gmail)
4. En **Render**: ve a tu servicio → "Environment" → "Add Environment Variable", agrega las dos, y guarda (Render reinicia el servicio solo). En **local**: expórtalas antes de `npm start`, o usa un archivo `.env` con un paquete como `dotenv` si prefieres.
5. Listo — ahora el botón "✉️ Enviar por correo" pide el destinatario y lo manda de verdad, sin abrir ningún programa de correo. Gmail permite hasta 500 correos gratis al día con este método.

## 6. Estructura del proyecto

```
iear-server/
├── server.js        # Servidor Express + rutas de la API + autenticación JWT
├── db.js             # Lectura/escritura de data/db.json + datos de demostración
├── package.json
├── .env.example
├── data/
│   └── db.json        # Se crea automáticamente la primera vez que arrancas el servidor
└── public/
    └── index.html      # Frontend (interfaz) que consume la API
```

## 7. Seguridad — antes de usarlo con datos reales

- Cambia `JWT_SECRET` por una clave propia.
- Considera limitar quién puede registrarse como "coordinador" (ahora mismo cualquiera que
  se registre puede elegir ese rol; para producción real, lo ideal es que solo un
  coordinador existente pueda crear otras cuentas de coordinador desde Configuración → Usuarios,
  y que el formulario público de registro solo permita crear cuentas de estudiante).
- Usa HTTPS en producción (Render/Railway lo dan automático; en un VPS propio, usa Certbot).
