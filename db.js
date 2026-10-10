const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function seed() {
  return {
    aulas: [
      { id: 1, codigo: '01', nombre: 'Laboratorio', ubicacion: 'Laboratorio', capacidad: 20, ocupantes: 18, jornada: 'Mañana', docente: 'María López', grupo: '10A', asignatura: 'Química', horario: '7:00-8:00', estado: 'Ocupado', observaciones: '', imagen: '' },
      { id: 2, codigo: '02', nombre: 'Aula 02', ubicacion: 'Segundo Piso', capacidad: 23, ocupantes: 20, jornada: 'Mañana', docente: 'Carlos Pérez', grupo: '9B', asignatura: 'Física', horario: '8:00-9:00', estado: 'Ocupado', observaciones: '', imagen: '' },
      { id: 3, codigo: '03', nombre: 'Aula 03', ubicacion: 'Segundo Piso', capacidad: 24, ocupantes: 24, jornada: 'Mañana', docente: 'Ana Ruiz', grupo: '11A', asignatura: 'Español', horario: '9:00-11:00', estado: 'Ocupado', observaciones: '', imagen: '' },
      { id: 4, codigo: '04', nombre: 'Aula 04', ubicacion: 'Primer Piso - Entrada', capacidad: 30, ocupantes: 0, jornada: 'Tarde', docente: 'Jorge Díaz', grupo: '8A', asignatura: 'Inglés', horario: '7:00-8:00', estado: 'Disponible', observaciones: '', imagen: '' },
      { id: 5, codigo: '05', nombre: 'Aula 05', ubicacion: 'Primer Piso - Salida', capacidad: 21, ocupantes: 0, jornada: 'Tarde', docente: 'Laura Gómez', grupo: '7C', asignatura: 'Matemáticas', horario: '10:00-14:00', estado: 'Reservado', observaciones: '', imagen: '' },
      { id: 6, codigo: '06', nombre: 'Polideportivo', ubicacion: 'Polideportivo', capacidad: 50, ocupantes: 0, jornada: 'Completa', docente: 'Pedro Sánchez', grupo: '10B', asignatura: 'Educación Física', horario: '8:00-10:00', estado: 'Disponible', observaciones: '', imagen: '' },
      { id: 7, codigo: '07', nombre: 'Aula 07', ubicacion: 'Tercer Piso', capacidad: 28, ocupantes: 0, jornada: 'Completa', docente: 'Sin asignar', grupo: '-', asignatura: '-', horario: '-', estado: 'Mantenimiento', observaciones: 'Pintura en proceso', imagen: '' }
    ],
    reservas: [],
    usuarios: [
      { id: 1, nombre: 'Camilo Cruz', usuario: 'coordinador', password: bcrypt.hashSync('coord123', 10), rol: 'coordinador', pregunta: '', respuesta: '', favoritos: [] },
      { id: 2, nombre: 'Estudiante Demo', usuario: 'estudiante', password: bcrypt.hashSync('est123', 10), rol: 'estudiante', pregunta: '¿Cuál es tu color favorito?', respuesta: bcrypt.hashSync('azul', 10), favoritos: [] }
    ],
    config: { institucion: 'Institución Educativa Antonio Ricaurte', proyecto: 'I.E.A.R', notif: true },
    historial: [{ fecha: new Date().toISOString(), accion: 'Sistema inicializado con datos de demostración.' }]
  };
}

function ensure() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify(seed(), null, 2));
}

function read() {
  ensure();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function reset() {
  write(seed());
}

module.exports = { read, write, reset };
