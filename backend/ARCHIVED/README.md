# 📦 ARCHIVED - Old Backend Scripts

**Purpose:** Store old migration, test, and debug scripts from the cleanup on April 2, 2026.

**Important:** These files are archived to keep the main `/backend` directory clean. They are preserved for reference and potential restoration.

---

## 📂 Directory Structure

### `/migrations/` - Old Version-Specific Migrations
Files that execute database migrations for specific versions (v2, v3, v4).

**Status:** ❌ DEPRECATED (Already applied to database)

These scripts were used to execute database schema changes during version upgrades. They are no longer needed because:
1. All migrations have been applied to the production database
2. Knex migration infrastructure in `knexfile.js` replaces these
3. Future migrations should use `db/migrations/` directory structure

**To restore:** 
```bash
cp migrations/execute-v3-7-migration.js ../  # Copy back to backend/
```

---

### `/tests/` - Integration & Unit Tests
Ad-hoc test files named `test-*.js` for testing various features.

**Status:** ✅ REFERENCE (Can be reorganized)

These tests work but are not properly organized. They should eventually be:
- Moved to a dedicated `/test` directory at project root
- Organized by type: `/test/unit/`, `/test/integration/`
- Renamed to follow Jest convention: `.test.js` or `.spec.js`

**Current use:**
```bash
# To run a specific test (from backend/ directory)
node -r dotenv/config ARCHIVED/tests/test-flujo-completo.js

# To move tests to proper location
mkdir -p ../../test/integration/
mv ARCHIVED/tests/test-*.js ../../test/integration/
```

**Feature coverage:**
- Precios (price calculations)
- Comprobante (receipts)
- Descuentos (discounts)
- Ordenes (orders)
- Boletos (tickets)
- Integration flows

---

### `/debug/` - Debug, Analysis & Utility Scripts
One-time debug scripts, analysis tools, and utilities used during development.

**Status:** ⚠️ LEGACY (Problem-specific)

#### One-Time Debug Scripts
These were created to investigate specific issues:
- `debug-comprobante.js` - Investigation of receipt generation
- `diagnose.js` / `diagnostico-esquema.js` - Schema diagnostics
- `investigar-inconsistencias.js` - Data consistency investigation
- `check-v3-7-results.js` - Version 3.7 verification

**Use only if:** A similar problem recurs and you want to understand the original debugging approach.

#### Backup & Reset Utilities
Old tools for backing up and resetting data:
- `backup-*.js` - Schema backup tools
- `reset-boletos-estado.js` - Reset ticket state (now handled by reset-admin.js)
- `fix-*.js` - Old fixes that were already applied

**Replaced by:** `reset-admin.js`, `create-admin.js` (in main backend/)

#### Analysis Scripts
Tools that analyze database performance and structure:
- `analyze-bloat.js` - Table bloat analysis
- `analyze-table-size.js` - Size analysis
- `analizar-auditoria.js` - Audit analysis
- `audit-*.js` - Various audit scripts

**Replaced by:** `audit-bd-supabase.js` (in main backend/)

**Why consolidated:**
The `audit-bd-supabase.js` script does what all these analysis scripts do, but better:
- Comprehensive report in one run
- EXPLAIN ANALYZE for query performance
- Professional output format
- Actionable recommendations

#### Other Utilities
- `export-schema.js` - Export database schema
- `populate-oportunidades.js` - Populate test data
- `patch-endpoint-mejorado.js` - Old endpoint patch
- `execute-persistencia-config.js` - Old config execution
- `cleanup-and-fix.js` - Old cleanup procedure

---

## 🔄 How to Use This Archive

### Find a Specific Old File
```bash
# Search for files containing "audit"
find . -name "*audit*"

# See what's in migrations/
ls -la migrations/

# See what's in tests/
ls -la tests/
```

### Restore All Files of a Type
```bash
# Restore all migrations to main backend/
cp migrations/*.js ../

# Restore all test files
cp tests/*.js ../

# Restore debug files
cp debug/*.js ../
```

### Restore One Specific File
```bash
# Example: Restore the v3.7 migration
cp migrations/execute-v3-7-migration.js ../execute-v3-7-migration.js

# Example: Restore table size analyzer
cp debug/analyze-table-size.js ../analyze-table-size.js
```

### View File Contents Without Restoring
```bash
# Read a file to understand what it does
cat migrations/execute-v3-7-migration.js | head -50

# Check modification date
ls -l migrations/execute-v3-7-migration.js
```

---

## 📋 Key Information by Purpose

### For Performance Issues
If máquina de la suerte is slow again:
- Don't restore analysis tools
- Use `../audit-bd-supabase.js` (main backend/)
- Use `../apply-partial-index.js` to re-create index if needed

### For Testing
If you want to run old tests:
```bash
# From backend/ directory
node -r dotenv/config ARCHIVED/tests/test-flujo-completo.js
```

Better: Move tests to proper `/test` directory structure

### For Backup/Recovery
If you need to back up database schema:
```bash
# Use PostgreSQL directly (better than these scripts)
pg_dump -h host -U user -d rifaplus > schema.sql
```

### For Migrations
If you need to understand past migrations:
```bash
# Check git history instead
git log --oneline -- backend/ARCHIVED/migrations/

# View a specific migration
git show <commit>:backend/ARCHIVED/migrations/execute-v3-7-migration.js
```

---

## ⚠️ Important Notes

1. **Don't restore files without understanding them first**
   - Read the file header/comments
   - Understand what problem it solved
   - Check if it's already been applied (check git log)

2. **Check dependencies**
   - Old scripts might depend on functions or config that no longer exist
   - They might reference old database schemas

3. **Use main backend/ tools instead**
   - `validate-db.js` for health checks
   - `audit-bd-supabase.js` for analysis
   - `apply-partial-index.js` for index creation
   - `reset-admin.js` for admin reset

4. **For new features?**
   - Don't copy old scripts
   - Start fresh with current structure
   - Use existing tools as reference only

---

## 📊 Statistics

Total archived files: **57**
- Migrations: 14 files
- Tests: 18 files
- Debug/Utilities: 25 files

Space saved in main backend/: ~2.5 MB of clutter removed

---

## ✅ When Was This Created?

**Cleanup Date:** April 2, 2026  
**Reason:** Thorough cleanup of backend directory to improve maintainability  
**Git History:** All files still available via `git log` and `git checkout`

---

## 🆘 Need Help?

### To restore everything
```bash
cp -r * ../
cd ..
rm -rf ARCHIVED
```

### To see what changed
```bash
git diff HEAD~1 backend/
git show HEAD:backend/  # See current state
```

### To understand dependencies
```bash
# Search where a function is called
grep -r "functionName" ../backend/

# Find imports of a module
grep -r "require.*filename" ../
```

---

**Status:** Files preserved, directory cleaner, production code better organized.
