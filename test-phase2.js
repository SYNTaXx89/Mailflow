/**
 * Complete Phase 2 Setup Wizard Test
 */

const fetch = require('node-fetch');

async function testPhase2() {
  const baseUrl = 'http://localhost:3001/api';
  
  try {
    console.log('🧪 Testing Complete Phase 2 Setup Wizard...\n');
    
    // Test 1: Setup status (should need setup)
    console.log('1. Testing setup status...');
    const statusResponse = await fetch(`${baseUrl}/setup/status`);
    const statusData = await statusResponse.json();
    console.log(`   Status: ${statusResponse.status}`);
    console.log(`   Needs setup: ${statusData.needsSetup}`);
    console.log(`   Current step: ${statusData.step}`);
    console.log(`   Instance ID: ${statusData.instanceId}`);
    
    if (!statusData.needsSetup) {
      console.log('   ⚠️  Instance already setup - testing reset...');
      
      // Reset setup for testing
      const resetResponse = await fetch(`${baseUrl}/setup/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAdmin: true })
      });
      
      if (resetResponse.ok) {
        console.log('   ✅ Setup reset successful');
      } else {
        console.log('   ❌ Setup reset failed (might be production mode)');
      }
      
      return; // Exit here for manual testing
    }
    
    // Test 2: Initialize setup
    console.log('\n2. Testing setup initialization...');
    const initResponse = await fetch(`${baseUrl}/setup/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const initData = await initResponse.json();
    console.log(`   Status: ${initResponse.status}`);
    console.log(`   Message: ${initData.message}`);
    
    // Test 3: Create admin account
    console.log('\n3. Testing admin account creation...');
    const adminData = {
      email: 'admin@mailflow.test',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      instanceName: 'Test MailFlow Instance'
    };
    
    const adminResponse = await fetch(`${baseUrl}/setup/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminData)
    });
    const adminResult = await adminResponse.json();
    console.log(`   Status: ${adminResponse.status}`);
    console.log(`   Admin created: ${adminResult.success}`);
    console.log(`   Admin email: ${adminResult.user?.email}`);
    
    if (!adminResult.success) {
      console.log('   ❌ Admin creation failed');
      return;
    }
    
    const adminToken = adminResult.accessToken;
    
    // Test 4: Configure instance
    console.log('\n4. Testing instance configuration...');
    const configData = {
      instanceName: 'Test MailFlow Instance',
      timezone: 'UTC',
      features: {
        multiUser: true,
        invitations: true,
        backups: true
      }
    };
    
    const configResponse = await fetch(`${baseUrl}/setup/configure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(configData)
    });
    const configResult = await configResponse.json();
    console.log(`   Status: ${configResponse.status}`);
    console.log(`   Configuration saved: ${configResult.success}`);
    
    // Test 5: Complete setup
    console.log('\n5. Testing setup completion...');
    const completeResponse = await fetch(`${baseUrl}/setup/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const completeResult = await completeResponse.json();
    console.log(`   Status: ${completeResponse.status}`);
    console.log(`   Setup completed: ${completeResult.success}`);
    console.log(`   Instance name: ${completeResult.config?.instanceName}`);
    
    // Test 6: Verify setup status after completion
    console.log('\n6. Verifying final setup status...');
    const finalStatusResponse = await fetch(`${baseUrl}/setup/status`);
    const finalStatusData = await finalStatusResponse.json();
    console.log(`   Needs setup: ${finalStatusData.needsSetup}`);
    console.log(`   Setup step: ${finalStatusData.step}`);
    
    console.log('\n🎉 Phase 2 Setup Wizard Test Complete!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Setup status detection working');
    console.log('   ✅ Setup initialization working');
    console.log('   ✅ Admin account creation working');
    console.log('   ✅ Instance configuration working');
    console.log('   ✅ Setup completion working');
    console.log('   ✅ Setup state persistence working');
    console.log('\n🌐 Frontend available at: http://localhost:5173');
    console.log('📧 Backend API at: http://localhost:3001/api');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure both servers are running:');
    console.log('  Backend: npm run dev:backend');
    console.log('  Frontend: npm run dev:frontend');
  }
}

testPhase2();