<script>
  import { onMount, onDestroy, getContext } from "svelte";
  import { get } from "svelte/store";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getFirestore, doc, updateDoc, serverTimestamp } from "firebase/firestore";
  import SlideToConfirm from "$components/utils/SlideToConfirm.svelte";
  import LoadingSpinner from "$components/utils/LoadingSpinner.svelte";
  import MapProvider from '$components/maps/MapProvider.svelte';
  import MapContainer from '$components/maps/MapContainer.svelte';
  import AddressSelection from '$components/groups/AddressSelection.svelte';
  import GroupInvite from '$components/groups/GroupInvite.svelte';
  import MeetingPointResults from '$components/meeting/MeetingPointResults.svelte';
  import MeetingPointProgress from '$components/groups/MeetingPointProgress.svelte';
  import { defaultMapCenter, defaultMapZoom } from "$lib/config.js";
  import { 
    currentGroup, 
    currentGroupMembers, 
    attendance,
    isLoading, 
    error,
    loadGroup,
    loadGroupMembers,
    updateMyAttendance,
    subscribeToAttendance,
    unsubscribeFromAttendance,
    resetGroupAttendance as resetAttendance,
    saveMeetingPointForGroup,
    setMyGroupAddress,
    fixGroupMemberAddresses
  } from '$stores/groups';
  import { authStore, addresses } from '$stores/auth';
  import { findOptimalMeetingPoint } from "$lib/services/meetingPointApi";
  
  const { user, profile, isLoading: authLoading } = getContext('auth');

  // Core state
  let isAttending = false;
  let selectedAddressId = null;
  let showInviteSection = false;
  let isInviting = false;
  let isResettingAttendance = false;
  
  // Meeting point state
  let optimalPoint = null;
  let isCalculating = false;
  let calculationError = null;
  let lastCalculationTime = null;
  let calculationStep = 'analyzing';
  
  // Map state
  let mapCenter = defaultMapCenter;
  let mapZoom = defaultMapZoom;
  let mapMarkers = [];
  let routes = [];
  
  // Reactive calculations
  $: groupId = $page.params.id;
  $: isAdmin = $currentGroup?.admins?.includes($user?.uid);
  $: isCreator = $currentGroup?.creatorId === $user?.uid;
  
  // Keep local isAttending in sync with attendance store
  $: if ($user?.uid && $attendance) {
    const myAttendance = $attendance.get($user.uid);
    isAttending = myAttendance?.isAttending || false;
  }
  
  // Computed values for meeting point requirements
  $: attendingMembers = getAttendingMembers($currentGroupMembers, $attendance, $user, selectedAddressId, $addresses);
  $: attendingCount = Array.from($attendance.values()).filter(a => a.isAttending).length;
  $: membersWithAddresses = $currentGroupMembers?.filter(m => 
    m.homeAddress || (m.savedAddresses && m.savedAddresses.length > 0)
  ).length || 0;
  $: membersWithSelectedAddresses = $currentGroupMembers?.filter(m => m.selectedAddressId).length || 0;
  $: attendingWithAddresses = attendingMembers.length;
  
  // Auto-recalculate when attending members change
  // Create a signature to detect actual changes in attending members
  $: attendingMembersSignature = attendingMembers.map(m => 
    `${m.id}:${m.selectedAddress?.formatted || 'no-address'}`
  ).sort().join('|');
  
  // Track previous signature to prevent unnecessary recalculations
  let previousSignature = '';
  let hasInitialCalculation = false;
  
  $: if (!isCalculating && 
         (attendingMembersSignature !== previousSignature || !hasInitialCalculation)) {
    console.log('Attending members changed, triggering recalculation:', attendingMembersSignature);
    previousSignature = attendingMembersSignature;
    hasInitialCalculation = true;
    
    if (attendingMembers.length >= 2) {
      debouncedCalculateMeetingPoint();
    } else {
      // Clear meeting point if not enough attending members
      optimalPoint = null;
      routes = [];
      calculationError = getCalculationErrorMessage();
      lastCalculationTime = null;
    }
  }
  
  // Auto-update map markers
  $: mapMarkers = createMapMarkers(attendingMembers, optimalPoint);
  
  // Clear saved meeting point when there are insufficient attending members
  $: if (attendingMembers.length < 2 && $currentGroup?.meetingPoint) {
    clearSavedMeetingPoint();
  }
  
  let recalculationTimeout;
  
  onMount(async () => {
    if (!$user && !$authLoading) {
      goto('/auth/login?redirect=' + $page.url.pathname);
      return;
    }
    
    await initializeGroup();
  });
  
  onDestroy(() => {
    unsubscribeFromAttendance();
    if (recalculationTimeout) {
      clearTimeout(recalculationTimeout);
    }
  });
  
  async function initializeGroup() {
    try {
      // Load group data and subscribe to attendance
      await loadGroup(groupId);
      await loadGroupMembers(groupId);
      await subscribeToAttendance(groupId);
      
      // isAttending will be automatically set by reactive statement
      
      // Load user's address selection
      await loadUserGroupAddress();
      
      // Load existing meeting point
      if ($currentGroup?.meetingPoint) {
        optimalPoint = $currentGroup.meetingPoint;
        lastCalculationTime = $currentGroup.meetingPoint.calculatedAt;
        updateMapForMeetingPoint();
      }
      
      // Initial calculation
      await calculateMeetingPoint();
    } catch (error) {
      console.error('Error initializing group:', error);
    }
  }
  
  async function loadUserGroupAddress() {
    const currentMember = $currentGroupMembers?.find(m => m.id === $user?.uid);
    if (currentMember?.selectedAddressId) {
      selectedAddressId = currentMember.selectedAddressId;
    } else if ($addresses.length > 0) {
      const defaultAddr = $addresses.find(addr => addr.isDefault);
      if (defaultAddr) {
        selectedAddressId = defaultAddr.id;
        try {
          await setMyGroupAddress(groupId, defaultAddr.id);
        } catch (error) {
          console.error('Error auto-saving default address:', error);
        }
      }
    }
  }
  
  function getAttendingMembers(members, attendanceMap, currentUser, currentUserAddressId, currentUserAddresses) {
    if (!members || !attendanceMap || !currentUser) return [];
    
    const attending = [];
    
    // Add group members who are attending and have addresses
    members.forEach(member => {
      const memberAttendance = attendanceMap.get(member.id);
      if (memberAttendance?.isAttending && member.canUseAddressForMeetingPoint) {
        let memberAddress = null;
        
        // Get member's selected address
        if (member.selectedAddressId && member.savedAddresses) {
          memberAddress = member.savedAddresses.find(addr => addr.id === member.selectedAddressId);
        }
        
        // Fall back to home address
        if (!memberAddress && member.homeAddress) {
          memberAddress = member.homeAddress;
        }
        
        if (memberAddress) {
          attending.push({
            ...member,
            selectedAddress: {
              formatted: memberAddress.formatted,
              coordinates: memberAddress.coordinates
            }
          });
        }
      }
    });
    
    // Add current user if attending and has address (and not already included)
    const myAttendance = attendanceMap.get(currentUser.uid);
    if (myAttendance?.isAttending && currentUserAddressId && !attending.find(m => m.id === currentUser.uid)) {
      const myAddress = currentUserAddresses.find(addr => addr.id === currentUserAddressId);
      if (myAddress) {
        const currentUserMember = members.find(m => m.id === currentUser.uid);
        if (currentUserMember) {
          attending.push({
            ...currentUserMember,
            selectedAddress: {
              formatted: myAddress.formatted,
              coordinates: myAddress.coordinates
            }
          });
        }
      }
    }
    
    return attending;
  }
  
  function debouncedCalculateMeetingPoint() {
    if (recalculationTimeout) {
      clearTimeout(recalculationTimeout);
    }
    recalculationTimeout = setTimeout(calculateMeetingPoint, 1000);
  }
  
  async function calculateMeetingPoint() {
    if (attendingMembers.length < 2) {
      optimalPoint = null;
      routes = [];
      calculationError = getCalculationErrorMessage();
      return;
    }
    
    // No caching - always recalculate when called
    
    isCalculating = true;
    calculationError = null;
    calculationStep = 'analyzing';
    
    try {
      calculationStep = 'geocoding';
      const addresses = attendingMembers.map((member, index) => ({
        id: `member_${member.id}`,
        value: member.selectedAddress.formatted,
        coordinates: member.selectedAddress.coordinates
      }));
      
      calculationStep = 'routing';
      const result = await findOptimalMeetingPoint(addresses, { showVenues: false });
      
      calculationStep = 'optimizing';
      
      optimalPoint = result;
      routes = result.routes || [];
      lastCalculationTime = new Date();
      
      // Save to group (sanitize data for Firestore)
      try {
        const sanitizedMeetingPoint = {
          name: result.name,
          coordinates: result.coordinates,
          travelTimes: result.travelTimes,
          calculatedAt: lastCalculationTime,
          attendingMembersCount: attendingMembers.length
          // Note: We don't save routes or venues to avoid nested array issues
        };
        
        await saveMeetingPointForGroup(groupId, sanitizedMeetingPoint);
      } catch (saveError) {
        console.error('Error saving meeting point:', saveError);
      }
      
      updateMapForMeetingPoint();
      calculationStep = 'complete';
      
    } catch (err) {
      console.error('Error calculating meeting point:', err);
      calculationError = err.message || 'Failed to calculate meeting point. Please try again.';
    } finally {
      isCalculating = false;
    }
  }
  
  function updateMapForMeetingPoint() {
    if (optimalPoint?.coordinates) {
      mapCenter = optimalPoint.coordinates;
      mapZoom = 14;
    }
  }
  
  function getCalculationErrorMessage() {
    if (attendingMembers.length === 1) {
      return `Need at least 2 attending members with addresses. Currently ${attendingCount} attending, ${attendingWithAddresses} with addresses.`;
    } else if (attendingCount === 0) {
      return "No members are attending yet. Members need to confirm attendance to calculate meeting point.";
    } else if (membersWithAddresses < 2) {
      return `Need more members to add their addresses. ${membersWithAddresses} of ${$currentGroupMembers?.length || 0} members have addresses.`;
    } else {
      return "Attending members need to add their addresses to calculate meeting point.";
    }
  }
  
  function createMapMarkers(attendingMembers, meetingPoint) {
    const markers = [];
    
    // Add member markers
    attendingMembers.forEach((member, index) => {
      if (member.selectedAddress) {
        markers.push({
          position: member.selectedAddress.coordinates,
          title: member.displayName,
          type: 'location',
          number: index + 1
        });
      }
    });
    
    // Add meeting point marker
    if (meetingPoint?.coordinates) {
      markers.push({
        position: meetingPoint.coordinates,
        title: 'Meeting Point',
        type: 'meeting-point',
        info: `<div class="p-2">
          <h4 class="font-bold">Optimal Meeting Point</h4>
          <p class="text-sm">${meetingPoint.name || 'Central location'}</p>
          ${meetingPoint.travelTimes ? meetingPoint.travelTimes.map(tt => 
            `<p class="text-xs text-gray-600">${tt.address}: ${tt.duration} min</p>`
          ).join('') : ''}
        </div>`
      });
    }
    
    return markers;
  }
  
  async function handleAddressSelected(event) {
    const { addressId } = event.detail;
    selectedAddressId = addressId;
    
    try {
      await setMyGroupAddress(groupId, addressId);
      // Recalculation will happen automatically via reactive statement
    } catch (error) {
      console.error('Error saving address selection:', error);
    }
  }
  
  async function handleAttendanceConfirm() {
    const newStatus = !isAttending;
    
    let location = null;
    if (selectedAddressId) {
      const address = $addresses.find(addr => addr.id === selectedAddressId);
      if (address) {
        location = address.coordinates;
      }
    }
    
    const success = await updateMyAttendance(groupId, newStatus, location);
    // isAttending will be automatically updated by reactive statement
    // Recalculation will happen automatically via reactive statement
  }
  
  async function handleResetAttendance() {
    if (!isAdmin) return;
    
    isResettingAttendance = true;
    try {
      await resetAttendance(groupId);
      // isAttending and meeting point will be automatically updated by reactive statements
    } catch (error) {
      console.error('Error resetting attendance:', error);
    } finally {
      isResettingAttendance = false;
    }
  }
  
  function forceRecalculation() {
    calculateMeetingPoint();
  }
  
  async function fixMissingDefaultAddresses() {
    const success = await fixGroupMemberAddresses(groupId);
    if (success) {
      setTimeout(() => calculateMeetingPoint(), 1000);
    }
  }
  
  async function clearSavedMeetingPoint() {
    try {
      // Clear the meeting point by updating the group document
      const auth = get(authStore);
      if (!auth.user) return;
      
      const db = getFirestore();
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        meetingPoint: null,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error clearing saved meeting point:', error);
    }
  }
  
  function getUserAvatar(member) {
    if (member.photoURL) {
      return `<img src="${member.photoURL}" alt="${member.displayName}" class="w-full h-full object-cover" />`;
    }
    return `<div class="w-full h-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-sm">
      ${member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
    </div>`;
  }
  
  function isMemberAttending(memberId) {
    const memberAttendance = $attendance.get(memberId);
    return memberAttendance?.isAttending || false;
  }
  
  function toggleInviteSection() {
    showInviteSection = !showInviteSection;
  }
  
  // Placeholder functions for invite functionality
  async function handleInviteFriends(event) {
    console.log('Invite friends:', event.detail);
  }
  
  async function handleInviteByPhone(event) {
    console.log('Invite by phone:', event.detail);
  }
