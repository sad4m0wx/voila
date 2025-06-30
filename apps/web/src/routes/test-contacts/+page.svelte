<script>
  import { onMount } from 'svelte';
  import { ContactService } from '$lib/services/contactService.js';
  import LoadingIndicator from '$lib/components/utils/LoadingIndicator.svelte';

  let testResults = [];
  let isRunning = false;
  let contacts = [];
  let permissionStatus = null;
  let platformInfo = null;

  onMount(() => {
    platformInfo = ContactService.getPlatformInfo();
    addResult('Test page loaded successfully', 'success');
    addResult(`Platform: ${platformInfo.platform}`, 'info');
    addResult(`Is native: ${platformInfo.isNative}`, platformInfo.isNative ? 'success' : 'warning');
    addResult(`Contacts supported: ${platformInfo.isSupported}`, platformInfo.isSupported ? 'success' : 'warning');
  });

  function addResult(message, type = 'info') {
    testResults = [...testResults, { 
      message, 
      type, 
      timestamp: new Date().toLocaleTimeString() 
    }];
  }

  async function checkPermission() {
    addResult('Checking contacts permission...', 'info');
    
    try {
      const result = await ContactService.checkPermission();
      permissionStatus = result.granted;
      
      if (result.granted) {
        addResult('✅ Permission already granted', 'success');
      } else {
        addResult(`❌ Permission not granted: ${result.message}`, 'warning');
      }
      
      return result.granted;
    } catch (error) {
      addResult(`❌ Error checking permission: ${error.message}`, 'error');
      return false;
    }
  }

  async function requestPermission() {
    addResult('Requesting contacts permission...', 'info');
    
    try {
      const result = await ContactService.requestPermission();
      permissionStatus = result.granted;
      
      if (result.granted) {
        addResult('✅ Permission granted successfully', 'success');
      } else {
        addResult(`❌ Permission denied: ${result.message}`, 'error');
      }
      
      return result.granted;
    } catch (error) {
      addResult(`❌ Error requesting permission: ${error.message}`, 'error');
      return false;
    }
  }

  async function loadContacts() {
    addResult('Loading contacts...', 'info');
    
    try {
      const result = await ContactService.getContactsWithPhones();
      
      if (result.success) {
        contacts = result.contacts;
        addResult(`✅ Loaded ${contacts.length} contacts with phone numbers`, 'success');
      } else {
        addResult(`❌ Failed to load contacts: ${result.error}`, 'error');
      }
    } catch (error) {
      addResult(`❌ Error loading contacts: ${error.message}`, 'error');
    }
  }

  async function runAllTests() {
    if (isRunning) return;
    
    isRunning = true;
    testResults = [];
    contacts = [];
    
    addResult('Starting comprehensive contacts test...', 'info');
    
    // Test 1: Check platform support
    addResult('=== Test 1: Platform Support ===', 'info');
    const platform = ContactService.getPlatformInfo();
    addResult(`Platform: ${platform.platform}`, 'info');
    addResult(`Native: ${platform.isNative}`, platform.isNative ? 'success' : 'warning');
    addResult(`Supported: ${platform.isSupported}`, platform.isSupported ? 'success' : 'warning');
    
    if (!platform.isSupported) {
      addResult('❌ Contacts not supported on this platform', 'error');
      isRunning = false;
      return;
    }
    
    // Test 2: Check current permission
    addResult('=== Test 2: Permission Check ===', 'info');
    const hasPermission = await checkPermission();
    
    // Test 3: Request permission if needed
    if (!hasPermission) {
      addResult('=== Test 3: Permission Request ===', 'info');
      const permissionGranted = await requestPermission();
      
      if (!permissionGranted) {
        addResult('❌ Cannot continue without permission', 'error');
        isRunning = false;
        return;
      }
    }
    
    // Test 4: Load contacts
    addResult('=== Test 4: Load Contacts ===', 'info');
    await loadContacts();
    
    addResult('✅ All tests completed', 'success');
    isRunning = false;
  }

  function clearResults() {
    testResults = [];
    contacts = [];
    permissionStatus = null;
  }

  function getResultClass(type) {
    switch (type) {
      case 'success': return 'text-green-700 bg-green-50 border-green-200';
      case 'error': return 'text-red-700 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  }

  function getResultIcon(type) {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }

  function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    return phoneNumber.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }
</script>

<svelte:head>
  <title>Contacts Test | Voilà!</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-4xl mx-auto px-4">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">Contacts Plugin Test</h1>
    
    <!-- Platform Info Card -->
    {#if platformInfo}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Platform Information</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span class="font-medium text-gray-600">Platform:</span>
            <span class="ml-2">{platformInfo.platform}</span>
          </div>
          <div>
            <span class="font-medium text-gray-600">Native:</span>
            <span class="ml-2 {platformInfo.isNative ? 'text-green-600' : 'text-red-600'}">
              {platformInfo.isNative ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span class="font-medium text-gray-600">Supported:</span>
            <span class="ml-2 {platformInfo.isSupported ? 'text-green-600' : 'text-red-600'}">
              {platformInfo.isSupported ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Control Panel -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Test Controls</h2>
      <div class="flex flex-wrap gap-3">
        <button
          on:click={runAllTests}
          disabled={isRunning}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isRunning}
            <LoadingIndicator size="sm" />
            Running Tests...
          {:else}
            Run All Tests
          {/if}
        </button>
        
        <button
          on:click={checkPermission}
          disabled={isRunning}
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Check Permission
        </button>
        
        <button
          on:click={requestPermission}
          disabled={isRunning}
          class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
        >
          Request Permission
        </button>
        
        <button
          on:click={loadContacts}
          disabled={isRunning || !permissionStatus}
          class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Load Contacts
        </button>
        
        <button
          on:click={clearResults}
          disabled={isRunning}
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          Clear Results
        </button>
      </div>
    </div>

    <!-- Test Results -->
    {#if testResults.length > 0}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Test Results</h2>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          {#each testResults as result}
            <div class="border rounded-lg p-3 text-sm {getResultClass(result.type)}">
              <div class="flex items-start">
                <span class="mr-2">{getResultIcon(result.type)}</span>
                <div class="flex-1">
                  <div>{result.message}</div>
                  <div class="text-xs opacity-75 mt-1">{result.timestamp}</div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Contacts List -->
    {#if contacts.length > 0}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">
          Contacts ({contacts.length})
        </h2>
        <div class="space-y-3 max-h-96 overflow-y-auto">
          {#each contacts as contact}
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="font-medium text-gray-900">
                {contact.name?.display || contact.name?.given || 'Unknown'}
              </div>
              {#if contact.phones && contact.phones.length > 0}
                <div class="mt-2 space-y-1">
                  {#each contact.phones as phone}
                    <div class="text-sm text-gray-600">
                      <span class="font-medium">{phone.label || 'Phone'}:</span>
                      <span class="ml-2">{formatPhoneNumber(phone.number)}</span>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if contact.emails && contact.emails.length > 0}
                <div class="mt-2 space-y-1">
                  {#each contact.emails as email}
                    <div class="text-sm text-gray-600">
                      <span class="font-medium">{email.label || 'Email'}:</span>
                      <span class="ml-2">{email.address}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Instructions -->
    <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 class="font-medium text-blue-900 mb-2">Instructions</h3>
      <div class="text-sm text-blue-800 space-y-1">
        <p>1. Click "Run All Tests" to perform a comprehensive test of the contacts plugin</p>
        <p>2. The app will first check platform support and current permissions</p>
        <p>3. If permission is needed, you'll be prompted to grant access to contacts</p>
        <p>4. Once permission is granted, contacts will be loaded and displayed</p>
        <p>5. Individual test buttons are available for debugging specific functionality</p>
      </div>
    </div>
  </div>
</div> 