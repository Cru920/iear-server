const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cambia_esta_clave_en_produccion';

app.use(cors());
app.use(express.json({ limit: '8mb' })); // 8mb para admitir fotos de aula en base64
app.use(express.static(path.join(__dirname, 'public')));

function sign(user) {
  return jwt.sign({ id: user.id, usuario: user.usuario, rol: user.rol, nombre: user.nombre }, JWT_SECRET, { expiresIn: '12h' });
}
function authRequired(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'No autenticado.' });
  try {
    req.user = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión inválida o expirada, inicia sesión de nuevo.' });
  }
}
function coordOnly(req, res, next) {
  if (req.user.rol !== 'coordinador') return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
  next();
}
function logAccion(data, texto) {
  data.historial.unshift({ fecha: new Date().toISOString(), accion: texto });
  data.historial = data.historial.slice(0, 50);
}
function publicUser(u) {
  return { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, tieneRecuperacion: !!(u.pregunta && u.respuesta) };
}

/* ================= CORREO (Gmail vía Nodemailer) ================= */
let mailTransporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ================= AUTH ================= */
app.post('/api/auth/register', (req, res) => {
  const { nombre, usuario, password, pregunta, respuesta } = req.body || {};
  if (!nombre || !usuario || !password || !respuesta) return res.status(400).json({ error: 'Completa todos los campos, incluida la pregunta de seguridad.' });
  if (password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
  if (usuario === 'coordinador') return res.status(409).json({ error: 'Ese nombre de usuario está reservado.' });
  const data = db.read();
  if (data.usuarios.some(u => u.usuario === usuario)) return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
  const user = {
    id: Date.now(), nombre, usuario, password: bcrypt.hashSync(password, 10), rol: 'estudiante',
    pregunta: pregunta || '', respuesta: respuesta ? bcrypt.hashSync(String(respuesta).toLowerCase().trim(), 10) : '',
    favoritos: []
  };
  data.usuarios.push(user);
  logAccion(data, `Cuenta registrada: ${nombre} (${usuario}) - estudiante.`);
  db.write(data);
  res.json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { usuario, password } = req.body || {};
  const data = db.read();
  const user = data.usuarios.find(u => u.usuario === usuario);
  if (!user || !bcrypt.compareSync(password || '', user.password)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/auth/me', authRequired, (req, res) => res.json(req.user));

// Paso 1 de recuperación: devuelve la pregunta de seguridad (nunca la respuesta)
app.post('/api/auth/forgot/question', (req, res) => {
  const { usuario } = req.body || {};
  const data = db.read();
  const u = data.usuarios.find(x => x.usuario === usuario);
  if (!u) return res.status(404).json({ error: 'No existe ninguna cuenta con ese usuario.' });
  if (!u.pregunta || !u.respuesta) return res.status(400).json({ error: 'Esta cuenta no tiene una pregunta de seguridad configurada. Contacta al Coordinador.' });
  res.json({ pregunta: u.pregunta });
});

// Paso 2 de recuperación: valida la respuesta y cambia la contraseña
app.post('/api/auth/forgot/reset', (req, res) => {
  const { usuario, respuesta, nuevaPassword } = req.body || {};
  const data = db.read();
  const u = data.usuarios.find(x => x.usuario === usuario);
  if (!u || !u.respuesta) return res.status(404).json({ error: 'No existe ninguna cuenta con ese usuario.' });
  if (!bcrypt.compareSync(String(respuesta || '').toLowerCase().trim(), u.respuesta)) return res.status(401).json({ error: 'La respuesta no es correcta.' });
  if (!nuevaPassword || nuevaPassword.length < 4) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
  u.password = bcrypt.hashSync(nuevaPassword, 10);
  logAccion(data, `Contraseña restablecida para ${usuario}.`);
  db.write(data);
  res.json({ ok: true });
});

/* ================= AULAS ================= */
app.get('/api/aulas', authRequired, (req, res) => res.json(db.read().aulas));

app.post('/api/aulas', authRequired, coordOnly, (req, res) => {
  const v = req.body || {};
  if (!v.codigo || !v.nombre || !v.ubicacion || !(Number(v.capacidad) > 0)) return res.status(400).json({ error: 'Completa los campos obligatorios y una capacidad mayor que 0.' });
  const data = db.read();
  if (data.aulas.some(a => a.codigo === v.codigo)) return res.status(409).json({ error: 'Ya existe un aula con ese código.' });
  const aula = {
    id: Date.now(), codigo: v.codigo, nombre: v.nombre, ubicacion: v.ubicacion, capacidad: Number(v.capacidad),
    ocupantes: Number(v.ocupantes) || 0, jornada: v.jornada || 'Mañana',
    docente: v.docente || '', grupo: v.grupo || '', asignatura: v.asignatura || '', horario: v.horario || '',
    estado: v.estado || 'Disponible', observaciones: v.observaciones || '', imagen: v.imagen || ''
  };
  data.aulas.push(aula);
  logAccion(data, `Aula ${aula.codigo} creada por ${req.user.nombre}.`);
  db.write(data);
  res.json(aula);
});

app.put('/api/aulas/:id', authRequired, coordOnly, (req, res) => {
  const id = Number(req.params.id);
  const v = req.body || {};
  const data = db.read();
  const idx = data.aulas.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Aula no encontrada.' });
  if (!v.codigo || !v.nombre || !v.ubicacion || !(Number(v.capacidad) > 0)) return res.status(400).json({ error: 'Completa los campos obligatorios y una capacidad mayor que 0.' });
  if (data.aulas.some(a => a.codigo === v.codigo && a.id !== id)) return res.status(409).json({ error: 'Ya existe un aula con ese código.' });
  data.aulas[idx] = {
    ...data.aulas[idx], ...v,
    capacidad: Number(v.capacidad), ocupantes: Number(v.ocupantes) || 0, jornada: v.jornada || data.aulas[idx].jornada,
    imagen: v.imagen !== undefined ? v.imagen : data.aulas[idx].imagen
  };
  logAccion(data, `Aula ${v.codigo} actualizada por ${req.user.nombre}.`);
  db.write(data);
  res.json(data.aulas[idx]);
});

app.patch('/api/aulas/:id/estado', authRequired, coordOnly, (req, res) => {
  const id = Number(req.params.id);
  const data = db.read();
  const aula = data.aulas.find(a => a.id === id);
  if (!aula) return res.status(404).json({ error: 'Aula no encontrada.' });
  const orden = ['Disponible', 'Ocupado', 'Reservado', 'Mantenimiento'];
  aula.estado = orden[(orden.indexOf(aula.estado) + 1) % orden.length];
  logAccion(data, `Estado del aula ${aula.codigo} cambiado a ${aula.estado} por ${req.user.nombre}.`);
  db.write(data);
  res.json(aula);
});

app.delete('/api/aulas/:id', authRequired, coordOnly, (req, res) => {
  const id = Number(req.params.id);
  const data = db.read();
  const aula = data.aulas.find(a => a.id === id);
  if (!aula) return res.status(404).json({ error: 'Aula no encontrada.' });
  data.aulas = data.aulas.filter(a => a.id !== id);
  data.reservas = data.reservas.filter(r => r.aulaId !== id);
  data.usuarios.forEach(u => { if (Array.isArray(u.favoritos)) u.favoritos = u.favoritos.filter(fid => fid !== id); });
  logAccion(data, `Aula ${aula.codigo} eliminada por ${req.user.nombre}.`);
  db.write(data);
  res.json({ ok: true });
});

/* ================= FAVORITOS ================= */
app.get('/api/favoritos', authRequired, (req, res) => {
  const data = db.read();
  const u = data.usuarios.find(x => x.id === req.user.id);
  res.json((u && u.favoritos) || []);
});
app.post('/api/favoritos/:aulaId', authRequired, (req, res) => {
  const aulaId = Number(req.params.aulaId);
  const data = db.read();
  const u = data.usuarios.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (!Array.isArray(u.favoritos)) u.favoritos = [];
  u.favoritos = u.favoritos.includes(aulaId) ? u.favoritos.filter(id => id !== aulaId) : [...u.favoritos, aulaId];
  db.write(data);
  res.json(u.favoritos);
});

/* ================= RESERVAS ================= */
app.get('/api/reservas', authRequired, (req, res) => res.json(db.read().reservas));

function reservaValida(v) {
  return v.aulaId && v.fecha && v.horaInicio && v.horaFin && v.actividad && v.horaFin > v.horaInicio;
}
app.post('/api/reservas', authRequired, coordOnly, (req, res) => {
  const v = req.body || {};
  if (!reservaValida(v)) return res.status(400).json({ error: 'Completa todos los campos obligatorios y verifica el horario.' });
  const data = db.read();
  const overlap = data.reservas.some(r => r.aulaId === Number(v.aulaId) && r.fecha === v.fecha && v.horaInicio < r.horaFin && v.horaFin > r.horaInicio);
  if (overlap) return res.status(409).json({ error: 'Ya existe una reserva para esta aula en ese horario.' });
  const reserva = { id: Date.now(), aulaId: Number(v.aulaId), fecha: v.fecha, horaInicio: v.horaInicio, horaFin: v.horaFin, actividad: v.actividad, docente: v.docente || '' };
  data.reservas.push(reserva);
  logAccion(data, `Reserva creada por ${req.user.nombre}.`);
  db.write(data);
  res.json(reserva);
});

app.put('/api/reservas/:id', authRequired, coordOnly, (req, res) => {
  const id = Number(req.params.id);
  const v = req.body || {};
  if (!reservaValida(v)) return res.status(400).json({ error: 'Completa todos los campos obligatorios y verifica el horario.' });
  const data = db.read();
  const idx = data.reservas.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Reserva no encontrada.' });
  const overlap = data.reservas.some(r => r.id !== id && r.aulaId === Number(v.aulaId) && r.fecha === v.fecha && v.horaInicio < r.horaFin && v.horaFin > r.horaInicio);
  if (overlap) return res.status(409).json({ error: 'Ya existe una reserva para esta aula en ese horario.' });
  data.reservas[idx] = { ...data.reservas[idx], aulaId: Number(v.aulaId), fecha: v.fecha, horaInicio: v.horaInicio, horaFin: v.horaFin, actividad: v.actividad, docente: v.docente || '' };
  logAccion(data, `Reserva actualizada por ${req.user.nombre}.`);
  db.write(data);
  res.json(data.reservas[idx]);
});

app.delete('/api/reservas/:id', authRequired, coordOnly, (req, res) => {
  const id = Number(req.params.id);
  const data = db.read();
  data.reservas = data.reservas.filter(r => r.id !== id);
  logAccion(data, `Reserva cancelada por ${req.user.nombre}.`);
  db.write(data);
  res.json({ ok: true });
});

/* ================= USUARIOS ================= */
app.get('/api/usuarios', authRequired, coordOnly, (req, res) => {
  res.json(db.read().usuarios.map(publicUser));
});

app.post('/api/usuarios', authRequired, coordOnly, (req, res) => {
  const { nombre, usuario, password, respuesta } = req.body || {};
  if (!nombre || !usuario || !password) return res.status(400).json({ error: 'Nombre, usuario y contraseña son obligatorios.' });
  if (usuario === 'coordinador') return res.status(409).json({ error: 'Ese nombre de usuario está reservado.' });
  const data = db.read();
  if (data.usuarios.some(u => u.usuario === usuario)) return res.status(409).json({ error: 'Ese usuario ya existe.' });
  const user = {
    id: Date.now(), nombre, usuario, password: bcrypt.hashSync(password, 10), rol: 'estudiante',
    pregunta: respuesta ? '¿Cuál es la respuesta que te dio el Coordinador?' : '',
    respuesta: respuesta ? bcrypt.hashSync(String(respuesta).toLowerCase().trim(), 10) : '',
    favoritos: []
  };
  data.usuarios.push(user);
  logAccion(data, `Estudiante ${usuario} creado por ${req.user.nombre}.`);
  db.write(data);
  res.json(publicUser(user));
});

app.delete('/api/usuarios/:id', authRequired, coordOnly, (req, res) => {
  const id = Number(req.params.id);
  const data = db.read();
  const target = data.usuarios.find(u => u.id === id);
  if (target && target.rol === 'coordinador') return res.status(403).json({ error: 'La cuenta de Coordinador no se puede eliminar.' });
  data.usuarios = data.usuarios.filter(u => u.id !== id);
  logAccion(data, `Usuario eliminado por ${req.user.nombre}.`);
  db.write(data);
  res.json({ ok: true });
});

/* ================= CONFIG ================= */
app.get('/api/config', authRequired, (req, res) => res.json(db.read().config));

app.put('/api/config', authRequired, coordOnly, (req, res) => {
  const data = db.read();
  data.config = { ...data.config, ...req.body };
  logAccion(data, `Configuración actualizada por ${req.user.nombre}.`);
  db.write(data);
  res.json(data.config);
});

/* ================= HISTORIAL ================= */
app.get('/api/historial', authRequired, (req, res) => res.json(db.read().historial));

/* ================= ENVIAR REPORTE POR CORREO ================= */
app.post('/api/reportes/enviar', authRequired, async (req, res) => {
  const { destinatario, asunto, cuerpo } = req.body || {};
  if (!mailTransporter) return res.status(500).json({ error: 'El envío de correo no está configurado en este servidor todavía.' });
  if (!destinatario || !EMAIL_RE.test(destinatario)) return res.status(400).json({ error: 'Escribe un correo de destino válido.' });
  try {
    const data = db.read();
    await mailTransporter.sendMail({
      from: `"${data.config.proyecto || 'I.E.A.R'}" <${process.env.GMAIL_USER}>`,
      to: destinatario,
      subject: asunto || 'Reporte de Ocupación',
      text: cuerpo || ''
    });
    logAccion(data, `Reporte enviado por correo a ${destinatario} por ${req.user.nombre}.`);
    db.write(data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo enviar el correo. Revisa la configuración de Gmail en el servidor.' });
  }
});

/* ================= DEMO RESET ================= */
app.post('/api/demo/restore', authRequired, coordOnly, (req, res) => {
  db.reset();
  res.json({ ok: true });
});

/* ================= FRONTEND ================= */
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`I.E.A.R backend escuchando en http://localhost:${PORT}`));