</script>

<svelte:head>
  <title>{$currentGroup?.name || 'Group'} | Voilà!</title>
</svelte:head>

<main class="min-h-screen bg-gray-50">
  {#if $isLoading}
    <div class="flex justify-center items-center h-screen">
      <LoadingSpinner size="lg" text="Loading group..." />
    </div>
  {:else if $error}
    <div class="p-4">
      <div class="bg-red-50 border-l-4 border-red-400 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-red-700">{$error}</p>
          </div>
        </div>
      </div>
    </div>
  {:else if $currentGroup}
    <!-- Header -->
    <header class="bg-white shadow-sm sticky top-0 z-10">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center">
            <a href="/groups" class="mr-4 text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 class="text-xl font-semibold text-gray-900">{$currentGroup.name}</h1>
          </div>
          <div class="flex items-center space-x-2">
            <button
              on:click={toggleInviteSection}
              class="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Add members"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
            <button
              on:click={() => goto(`/groups/${groupId}/settings`)}
              class="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
    
    <!-- Add Members Section -->
    {#if showInviteSection}
      <div class="bg-white border-b border-gray-200">
        <div class="px-4 sm:px-6 lg:px-8 py-4">
          <GroupInvite
            {isInviting}
            on:invite-friends={handleInviteFriends}
            on:invite-by-phone={handleInviteByPhone}
          />
        </div>
      </div>
    {/if}
    
    
    
    <!-- Meeting Point Status -->
    <div class="px-4 sm:px-6 lg:px-8 pb-4 pt-4">
      <!-- Requirements Info -->
      {#if !isCalculating && !optimalPoint && $currentGroupMembers && $currentGroupMembers.length > 0}
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-blue-900 mb-2">Meeting Point Requirements</h3>
          <div class="space-y-1 text-sm text-blue-700">
            <div class="flex items-center justify-between">
              <span>Members attending:</span>
              <span class="font-medium">{attendingCount} / {$currentGroupMembers.length}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Members with addresses:</span>
              <span class="font-medium">{membersWithAddresses} / {$currentGroupMembers.length}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Members with selected addresses:</span>
              <span class="font-medium {membersWithSelectedAddresses === $currentGroupMembers.length ? 'text-green-600' : 'text-orange-600'}">{membersWithSelectedAddresses} / {$currentGroupMembers.length}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Attending with addresses:</span>
              <span class="font-medium {attendingWithAddresses >= 2 ? 'text-green-600' : 'text-orange-600'}">{attendingWithAddresses} / 2 minimum</span>
            </div>
          </div>
          {#if attendingWithAddresses >= 2}
            <p class="text-xs text-green-700 mt-2">✅ Ready to calculate meeting point!</p>
          {:else if membersWithSelectedAddresses < $currentGroupMembers.length}
            <p class="text-xs text-orange-600 mt-2">⚠️ Some members need to select their address for the group.</p>
          {:else if attendingCount < 2}
            <p class="text-xs text-blue-600 mt-2">📋 Need at least 2 members to confirm attendance.</p>
          {:else}
            <p class="text-xs text-blue-600 mt-2">Need at least 2 attending members with addresses.</p>
          {/if}
        </div>
      {/if}
      
      <!-- Meeting Point Results -->
      {#if isCalculating}
        <MeetingPointProgress 
          {isCalculating}
          attendingMembersCount={attendingMembers.length}
          currentStep={calculationStep}
        />
      {:else if calculationError}
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div class="flex items-start">
            <svg class="h-5 w-5 text-yellow-400 mr-3 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <div class="flex-1">
              <p class="text-yellow-800 font-medium">Cannot calculate meeting point</p>
              <p class="text-yellow-700 text-sm">{calculationError}</p>
              {#if attendingWithAddresses >= 2}
                <button 
                  on:click={forceRecalculation}
                  class="mt-2 text-sm text-yellow-800 hover:text-yellow-900 underline"
                >
                  Try again
                </button>
              {/if}
            </div>
          </div>
        </div>
      {:else if optimalPoint}
        <div class="space-y-4">
          <MeetingPointResults 
            meetingPoint={optimalPoint}
            meetingPoints={[optimalPoint].filter(Boolean)}
            currentMeetingPointIndex={0}
            venues={[]}
            routes={routes}
            showVenues={false}
            isCalculating={false}
            isMobile={false}
          />
          
          <!-- Meeting Point Actions -->
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="flex items-center justify-between text-sm">
              <div class="flex space-x-2">
                <button
                  on:click={forceRecalculation}
                  disabled={isCalculating}
                  class="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  🔄 Recalculate
                </button>
                {#if isAdmin}
                  <button
                    on:click={fixMissingDefaultAddresses}
                    class="text-orange-600 hover:text-orange-700 text-xs"
                  >
                    🔧 Fix Addresses
                  </button>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Map Section -->
    <div class="bg-white shadow-sm">
      <MapProvider>
        <div slot="loading" class="h-[400px] flex items-center justify-center">
          <div class="text-center">
            <div class="loader mx-auto mb-4"></div>
            <p class="text-neutral-600">Loading map...</p>
          </div>
        </div>
        
        <div slot="error" let:error class="h-[400px] flex items-center justify-center text-error">
          <div class="text-center">
            <p class="text-lg mb-2">{error}</p>
            <p>Please refresh the page to try again.</p>
          </div>
        </div>
        
        <div class="h-[400px] relative">
          <MapContainer 
            center={mapCenter}
            zoom={mapZoom}
            markers={mapMarkers}
            routes={routes}
            height="100%"
          />
          
          {#if isCalculating}
            <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <LoadingSpinner size="md" text="Calculating optimal meeting point..." />
            </div>
          {/if}
        </div>
      </MapProvider>
    </div>

    <!-- Attendance Slider -->
    <div class="bg-white shadow-sm p-4">
      <div class="max-w-md mx-auto">
        <SlideToConfirm
          text={isAttending ? "slide to cancel" : "slide to confirm attendance"}
          confirmText={isAttending ? "cancelled!" : "you're attending!"}
          disabled={!selectedAddressId}
          on:confirm={handleAttendanceConfirm}
        />
        
        {#if !selectedAddressId}
          <p class="text-xs text-red-600 text-center mt-2">
            Please select your address above to confirm attendance
          </p>
        {/if}
      </div>
    </div>
    
    <!-- Admin Controls -->
    {#if isAdmin}
      <div class="bg-white shadow-sm border-t border-gray-200 p-4">
        <div class="max-w-md mx-auto">
          <button
            on:click={handleResetAttendance}
            disabled={isResettingAttendance}
            class="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {#if isResettingAttendance}
              <LoadingSpinner size="sm" color="gray" />
              <span class="ml-2">Resetting...</span>
            {:else}
              🔄 Reset All Attendance (Admin)
            {/if}
          </button>
        </div>
      </div>
    {/if}
    
    <!-- Address Selection -->
    <div class="px-4 sm:px-6 lg:px-8 py-4">
      <AddressSelection
        currentGroupId={groupId}
        bind:selectedAddressId
        on:address-selected={handleAddressSelected}
      />
    </div>

    <!-- Members List -->
    <div class="bg-white shadow-sm mt-2">
      <div class="px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-medium text-gray-900">Group Members</h2>
          <div class="text-sm text-gray-500">
            {attendingWithAddresses} attending
          </div>
        </div>
        
        <div class="space-y-3">
          {#each $currentGroupMembers as member (member.id)}
            <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <div class="flex items-center">
                <div class="w-10 h-10 rounded-full overflow-hidden mr-3">
                  {@html getUserAvatar(member)}
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">
                    {member.displayName}
                    {#if member.id === $user?.uid}
                      <span class="text-xs text-gray-500 ml-1">(You)</span>
                    {/if}
                  </p>
                  {#if member.isCreator}
                    <p class="text-xs text-primary-600">Owner</p>
                  {:else if member.isAdmin}
                    <p class="text-xs text-primary-600">Admin</p>
                  {/if}
                  {#if member.canUseAddressForMeetingPoint}
                    <p class="text-xs text-gray-500">📍 Address available for meeting point</p>
                  {:else if member.selectedAddressId || member.homeAddress}
                    <p class="text-xs text-gray-400">📍 Address available (not attending)</p>
                  {:else}
                    <p class="text-xs text-gray-400">No address available</p>
                  {/if}
                </div>
              </div>
              
              <div class="flex items-center">
                {#if isMemberAttending(member.id)}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    Attending
                  </span>
                {:else}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Not attending
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  .loader {
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>