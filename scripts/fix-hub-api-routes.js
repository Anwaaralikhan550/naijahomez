const fs = require('fs');
const path = require('path');

// Function to convert client Firebase imports to Admin SDK
function convertToAdminSDK(content) {
  // Replace firebase/firestore imports with firebase-admin
  content = content.replace(
    /import\s*{\s*([^}]+)\s*}\s*from\s*['"]firebase\/firestore['"];?/g,
    (match, imports) => {
      // Parse the imports
      const importList = imports.split(',').map(i => i.trim());
      const adminImports = [];
      
      // These functions are not needed with admin SDK
      const skipFunctions = ['collection', 'doc', 'query', 'where', 'orderBy', 'limit', 
                            'getDocs', 'getDoc', 'setDoc', 'addDoc', 'updateDoc', 'deleteDoc',
                            'serverTimestamp', 'increment', 'arrayUnion', 'arrayRemove'];
      
      importList.forEach(imp => {
        if (!skipFunctions.includes(imp)) {
          adminImports.push(imp);
        }
      });
      
      // Return empty string if all imports are skipped
      if (adminImports.length === 0) {
        return '';
      }
      
      return `import { ${adminImports.join(', ')} } from 'firebase-admin/firestore';`;
    }
  );
  
  // Replace @/lib/firebase imports
  content = content.replace(
    /import\s*{\s*[^}]+\s*}\s*from\s*['"]@\/lib\/firebase['"];?/g,
    ''
  );
  
  // Add firebase-admin imports if not present
  if (!content.includes("from 'firebase-admin/firestore'") && 
      !content.includes('from "firebase-admin/firestore"')) {
    // Add after NextResponse import
    content = content.replace(
      /(import\s*{\s*NextResponse\s*}\s*from\s*['"]next\/server['"];?)/,
      `$1\nimport { getFirestore } from 'firebase-admin/firestore';\nimport { initAdmin } from '@/lib/firebase-admin';`
    );
  } else if (!content.includes('@/lib/firebase-admin')) {
    // Add initAdmin import
    content = content.replace(
      /(import\s*{\s*[^}]*\s*}\s*from\s*['"]firebase-admin\/firestore['"];?)/,
      `$1\nimport { initAdmin } from '@/lib/firebase-admin';`
    );
  }
  
  // Replace db usage with getFirestore()
  content = content.replace(/\bdb\./g, 'db.');
  
  // Add db initialization where needed
  const functionPatterns = [
    /export\s+async\s+function\s+\w+\s*\([^)]*\)\s*{\s*try\s*{/g,
    /export\s+const\s+\w+\s*=\s*async\s*\([^)]*\)\s*=>\s*{\s*try\s*{/g
  ];
  
  functionPatterns.forEach(pattern => {
    content = content.replace(pattern, (match) => {
      return match + '\n    // Initialize admin SDK\n    initAdmin();\n    const db = getFirestore();\n';
    });
  });
  
  // Clean up any double initialization
  content = content.replace(/(initAdmin\(\);\s*const db = getFirestore\(\);\s*){2,}/g, 
    'initAdmin();\n    const db = getFirestore();\n');
  
  // Fix serverTimestamp usage
  content = content.replace(/serverTimestamp\(\)/g, 'new Date()');
  
  // Fix FieldValue usage
  content = content.replace(/FieldValue\.serverTimestamp\(\)/g, 'new Date()');
  content = content.replace(/FieldValue\.increment\(([^)]+)\)/g, (match, value) => {
    return `admin.firestore.FieldValue.increment(${value})`;
  });
  
  return content;
}

// Get all hub API route files
const hubApiDir = path.join(__dirname, '../src/app/api/hub');
const files = [];

function findRouteFiles(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findRouteFiles(fullPath);
    } else if (item === 'route.js') {
      files.push(fullPath);
    }
  });
}

findRouteFiles(hubApiDir);

console.log(`Found ${files.length} route files to convert`);

// Convert each file
files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Skip if already converted
    if (content.includes('firebase-admin/firestore')) {
      console.log(`✓ Already converted: ${path.relative(hubApiDir, file)}`);
      return;
    }
    
    // Skip if no Firebase imports
    if (!content.includes('firebase/firestore') && !content.includes('@/lib/firebase')) {
      console.log(`- No Firebase imports: ${path.relative(hubApiDir, file)}`);
      return;
    }
    
    const converted = convertToAdminSDK(content);
    fs.writeFileSync(file, converted);
    console.log(`✓ Converted: ${path.relative(hubApiDir, file)}`);
  } catch (error) {
    console.error(`✗ Error converting ${file}:`, error.message);
  }
});

console.log('\nConversion complete!');