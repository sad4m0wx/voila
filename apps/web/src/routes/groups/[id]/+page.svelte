<script>
  import { onMount, onDestroy, getContext } from "svelte";
  import { get } from "svelte/store";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getFirestore, doc, updateDoc, serverTimestamp } from "firebase/firestore";
  import SlideToConfirm from "$components/utils/SlideToConfirm.svelte";
  import LoadingIndicator from "$components/utils/LoadingIndicator.svelte";
  import BottomSheet from "$components/utils/BottomSheet.svelte";
  import MapProvider from '$components/maps/MapProvider.svelte';
  import MapContainer from '$components/maps/MapContainer.svelte';
  import AddressSelection from '$components/groups/AddressSelection.svelte';
  import GroupInvite from '$components/groups/GroupInvite.svelte';
  import MeetingPointDisplay from '$components/meeting/MeetingPointDisplay.svelte';
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
  let showMembersSheet = false;
  let showInviteSheet = false;
  let showAddressSheet = false;
  let isInviting = false;
  let isResettingAttendance = false;
  
  // Meeting point state
  let optimalPoint = null;
  let isCalculating = false;
  let calculationError = null;
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
  $: attendingWithAddresses = attendingMembers.length;
  
  // Auto-recalculate when attending members change
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
      await loadGroup(groupId);
      await loadGroupMembers(groupId);
      await subscribeToAttendance(groupId);
      await loadUserGroupAddress();
      
      if ($currentGroup?.meetingPoint) {
        optimalPoint = $currentGroup.meetingPoint;
        updateMapForMeetingPoint();
      }
      
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
        
        if (member.selectedAddressId && member.savedAddresses) {
          memberAddress = member.savedAddresses.find(addr => addr.id === member.selectedAddressId);
        }
        
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
      
      try {
        const sanitizedMeetingPoint = {
          name: result.name,
          coordinates: result.coordinates,
          travelTimes: result.travelTimes,
          calculatedAt: new Date(),
          attendingMembersCount: attendingMembers.length
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
      showAddressSheet = false;

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
    if (success) {

    }
  }
  
  async function handleResetAttendance() {
    if (!isAdmin) return;
    
    isResettingAttendance = true;

    try {
      await resetAttendance(groupId);
    } catch (error) {
      console.error('Error resetting attendance:', error);
    } finally {
      isResettingAttendance = false;
    }
  }
  
  function forceRecalculation() {
    calculateMeetingPoint();
  }
  
  async function clearSavedMeetingPoint() {
    try {
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
  
  function isMemberAttending(memberId) {
    const memberAttendance = $attendance.get(memberId);
    return memberAttendance?.isAttending || false;
  }
  
  function showMembers() {
    showMembersSheet = true;
  }
  
  function showInvite() {
    showInviteSheet = true;
  }
  
  function showAddressSelection() {
    showAddressSheet = true;
  }
  
  async function handleInviteFriends(event) {
    console.log('Invite friends:', event.detail);
    showInviteSheet = false;
  }
  
  async function handleInviteByPhone(event) {
    console.log('Invite by phone:', event.detail);
    showInviteSheet = false;
  }
</script>

<svelte:head>
  <title>{$currentGroup?.name || 'Group'} | Voilà!</title>
</svelte:head>

{#if $isLoading}
  <div class="min-h-screen bg-neutral-50 flex items-center justify-center">
    <LoadingIndicator size="lg" text="Loading group..." />
  </div>
{:else if $error}
  <div class="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
    <div class="mobile-card bg-error-50 text-center max-w-sm w-full">
      <div class="text-error-600 mb-4">
        <svg class="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-error-900 mb-2">Error Loading Group</h3>
      <p class="text-sm text-error-700 mb-4">{$error}</p>
      <button 
        on:click={() => window.location.reload()} 
        class="mobile-button-primary"
      >
        Try Again
      </button>
    </div>
  </div>
{:else if $currentGroup}
  <!-- Map Section -->
  <div class="relative h-[50vh] min-h-[300px]">
    <MapProvider>
      <div slot="loading" class="h-full flex items-center justify-center">
        <div class="text-center">
          <LoadingIndicator size="md" text="Loading map..." />
        </div>
      </div>
      
      <div slot="error" let:error class="h-full flex items-center justify-center">
        <div class="text-center p-4">
          <svg class="h-12 w-12 mx-auto mb-4 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm text-error-600">{error}</p>
        </div>
      </div>
      
      <MapContainer 
        center={mapCenter}
        zoom={mapZoom}
        markers={mapMarkers}
        routes={routes}
        height="100%"
      />
      
      <!-- Floating Header -->
      <div class="absolute top-0 left-0 right-0 z-10 p-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <!-- Unified Header Card -->
        <div class="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
          <!-- Top Row: Back Button, Title, Actions -->
          <div class="flex items-center justify-between mb-3">
            <button 
              on:click={() => { goto('/groups'); }}
              class="mobile-icon-button-small"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <h1 class="text-xl font-bold text-neutral-900 flex-1 text-center mx-4">{$currentGroup.name}</h1>
            
            <div class="flex items-center space-x-1">
              <button 
                on:click={()=>{goto(`/groups/${groupId}/settings`);}}
                class="mobile-icon-button-small"
                title="Invite members"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </button>
              <button 
                on:click={() => {  }}
                class="mobile-icon-button-small"
                title="Group settings"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Bottom Row: Member Info and View All Button -->
          <div class="flex items-center justify-between">
            <div class="flex items-center text-sm text-neutral-600">
              <span class="mr-4">{$currentGroupMembers?.length || 0} members</span>
              <span>{attendingCount} attending</span>
            </div>

          </div>
        </div>
      </div>
      
      <!-- Calculation Overlay -->
      {#if isCalculating}
        <div class="absolute inset-0 bg-black/20 flex items-center justify-center z-20">
          <div class="bg-white rounded-2xl shadow-2xl p-6 max-w-xs mx-4">
            <div class="text-center">
              <LoadingIndicator size="md" />
              <p class="text-sm font-medium text-neutral-900 mt-3 mb-1">Finding optimal meeting point</p>
              <p class="text-xs text-neutral-600">
                {#if calculationStep === 'analyzing'}
                  Analyzing member locations...
                {:else if calculationStep === 'geocoding'}
                  Processing addresses...
                {:else if calculationStep === 'routing'}
                  Calculating routes...
                {:else if calculationStep === 'optimizing'}
                  Finding best location...
                {:else}
                  Almost done...
                {/if}
              </p>
            </div>
          </div>
        </div>
      {/if}
    </MapProvider>
  </div>
  
  <!-- Attendance Section - Right Under Map -->
  <div class="bg-white border-b border-neutral-200 p-4">
    <div class="mb-4">
      <h3 class="font-semibold text-neutral-900 mb-2">Confirm Your Attendance</h3>
      <div class="flex items-center text-sm text-neutral-600 mb-3">
        <div class="flex items-center mr-4">
          <div class="w-2 h-2 bg-success-500 rounded-full mr-2"></div>
          <span>{attendingCount} attending</span>
        </div>
        <div class="flex items-center">
          <div class="w-2 h-2 bg-neutral-300 rounded-full mr-2"></div>
          <span>{($currentGroupMembers?.length || 0) - attendingCount} not attending</span>
        </div>
      </div>
    </div>
    
    <SlideToConfirm
      text={isAttending ? "slide to cancel" : "slide to confirm attendance"}
      confirmText={isAttending ? "cancelled!" : "you're attending!"}
      disabled={!selectedAddressId}
      confirmed={isAttending}
      on:confirm={handleAttendanceConfirm}
      class="mb-3"
    />
    
    {#if !selectedAddressId}
      <div class="flex items-center text-sm text-warning-700 bg-warning-50 rounded-lg p-3">
        <svg class="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>Please select your address to confirm attendance</span>
      </div>
    {/if}
  </div>

  <!-- Content Section -->
  <div class="flex-1 bg-neutral-50">
    <!-- Meeting Point Results -->
    {#if optimalPoint}
      <div class="p-4">
        <MeetingPointDisplay 
          meetingPoint={optimalPoint}
          meetingPoints={[optimalPoint]}
          currentMeetingPointIndex={0}
          venues={[]}
          routes={routes}
          isCalculating={false}
          variant="card"
          on:recalculate={forceRecalculation}
        />
      </div>
    {:else if calculationError}
      <div class="p-4">
        <div class="mobile-card bg-warning-50">
          <div class="flex items-start">
            <div class="w-10 h-10 bg-warning-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
              <svg class="h-6 w-6 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-warning-900 mb-1">Waiting for more members</h3>
              <p class="text-sm text-warning-700">{calculationError}</p>
            </div>
          </div>
        </div>
      </div>
    {:else if attendingCount === 0}
      <div class="p-4">
        <div class="mobile-card bg-info-50 text-center">
          <div class="w-16 h-16 bg-info-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="h-8 w-8 text-info-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 class="font-semibold text-info-900 mb-2">Ready to Plan?</h3>
          <p class="text-sm text-info-700">Once members confirm attendance, we'll find the perfect meeting spot!</p>
        </div>
      </div>
    {/if}

    <!-- Members List -->
    <div class="p-4">
      <div class="mobile-card overflow-hidden">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-neutral-900">Group Members</h3>
          <span class="text-sm text-neutral-600 flex-shrink-0">{attendingCount} of {$currentGroupMembers?.length || 0} attending</span>
        </div>
        
        <div class="space-y-3">
          {#each ($currentGroupMembers || []).slice(0, 4) as member (member.id)}
            <div class="flex items-center justify-between min-w-0">
              <div class="flex items-center min-w-0 flex-1 mr-3">
                <div class="mobile-avatar mr-3 flex-shrink-0">
                  {#if member.photoURL}
                    <img src={member.photoURL} alt={member.displayName} class="w-full h-full object-cover rounded-full" />
                  {:else}
                    <div class="w-full h-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold rounded-full text-sm">
                      {member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
                    </div>
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-neutral-900 truncate">
                    {member.displayName}
                    {#if member.id === $user?.uid}
                      <span class="text-sm text-neutral-500 ml-1">(You)</span>
                    {/if}
                  </p>
                  <p class="text-xs text-neutral-600 truncate">
                    {#if member.canUseAddressForMeetingPoint}
                      📍 Address set for meeting point
                    {:else if member.selectedAddressId || member.homeAddress}
                      📍 Address available
                    {:else}
                      No address available
                    {/if}
                  </p>
                </div>
              </div>
              
              <div class="flex-shrink-0">
                {#if isMemberAttending(member.id)}
                  <div class="mobile-badge-success">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    Attending
                  </div>
                {:else}
                  <div class="mobile-badge-neutral">
                    Not attending
                  </div>
                {/if}
              </div>
            </div>
          {/each}
          
          {#if ($currentGroupMembers?.length || 0) > 4}
            <div class="pt-2 border-t border-neutral-100">
              <button 
                on:click={showMembers}
                class="w-full text-center text-sm text-primary-600 font-medium hover:text-primary-700 py-2 rounded-lg hover:bg-primary-50 transition-colors"
              >
                View {($currentGroupMembers?.length || 0) - 4} more members →
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Quick Action: Address Selection -->
    <div class="p-4">
      <button 
        on:click={showAddressSelection}
        class="mobile-card-button text-left w-full"
      >
        <div class="flex items-center">
          <div class="w-10 h-10 bg-secondary-100 rounded-full flex items-center justify-center mr-3">
            <svg class="h-6 w-6 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-neutral-900">Your Address</p>
            <p class="text-sm text-neutral-600">
              {selectedAddressId ? 'Address selected for group' : 'Choose your address for this group'}
            </p>
          </div>
        </div>
      </button>
    </div>
    
    <!-- Admin Controls -->
    {#if isAdmin}
      <div class="p-4">
        <div class="mobile-card bg-neutral-50">
          <h3 class="font-semibold text-neutral-900 mb-3">Admin Controls</h3>
          <button
            on:click={handleResetAttendance}
            disabled={isResettingAttendance}
            class="mobile-button-secondary w-full disabled:opacity-50"
          >
            {#if isResettingAttendance}
              <LoadingIndicator size="sm" color="gray" />
              <span class="ml-2">Resetting...</span>
            {:else}
              <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset All Attendance
            {/if}
          </button>
        </div>
      </div>
    {/if}
    
    <!-- Safe area padding -->
    <div class="pb-[env(safe-area-inset-bottom)]"></div>
  </div>
{/if}

<!-- Members Bottom Sheet -->
<BottomSheet bind:isOpen={showMembersSheet} title="Group Members" snapPoints={[0.6, 0.9]}>
  <div class="p-4 space-y-3">
    {#each $currentGroupMembers || [] as member (member.id)}
      <div class="mobile-list-item">
        <div class="flex items-center flex-1">
          <div class="mobile-avatar mr-3">
            {#if member.photoURL}
              <img src={member.photoURL} alt={member.displayName} class="w-full h-full object-cover rounded-full" />
            {:else}
              <div class="w-full h-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold rounded-full">
                {member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
              </div>
            {/if}
          </div>
          <div class="flex-1">
            <div class="flex items-center">
              <p class="font-medium text-neutral-900">
                {member.displayName}
                {#if member.id === $user?.uid}
                  <span class="text-sm text-neutral-500 ml-1">(You)</span>
                {/if}
              </p>
              {#if member.isCreator || member.isAdmin}
                <span class="ml-2 px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full font-medium">
                  {member.isCreator ? 'Owner' : 'Admin'}
                </span>
              {/if}
            </div>
            <p class="text-sm text-neutral-600">
              {#if member.canUseAddressForMeetingPoint}
                📍 Address set for meeting point
              {:else if member.selectedAddressId || member.homeAddress}
                📍 Address available
              {:else}
                No address available
              {/if}
            </p>
          </div>
        </div>
        
        <div class="ml-4">
          {#if isMemberAttending(member.id)}
            <div class="mobile-badge-success">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              Attending
            </div>
          {:else}
            <div class="mobile-badge-neutral">
              Not attending
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</BottomSheet>

<!-- Invite Bottom Sheet -->
<BottomSheet bind:isOpen={showInviteSheet} title="Invite Members" snapPoints={[0.5, 0.8]}>
  <div class="p-4">
    <GroupInvite
      {isInviting}
      on:invite-friends={handleInviteFriends}
      on:invite-by-phone={handleInviteByPhone}
    />
  </div>
</BottomSheet>

<!-- Address Selection Bottom Sheet -->
<BottomSheet bind:isOpen={showAddressSheet} title="Select Your Address" snapPoints={[0.6, 0.9]}>
  <div class="p-4">
    <AddressSelection
      currentGroupId={groupId}
      bind:selectedAddressId
      on:address-selected={handleAddressSelected}
    />
  </div>
</BottomSheet>