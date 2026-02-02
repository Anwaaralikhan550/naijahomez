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
      // Check if db is already initialized in the next few lines
      const afterMatch = content.substring(content.indexOf(match) + match.length, content.indexOf(match) + match.length + 200);
      if (afterMatch.includes('const db = getFirestore()') || afterMatch.includes('initAdmin()')) {
        return match;
      }
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
  
  // Clean up empty lines
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  return content;
}

// Get all API route files
const apiDir = path.join(__dirname, '../src/app/api');
const filesToConvert = [
  'messages/[id]/route.js',
  'messages/[id]/read/route.js',
  'messages/[id]/forward/route.js'
];

console.log(`Converting ${filesToConvert.length} API route files...`);

// Convert each file
filesToConvert.forEach(relativePath => {
  const file = path.join(apiDir, relativePath);
  
  try {
    if (!fs.existsSync(file)) {
      console.log(`✗ File not found: ${relativePath}`);
      return;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    // Skip if already converted
    if (content.includes('firebase-admin/firestore')) {
      console.log(`✓ Already converted: ${relativePath}`);
      return;
    }
    
    // Skip if no Firebase imports
    if (!content.includes('firebase/firestore') && !content.includes('@/lib/firebase')) {
      console.log(`- No Firebase imports: ${relativePath}`);
      return;
    }
    
    const converted = convertToAdminSDK(content);
    fs.writeFileSync(file, converted);
    console.log(`✓ Converted: ${relativePath}`);
  } catch (error) {
    console.error(`✗ Error converting ${relativePath}:`, error.message);
  }
});

console.log('\nConversion complete!');