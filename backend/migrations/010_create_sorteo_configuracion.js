/**
 * MIGRACIÓN: 010_create_sorteo_configuracion.js
 * OBJETIVO: Crear tabla para persistencia de configuración en Supabase
 * FECHA: Abril 2026
 * 
 * Problema que resuelve:
 * - Los cambios a config.json se perdían al reiniciar Railway
 * - Necesitábamos persistencia real en la BD
 * 
 * Solución:
 * - Almacenar claveConf como JSON en la BD
 * - El ConfigManager lee desde aquí primero
 * - config.json es fallback de desarrollo
 */

exports.up = async (knex) => {
  console.log('\n✅ MIGRACIÓN 010: Crear tabla sorteo_configuracion...\n');
  
  // Verificar si la tabla ya existe
  const tableExists = await knex.schema.hasTable('sorteo_configuracion');
  
  if (tableExists) {
    console.log('⚠️  Tabla sorteo_configuracion ya existe, saltando creación');
    return;
  }

  return knex.schema.createTable('sorteo_configuracion', (table) => {
    // 🔑 PK: ID único
    table.increments('id').primary();
    
    // 📝 Clave de configuración (ej: "config_principal", "config_premios")
    table.string('clave', 100).notNullable().unique();
    
    // 💾 JSON con toda la configuración
    // Esto almacena el objeto completo de config.json
    table.jsonb('valor').notNullable().defaultTo('{}');
    
    // 👤 Quién hizo el último cambio
    table.string('actualizado_por', 255).nullable();
    
    // ⏰ Timestamps
    table.timestamps(true, true); // created_at, updated_at con precisión

    // 📍 Índices para performance
    table.index('clave');
    table.index('updated_at');
  });
};

exports.down = async (knex) => {
  console.log('\n⚠️  ROLLBACK 010: Eliminar tabla sorteo_configuracion...\n');
  return knex.schema.dropTableIfExists('sorteo_configuracion');
};
