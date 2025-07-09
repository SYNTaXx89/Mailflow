/**
 * Test setup endpoints
 */

const fetch = require('node-fetch');

async function testSetup() {
  const baseUrl = 'http://localhost:3001/api';
  
  try {
    console.log('🧪 Testing Setup System...\n');
    
    // Test setup status
    console.log('1. Testing setup status...');
    const statusResponse = await fetch(`${baseUrl}/setup/status`);
    console.log(`   Status: ${statusResponse.status}`);
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('   ✅ Setup status:', statusData);
      
      if (statusData.needsSetup) {
        console.log('   🔧 Instance needs setup');
        console.log('   📋 Current step:', statusData.step);
      } else {
        console.log('   ✅ Instance already configured');
      }
    } else {
      console.log('   ❌ Setup status check failed');
      return;
    }
    
    console.log('\n🎉 Setup system is working!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure the server is running: npm run dev:backend');
  }
}

testSetup();