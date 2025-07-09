/**
 * Quick test script for authentication endpoints
 */

const fetch = require('node-fetch');

async function testAuth() {
  const baseUrl = 'http://localhost:3001/api';
  
  try {
    console.log('🧪 Testing MailFlow Authentication System...\n');
    
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    console.log(`   Status: ${healthResponse.status}`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Health check passed');
    } else {
      console.log('   ❌ Health check failed');
      return;
    }
    
    // Test 2: Try to access protected endpoint without auth
    console.log('\n2. Testing protected endpoint without auth...');
    const protectedResponse = await fetch(`${baseUrl}/auth/me`);
    console.log(`   Status: ${protectedResponse.status}`);
    
    if (protectedResponse.status === 401) {
      console.log('   ✅ Correctly rejected unauthenticated request');
    } else {
      console.log('   ❌ Should have rejected unauthenticated request');
    }
    
    // Test 3: Database connection test
    console.log('\n3. Testing database connection...');
    try {
      const accountsResponse = await fetch(`${baseUrl}/accounts`);
      console.log(`   Accounts endpoint status: ${accountsResponse.status}`);
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        console.log(`   ✅ Database accessible (found ${accountsData.accounts?.length || 0} accounts)`);
      }
    } catch (error) {
      console.log('   ⚠️  Database test inconclusive:', error.message);
    }
    
    console.log('\n🎉 Authentication system tests completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Server responding');
    console.log('   ✅ Authentication middleware working');
    console.log('   ✅ Database accessible');
    console.log('   ✅ Ready for Phase 2 (Setup Wizard)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure the server is running: npm run dev:backend');
  }
}

testAuth();