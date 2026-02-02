const fs = require('fs');
const path = require('path');

// Function to analyze a form file for contact fields
function analyzeFormFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    console.log(`\n📋 Analyzing ${fileName}:`);
    console.log('=' .repeat(50));
    
    // Extract form data structure
    const formDataMatch = content.match(/formData[,\s]*=\s*useState\s*\(\s*{([^}]+(?:{[^}]*}[^}]*)*)/s);
    if (formDataMatch) {
      console.log('📊 Form Data Structure:');
      const formDataContent = formDataMatch[1];
      
      // Look for contact-related fields
      let contactFields = [];
      const lines = formDataContent.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.includes('contact') || 
            trimmed.includes('phone') || 
            trimmed.includes('email') || 
            trimmed.includes('website') ||
            trimmed.includes('whatsapp')) {
          contactFields.push(trimmed);
          console.log(`   📞 ${trimmed}`);
        }
      });
      
      if (contactFields.length === 0) {
        console.log('   ❌ No contact fields found in form data');
      }
    } else {
      console.log('   ⚠️  Could not extract form data structure');
    }
    
    // Initialize contactFields if not already defined
    if (typeof contactFields === 'undefined') {
      contactFields = [];
    }
    
    // Look for contact-related input fields in JSX
    let contactInputs = [];
    const inputMatches = content.matchAll(/(?:input|textarea)[^>]*(?:name|id)=["']([^"']*(?:contact|phone|email|website|whatsapp)[^"']*)["'][^>]*>/gi);
    
    console.log('\n🔍 Contact Input Fields:');
    let foundInputs = false;
    for (const match of inputMatches) {
      foundInputs = true;
      const fieldName = match[1];
      console.log(`   📝 ${fieldName}`);
      contactInputs.push(fieldName);
    }
    
    if (!foundInputs) {
      console.log('   ❌ No contact input fields found');
    }
    
    // Look for contact-related labels
    const labelMatches = content.matchAll(/<label[^>]*>([^<]*(?:contact|phone|email|website|whatsapp)[^<]*)<\/label>/gi);
    
    console.log('\n🏷️  Contact Labels:');
    let foundLabels = false;
    for (const match of labelMatches) {
      foundLabels = true;
      const labelText = match[1].trim();
      console.log(`   🏷️  "${labelText}"`);
    }
    
    if (!foundLabels) {
      console.log('   ❌ No contact labels found');
    }
    
    // Look for contact validation
    const hasValidation = content.includes('tel') || content.includes('email') || content.includes('url');
    console.log(`\n✅ Input Validation: ${hasValidation ? 'Present' : 'Not found'}`);
    
    // Look for placeholder text
    const placeholderMatches = content.matchAll(/placeholder=["']([^"']*(?:contact|phone|email|website|whatsapp|\+234|@)[^"']*)["']/gi);
    
    console.log('\n📝 Placeholder Text:');
    let foundPlaceholders = false;
    for (const match of placeholderMatches) {
      foundPlaceholders = true;
      const placeholderText = match[1];
      console.log(`   💬 "${placeholderText}"`);
    }
    
    if (!foundPlaceholders) {
      console.log('   ❌ No relevant placeholders found');
    }
    
    return {
      fileName,
      hasContactFields: contactFields && contactFields.length > 0,
      hasContactInputs: contactInputs && contactInputs.length > 0,
      hasValidation,
      contactFields: contactFields || [],
      contactInputs: contactInputs || []
    };
    
  } catch (error) {
    console.error(`❌ Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

// Main analysis function
function analyzeFormStructures() {
  console.log('🔍 Analyzing Form Structures for Contact Information');
  console.log('=' .repeat(60));
  
  const formsDir = path.join(__dirname, '..', 'src', 'components', 'dashboard', 'forms');
  
  try {
    const formFiles = fs.readdirSync(formsDir)
      .filter(file => file.endsWith('Form.js'))
      .map(file => path.join(formsDir, file));
    
    console.log(`📂 Found ${formFiles.length} form files to analyze:`);
    formFiles.forEach(file => console.log(`   - ${path.basename(file)}`));
    
    const results = [];
    
    for (const formFile of formFiles) {
      const result = analyzeFormFile(formFile);
      if (result) {
        results.push(result);
      }
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY ANALYSIS:');
    console.log('=' .repeat(60));
    
    const formsWithContact = results.filter(r => r.hasContactFields || r.hasContactInputs);
    const formsWithoutContact = results.filter(r => !r.hasContactFields && !r.hasContactInputs);
    
    console.log(`✅ Forms with contact fields: ${formsWithContact.length}/${results.length}`);
    formsWithContact.forEach(form => {
      console.log(`   - ${form.fileName}`);
    });
    
    console.log(`\n❌ Forms without contact fields: ${formsWithoutContact.length}/${results.length}`);
    formsWithoutContact.forEach(form => {
      console.log(`   - ${form.fileName}`);
    });
    
    // All unique contact fields found
    const allContactFields = results.flatMap(r => r.contactFields);
    const uniqueContactFields = [...new Set(allContactFields)];
    
    console.log(`\n📋 All unique contact fields found:`);
    uniqueContactFields.forEach(field => {
      console.log(`   - ${field}`);
    });
    
    // All unique contact inputs found
    const allContactInputs = results.flatMap(r => r.contactInputs);
    const uniqueContactInputs = [...new Set(allContactInputs)];
    
    console.log(`\n📝 All unique contact inputs found:`);
    uniqueContactInputs.forEach(input => {
      console.log(`   - ${input}`);
    });
    
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('1. Standardize contact field structure across all forms');
    console.log('2. Add missing contact fields to forms without them');
    console.log('3. Implement consistent validation for contact fields');
    console.log('4. Add user ID linking to associate listings with user accounts');
    console.log('5. Consider adding WhatsApp field for better Nigerian market support');
    
  } catch (error) {
    console.error('❌ Error reading forms directory:', error.message);
  }
}

// Run the analysis
analyzeFormStructures();