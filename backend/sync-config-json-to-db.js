#!/usr/bin/env node

/**
 * Sincroniza backend/config.json -> sorteo_configuracion.valor
 *
 * Uso:
 *   cd backend
 *   node sync-config-json-to-db.js
 *   npm run sync:config
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./db');
const ConfigManagerV2 = require('./config-manager-v2');

const CONFIG_KEY = 'config_principal';
const CONFIG_PATH = path.join(__dirname, 'config.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, text) {
  console.log(`${color}${text}${colors.reset}`);
}

function asegurarDirectorio(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function leerConfigJson() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function validarConfigMinima(config) {
  const errores = [];

  if (!config || typeof config !== 'object') {
    errores.push('La configuración no es un objeto válido.');
    return errores;
  }

  if (!config.cliente || typeof config.cliente !== 'object') {
    errores.push('Falta el bloque cliente.');
  }

  if (!config.rifa || typeof config.rifa !== 'object') {
    errores.push('Falta el bloque rifa.');
  }

  const nombreCliente = String(config?.cliente?.nombre || '').trim();
  const prefijoOrden = String(config?.cliente?.prefijoOrden || '').trim().toUpperCase();
  const nombreSorteo = String(config?.rifa?.nombreSorteo || '').trim();
  const totalBoletos = Number(config?.rifa?.totalBoletos);
  const precioBoleto = Number(config?.rifa?.precioBoleto);

  if (!nombreCliente) errores.push('cliente.nombre está vacío.');
  if (prefijoOrden.length < 2) errores.push('cliente.prefijoOrden debe tener al menos 2 caracteres.');
  if (!nombreSorteo) errores.push('rifa.nombreSorteo está vacío.');
  if (!Number.isFinite(totalBoletos) || totalBoletos <= 0) errores.push('rifa.totalBoletos debe ser mayor a 0.');
  if (!Number.isFinite(precioBoleto) || precioBoleto < 0) errores.push('rifa.precioBoleto debe ser un número válido mayor o igual a 0.');

  return errores;
}

async function respaldarConfigActualEnArchivo(configActualBD) {
  if (!configActualBD) return null;

  asegurarDirectorio(BACKUP_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `config.db-before-sync.${timestamp}.json`);

  fs.writeFileSync(backupPath, JSON.stringify(configActualBD, null, 2), 'utf8');
  return backupPath;
}

async function obtenerConfigActualBD() {
  const row = await db('sorteo_configuracion')
    .where('clave', CONFIG_KEY)
    .first();

  if (!row) return null;
  return typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;
}

async function ejecutar() {
  log(colors.cyan, '\n═════════════════════════════════════════════════════════════');
  log(colors.cyan, '   🔄 SINCRONIZAR CONFIG.JSON → BASE DE DATOS');
  log(colors.cyan, '═════════════════════════════════════════════════════════════\n');

  try {
    log(colors.blue, '1. Verificando tabla de configuración...');
    const tableExists = await db.schema.hasTable('sorteo_configuracion');
    if (!tableExists) {
      throw new Error('La tabla sorteo_configuracion no existe. Ejecuta primero la inicialización de persistencia.');
    }
    log(colors.green, '   ✅ Tabla sorteo_configuracion disponible');

    log(colors.blue, '\n2. Leyendo backend/config.json...');
    const configJson = leerConfigJson();
    log(colors.green, `   ✅ Config cargada: cliente="${configJson?.cliente?.nombre || ''}", sorteo="${configJson?.rifa?.nombreSorteo || ''}"`);

    log(colors.blue, '\n3. Validando campos mínimos...');
    const errores = validarConfigMinima(configJson);
    if (errores.length > 0) {
      errores.forEach((error) => log(colors.red, `   ❌ ${error}`));
      throw new Error('config.json no pasó la validación mínima. Corrige los campos antes de sincronizar.');
    }
    log(colors.green, '   ✅ Validación mínima aprobada');

    log(colors.blue, '\n4. Respaldando configuración actual de la BD...');
    const configAnteriorBD = await obtenerConfigActualBD();
    const backupPath = await respaldarConfigActualEnArchivo(configAnteriorBD);
    if (backupPath) {
      log(colors.green, `   ✅ Backup guardado en: ${backupPath}`);
    } else {
      log(colors.yellow, '   ℹ️ No había una configuración previa para respaldar');
    }

    log(colors.blue, '\n5. Guardando config.json en la BD...');
    const manager = new ConfigManagerV2(db);
    const guardadoEnBD = await manager.guardarEnBD(configJson, 'SYNC_CONFIG_JSON');
    if (!guardadoEnBD) {
      throw new Error('La sincronización cayó en fallback a config.json. Revisa la conexión a la BD antes de continuar.');
    }
    log(colors.green, '   ✅ Sincronización guardada en BD');

    log(colors.blue, '\n6. Verificando datos guardados...');
    const verificacion = await obtenerConfigActualBD();
    if (!verificacion) {
      throw new Error('No se pudo leer la configuración recién sincronizada desde la BD.');
    }

    const coincideNombre = String(verificacion?.cliente?.nombre || '') === String(configJson?.cliente?.nombre || '');
    const coincideSorteo = String(verificacion?.rifa?.nombreSorteo || '') === String(configJson?.rifa?.nombreSorteo || '');
    const coincidePrefijo = String(verificacion?.cliente?.prefijoOrden || '').trim().toUpperCase() === String(configJson?.cliente?.prefijoOrden || '').trim().toUpperCase();

    if (!coincideNombre || !coincideSorteo || !coincidePrefijo) {
      throw new Error('La verificación posterior no coincide con los datos de config.json.');
    }

    log(colors.green, `   ✅ Cliente: ${verificacion.cliente.nombre}`);
    log(colors.green, `   ✅ Prefijo: ${verificacion.cliente.prefijoOrden}`);
    log(colors.green, `   ✅ Sorteo: ${verificacion.rifa.nombreSorteo}`);

    log(colors.cyan, '\n═════════════════════════════════════════════════════════════');
    log(colors.cyan, '   ✅ SINCRONIZACIÓN COMPLETADA');
    log(colors.cyan, '═════════════════════════════════════════════════════════════');
    log(colors.yellow, '\nSiguiente paso recomendado: reiniciar el backend si está corriendo para que recargue la config en memoria.\n');

    await db.destroy();
    process.exit(0);
  } catch (error) {
    log(colors.red, `\n❌ ERROR: ${error.message}\n`);
    try {
      await db.destroy();
    } catch (_) {
      // noop
    }
    process.exit(1);
  }
}

ejecutar();
