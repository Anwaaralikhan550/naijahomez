#!/usr/bin/env node

/**
 * Batch fix remaining auth issues
 */

const fs = require('fs');
const path = require('path');

const ROUTES_TO_FIX = [
  'src/app/api/noticeboard/[id]/route.js',
  'src/app/api/properties/[id]/route.js', 
  'src/app/api/tradespeople/[id]/route.js',
  'src/app/api/noticeboard/route.js',
  'src/app/api/tradespeople/route.js',
  'src/app/api/hub/forum/discussions/[id]/route.js'
];

const OLD_AUTH_PATTERN = /\/\/ Verify authentication\s*\n\s*const cookieStore = cookies\(\);\s*\n\s*const token = cookieStore\.get\('firebase-token'\)\?\.value;\s*\n\s*\n\s*if \(!token\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{ error: 'Unauthorized' \},\s*\n\s*\{ status: 401 \}\s*\n\s*\);\s*\n\s*\}\s*\n\s*\n\s*initAdmin\(\);\s*\n\s*const auth = getAuth\(\);\s*\n\s*let userId;\s*\n\s*\n\s*try \{\s*\n\s*const decodedToken = await auth\.verifyIdToken\(token\);\s*\n\s*userId = decodedToken\.uid;\s*\n\s*\} catch \(authError\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{ error: 'Invalid token' \},\s*\n\s*\{ status: 401 \}\s*\n\s*\);\s*\n\s*\}/gs;

const NEW_AUTH_PATTERN = `    // Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;`;

function fixAuthInContent(content) {
  // Replace the complex old pattern
  let newContent = content.replace(OLD_AUTH_PATTERN, NEW_AUTH_PATTERN);
  
  // Handle simpler patterns
  newContent = newContent.replace(
    /const cookieStore = cookies\(\);[\s\S]*?userId = decodedToken\.uid;/g,
    `// Verify authentication using the auth middleware
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const userId = authResult.userId;`
  );

  // Update imports
  newContent = newContent.replace(
    /import \{ NextResponse \} from 'next\/server';\nimport \{ cookies \} from 'next\/headers';\nimport \{ getAuth \} from 'firebase-admin\/auth';\nimport \{ getFirestore \} from 'firebase-admin\/firestore';\nimport \{ initAdmin \} from '@\/lib\/firebase-admin';/,
    `import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';`
  );

  // Add auth import if missing
  if (!newContent.includes('verifyAuth') && !newContent.includes('@/lib/auth-middleware')) {
    const importMatch = newContent.match(/import.*?from.*?;/g);
    if (importMatch && importMatch.length > 0) {
      const lastImport = importMatch[importMatch.length - 1];
      const insertPoint = newContent.indexOf(lastImport) + lastImport.length;
      newContent = newContent.slice(0, insertPoint) + '\nimport { verifyAuth } from \'@/lib/auth-middleware\';' + newContent.slice(insertPoint);
    }
  }

  return newContent;
}

function fixRoute(routePath) {
  try {
    console.log(`🔧 Fixing: ${routePath}`);
    
    if (!fs.existsSync(routePath)) {
      console.log(`  ❌ File not found: ${routePath}`);
      return false;
    }

    const content = fs.readFileSync(routePath, 'utf-8');
    const newContent = fixAuthInContent(content);
    
    if (content !== newContent) {
      fs.writeFileSync(routePath, newContent, 'utf-8');
      console.log(`  ✅ Fixed authentication patterns`);
      return true;
    } else {
      console.log(`  ⏭️  No changes needed`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error fixing ${routePath}:`, error.message);
    return false;
  }
}

function batchFix() {
  console.log('🔧 Batch fixing remaining authentication issues...\n');
  
  let fixed = 0;
  
  for (const routePath of ROUTES_TO_FIX) {
    if (fixRoute(routePath)) {
      fixed++;
    }
  }
  
  console.log(`\n📈 BATCH FIX SUMMARY:`);
  console.log(`   Routes processed: ${ROUTES_TO_FIX.length}`);
  console.log(`   Routes fixed: ${fixed}`);
  
  if (fixed > 0) {
    console.log('\n🎉 REMAINING VULNERABILITIES FIXED!');
  }
  
  return fixed;
}

if (require.main === module) {
  batchFix();
}

module.exports = { batchFix };