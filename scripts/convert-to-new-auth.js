#!/usr/bin/env node

/**
 * Convert old auth patterns to new auth middleware
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../src/app/api');

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

function hasOldAuth(content) {
  return /cookies\(\)\.get\('firebase-token'\)/.test(content) ||
         /getAuth\(\)\.verifyIdToken/.test(content);
}

function hasNewAuth(content) {
  return /verifyAuth\(request\)/.test(content);
}

function convertAuthPattern(content) {
  // Replace old auth pattern with new one
  const oldAuthPattern = /\/\/ Verify authentication\s*\n\s*const cookieStore = cookies\(\);\s*\n\s*const token = cookieStore\.get\('firebase-token'\)\?\.value;\s*\n\s*\n\s*if \(!token\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{ error: 'Unauthorized' \},\s*\n\s*\{ status: 401 \}\s*\n\s*\);\s*\n\s*\}\s*\n\s*\n\s*initAdmin\(\);\s*\n\s*const auth = getAuth\(\);\s*\n\s*let userId;\s*\n\s*\n\s*try \{\s*\n\s*const decodedToken = await auth\.verifyIdToken\(token\);\s*\n\s*userId = decodedToken\.uid;\s*\n\s*\} catch \(authError\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{ error: 'Invalid token' \},\s*\n\s*\{ status: 401 \}\s*\n\s*\);\s*\n\s*\}/gs;

  const newAuthPattern = `    // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;`;

  let newContent = content;
  
  // Simple replacement for the most common pattern
  newContent = newContent.replace(
    /\/\/ Verify authentication[\s\S]*?userId = decodedToken\.uid;[\s\S]*?\}/,
    newAuthPattern
  );

  // Also handle variations
  newContent = newContent.replace(
    /const cookieStore = cookies\(\);[\s\S]*?userId = decodedToken\.uid;/,
    `// Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;`
  );

  return newContent;
}

function convertRoute(filePath) {
  try {
    const relativePath = path.relative(API_DIR, filePath);
    console.log(`\n🔄 Converting: ${relativePath}`);
    
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    if (!hasOldAuth(content)) {
      if (hasNewAuth(content)) {
        console.log('  ✅ Already using new auth');
      } else {
        console.log('  ⏭️ No auth pattern found');
      }
      return { converted: false, reason: 'no-old-auth' };
    }
    
    // Add import if not present
    if (!/import.*verifyAuth.*from.*auth-middleware/.test(content)) {
      const imports = content.match(/import.*?;/g) || [];
      if (imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPoint = lastImportIndex + lastImport.length;
        content = content.slice(0, insertPoint) + '\nimport { verifyAuth, isAdmin } from \'@/lib/auth-middleware\';' + content.slice(insertPoint);
      }
    }
    
    // Convert auth pattern
    content = convertAuthPattern(content);
    
    // Remove unused imports if they exist
    content = content.replace(/import \{ cookies \} from 'next\/headers';\n/, '');
    content = content.replace(/import \{ getAuth \} from 'firebase-admin\/auth';\n/, '');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log('  ✅ Converted to new auth middleware');
      return { converted: true };
    }
    
    console.log('  ⚠️ No changes made');
    return { converted: false, reason: 'no-changes' };
    
  } catch (error) {
    console.error(`  ❌ Error converting ${filePath}:`, error.message);
    return { converted: false, reason: 'error', error: error.message };
  }
}

function runConversion() {
  console.log('🔄 Converting old auth patterns to new auth middleware...\n');
  
  const routes = scanDirectory(API_DIR);
  const results = {
    total: routes.length,
    converted: 0,
    errors: 0,
    skipped: 0
  };
  
  for (const routePath of routes) {
    const result = convertRoute(routePath);
    
    if (result.converted) {
      results.converted++;
    } else if (result.reason === 'error') {
      results.errors++;
    } else {
      results.skipped++;
    }
  }
  
  console.log('\n📈 CONVERSION SUMMARY:');
  console.log(`   Total routes: ${results.total}`);
  console.log(`   🔄 Converted: ${results.converted}`);
  console.log(`   ⏭️ Skipped: ${results.skipped}`);
  console.log(`   ❌ Errors: ${results.errors}`);
  
  if (results.converted > 0) {
    console.log('\n🎉 AUTH PATTERNS UPDATED!');
    console.log('   All routes now use the new auth middleware.');
  }
  
  return results;
}

if (require.main === module) {
  runConversion();
}

module.exports = { runConversion };