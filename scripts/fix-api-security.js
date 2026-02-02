#!/usr/bin/env node

/**
 * Automated API Security Fix Script
 * Fixes authentication issues across all API routes
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../src/app/api');

// Template for authentication check
const AUTH_IMPORT = `import { verifyAuth, isAdmin } from '@/lib/auth-middleware';`;
const BASIC_AUTH_CHECK = `    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;`;

const ADMIN_AUTH_CHECK = `    // Verify authentication and admin role
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    // Check admin role
    const userIsAdmin = await isAdmin(authResult.userId);
    if (!userIsAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const userId = authResult.userId;`;

// Routes that should remain public
const PUBLIC_ROUTES = [
  'properties/route.js',          // GET only
  'marketplace/route.js',         // GET only  
  'tradespeople/route.js',       // GET only
  'housemates/route.js',         // GET only
  'noticeboard/route.js',        // GET only
  'properties/slug/[slug]/route.js', // GET only
  'marketplace/slug/[slug]/route.js', // GET only
  'tradespeople/slug/[slug]/route.js', // GET only
  'housemates/slug/[slug]/route.js', // GET only
  'noticeboard/slug/[slug]/route.js', // GET only
  'hub/auth/route.js'            // Special access code validation
];

function scanDirectory(dir, results = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      scanDirectory(fullPath, results);
    } else if (file.name === 'route.js') {
      results.push(fullPath);
    }
  }
  
  return results;
}

function needsAuthentication(filePath, content) {
  const relativePath = path.relative(API_DIR, filePath);
  
  // Check if it's a public route
  if (PUBLIC_ROUTES.includes(relativePath)) {
    // Even public routes need auth for POST/PUT/DELETE/PATCH
    const hasModifyingMethods = /export async function (POST|PUT|DELETE|PATCH)/.test(content);
    return hasModifyingMethods;
  }
  
  return true;
}

function isAdminRoute(filePath) {
  const relativePath = path.relative(API_DIR, filePath);
  return relativePath.includes('admin/') || 
         relativePath.includes('dashboard-stats') ||
         relativePath.includes('access-codes');
}

function hasAuthentication(content) {
  return /verifyAuth\(/.test(content) ||
         /withAuth\(/.test(content) ||
         /cookies\(\)\.get\('firebase-token'\)/.test(content);
}

function addAuthImport(content) {
  // Check if auth import already exists
  if (/import.*verifyAuth.*from.*auth-middleware/.test(content)) {
    return content;
  }
  
  // Find the last import statement
  const imports = content.match(/import.*?;/g) || [];
  
  if (imports.length === 0) {
    // No imports, add at the top
    return AUTH_IMPORT + '\n' + content;
  }
  
  // Add after the last import
  const lastImport = imports[imports.length - 1];
  const lastImportIndex = content.lastIndexOf(lastImport);
  const insertPoint = lastImportIndex + lastImport.length;
  
  return content.slice(0, insertPoint) + '\n' + AUTH_IMPORT + content.slice(insertPoint);
}

function addAuthCheck(content, isAdmin = false) {
  const authCheck = isAdmin ? ADMIN_AUTH_CHECK : BASIC_AUTH_CHECK;
  
  // Find function definitions that need auth
  const functionRegex = /export async function (POST|PUT|DELETE|PATCH)\(request[^)]*\) \{[\s\n]*try \{/g;
  
  let newContent = content;
  let match;
  let offset = 0;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const insertPoint = match.index + match[0].length + offset;
    
    // Check if auth is already present nearby
    const surroundingCode = newContent.slice(insertPoint, insertPoint + 500);
    if (!/verifyAuth|getAuth|firebase-token/.test(surroundingCode)) {
      newContent = newContent.slice(0, insertPoint) + '\n' + authCheck + newContent.slice(insertPoint);
      offset += authCheck.length + 1;
    }
  }
  
  return newContent;
}

function fixRoute(filePath) {
  try {
    console.log(`\n🔧 Fixing: ${path.relative(API_DIR, filePath)}`);
    
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Check if this route needs authentication
    if (!needsAuthentication(filePath, content)) {
      console.log('  ✅ Public route - skipping');
      return { fixed: false, reason: 'public' };
    }
    
    // Check if already has authentication
    if (hasAuthentication(content)) {
      console.log('  ✅ Already has authentication');
      return { fixed: false, reason: 'already-secure' };
    }
    
    // Add auth import
    content = addAuthImport(content);
    
    // Add auth checks
    const needsAdmin = isAdminRoute(filePath);
    content = addAuthCheck(content, needsAdmin);
    
    // Write the fixed content
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`  ✅ Fixed with ${needsAdmin ? 'admin' : 'basic'} authentication`);
      return { fixed: true, type: needsAdmin ? 'admin' : 'basic' };
    }
    
    console.log('  ⚠️ No changes made');
    return { fixed: false, reason: 'no-changes' };
    
  } catch (error) {
    console.error(`  ❌ Error fixing ${filePath}:`, error.message);
    return { fixed: false, reason: 'error', error: error.message };
  }
}

function runAutoFix() {
  console.log('🔧 Running Automated API Security Fix...\n');
  
  const routes = scanDirectory(API_DIR);
  const results = {
    total: routes.length,
    fixed: 0,
    adminFixed: 0,
    basicFixed: 0,
    skipped: 0,
    errors: 0
  };
  
  for (const routePath of routes) {
    const result = fixRoute(routePath);
    
    if (result.fixed) {
      results.fixed++;
      if (result.type === 'admin') {
        results.adminFixed++;
      } else {
        results.basicFixed++;
      }
    } else if (result.reason === 'error') {
      results.errors++;
    } else {
      results.skipped++;
    }
  }
  
  console.log('\n📈 AUTO-FIX SUMMARY:');
  console.log(`   Total routes: ${results.total}`);
  console.log(`   🔧 Fixed routes: ${results.fixed}`);
  console.log(`     - Basic auth: ${results.basicFixed}`);
  console.log(`     - Admin auth: ${results.adminFixed}`);
  console.log(`   ✅ Skipped (already secure/public): ${results.skipped}`);
  console.log(`   ❌ Errors: ${results.errors}`);
  
  if (results.fixed > 0) {
    console.log('\n🎉 SECURITY VULNERABILITIES FIXED!');
    console.log('   Please test the API endpoints to ensure they work correctly.');
  }
  
  return results;
}

if (require.main === module) {
  runAutoFix();
}

module.exports = { runAutoFix };