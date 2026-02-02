#!/usr/bin/env node

/**
 * API Security Audit Script
 * Scans all API routes for authentication and security issues
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../src/app/api');

// Security patterns to check
const SECURITY_CHECKS = {
  hasAuth: {
    patterns: [
      /verifyAuth\(/,
      /withAuth\(/,
      /cookies\(\)\.get\('firebase-token'\)/,
      /getAuth\(\)\.verifyIdToken/
    ],
    required: true,
    message: 'Missing authentication check'
  },
  hasAuthImport: {
    patterns: [
      /import.*verifyAuth.*from.*auth-middleware/,
      /import.*withAuth.*from.*auth-middleware/,
      /import.*cookies.*from.*next\/headers/,
      /import.*getAuth.*from.*firebase-admin\/auth/
    ],
    required: true,
    message: 'Missing authentication imports'
  },
  isPublic: {
    patterns: [
      /\/\/ PUBLIC API/,
      /\/\* PUBLIC \*\//
    ],
    required: false,
    message: 'Marked as public API'
  }
};

// Routes that should be public (no auth required)
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
  'hub/auth/route.js'            // Access code validation
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

function analyzeRoute(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(API_DIR, filePath);
  
  const issues = [];
  const methods = [];
  
  // Check for HTTP methods
  if (content.includes('export async function GET')) methods.push('GET');
  if (content.includes('export async function POST')) methods.push('POST');
  if (content.includes('export async function PUT')) methods.push('PUT');
  if (content.includes('export async function DELETE')) methods.push('DELETE');
  if (content.includes('export async function PATCH')) methods.push('PATCH');
  
  // Check if route should be public
  const isPublicRoute = PUBLIC_ROUTES.includes(relativePath);
  
  // If route has POST/PUT/DELETE/PATCH, it definitely needs auth
  const hasModifyingMethods = methods.some(m => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(m));
  
  if (!isPublicRoute || hasModifyingMethods) {
    // Check for authentication
    const hasAuth = SECURITY_CHECKS.hasAuth.patterns.some(pattern => pattern.test(content));
    const hasAuthImport = SECURITY_CHECKS.hasAuthImport.patterns.some(pattern => pattern.test(content));
    
    if (!hasAuth) {
      issues.push({
        type: 'CRITICAL',
        message: 'No authentication check found',
        methods: hasModifyingMethods ? methods.filter(m => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(m)) : methods
      });
    }
    
    if (!hasAuthImport && !hasAuth) {
      issues.push({
        type: 'HIGH',
        message: 'No authentication imports found'
      });
    }
  }
  
  // Check for admin-only routes
  if (relativePath.includes('admin/') || relativePath.includes('dashboard-stats')) {
    const hasAdminCheck = /isAdmin\(/.test(content) || /requireAdmin.*true/.test(content);
    
    if (!hasAdminCheck) {
      issues.push({
        type: 'CRITICAL',
        message: 'Admin route without admin role check'
      });
    }
  }
  
  // Check for dangerous operations
  if (content.includes('S3Client') || content.includes('DeleteObject')) {
    const hasAuth = SECURITY_CHECKS.hasAuth.patterns.some(pattern => pattern.test(content));
    if (!hasAuth) {
      issues.push({
        type: 'CRITICAL',
        message: 'File operations without authentication - MAJOR SECURITY RISK'
      });
    }
  }
  
  return {
    path: relativePath,
    methods,
    issues,
    isPublic: isPublicRoute,
    hasModifyingMethods
  };
}

// Main audit function
function runSecurityAudit() {
  console.log('🔍 Running API Security Audit...\n');
  
  const routes = scanDirectory(API_DIR);
  const results = routes.map(analyzeRoute);
  
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  
  console.log('📊 AUDIT RESULTS:\n');
  
  for (const result of results) {
    const hasCritical = result.issues.some(i => i.type === 'CRITICAL');
    const hasHigh = result.issues.some(i => i.type === 'HIGH');
    const hasMedium = result.issues.some(i => i.type === 'MEDIUM');
    
    if (hasCritical) criticalCount++;
    if (hasHigh) highCount++;
    if (hasMedium) mediumCount++;
    
    if (result.issues.length > 0) {
      const statusEmoji = hasCritical ? '🚨' : hasHigh ? '⚠️' : '📝';
      console.log(`${statusEmoji} ${result.path}`);
      console.log(`   Methods: ${result.methods.join(', ')}`);
      
      for (const issue of result.issues) {
        const typeColor = issue.type === 'CRITICAL' ? '🔴' : issue.type === 'HIGH' ? '🟠' : '🟡';
        console.log(`   ${typeColor} ${issue.type}: ${issue.message}`);
        if (issue.methods) {
          console.log(`      Affected methods: ${issue.methods.join(', ')}`);
        }
      }
      console.log('');
    }
  }
  
  // Summary
  console.log('📈 SUMMARY:');
  console.log(`   Total routes scanned: ${results.length}`);
  console.log(`   🚨 Critical issues: ${criticalCount}`);
  console.log(`   ⚠️ High issues: ${highCount}`);
  console.log(`   📝 Medium issues: ${mediumCount}`);
  console.log(`   ✅ Clean routes: ${results.length - criticalCount - highCount - mediumCount}`);
  
  if (criticalCount > 0) {
    console.log('\n🚨 CRITICAL SECURITY VULNERABILITIES FOUND!');
    console.log('   These must be fixed immediately to prevent security breaches.');
  }
  
  return {
    totalRoutes: results.length,
    criticalIssues: criticalCount,
    highIssues: highCount,
    mediumIssues: mediumCount,
    results
  };
}

if (require.main === module) {
  runSecurityAudit();
}

module.exports = { runSecurityAudit };