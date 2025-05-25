
<script>
  import { onMount, onDestroy, getContext } from "svelte";
  import { get } from "svelte/store";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import SlideToConfirm from "$lib/components/SlideToConfirm.svelte";
  import { MapProvider, MapContainer } from '$map';
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
    unsubscribeFromAttendance
  } from '$stores/groups';
  import { findOptimalMeetingPoint } from "$lib/services/meetingPointApi";
  
  const { user, profile, isLoading: authLoading } = getContext('auth');

  // State
  let isAttending = false;
  let showSettings = false;
  let mapCenter = defaultMapCenter;
  let mapZoom = defaultMapZoom;
  let mapMarkers = [];
  let routes = [];
  let optimalPoint = null;
  let isCalculating = false;
  
  // Get group ID from URL
  const groupId = $page.params.id;
  
  onMount(async () => {
    if (!$user && !$authLoading) {
      goto('/auth/login?redirect=' + $page.url.pathname);
      return;
    }
    
    // Load group data and subscribe to attendance
    await loadGroup(groupId);
    await loadGroupMembers(groupId);
    await subscribeToAttendance(groupId);
    
    // Check if user is already attending
    const myAttendance = $attendance.get($user?.uid);
    if (myAttendance) {
      isAttending = myAttendance.isAttending;
    }
    
    // Calculate optimal meeting point if members are attending
    calculateMeetingPoint();
  });
  
  onDestroy(() => {
    unsubscribeFromAttendance();
  });
  
  // Calculate optimal meeting point based on attending members
  async function calculateMeetingPoint() {
    if (!$currentGroupMembers || $currentGroupMembers.length === 0) return;
    
        const currentMembers = get(currentGroupMembers);
    const attendanceMap = get(attendance);
    const attendingMembers = currentMembers.filter(member => {
      const memberAttendance = attendanceMap.get(member.id);
      return memberAttendance?.isAttending && member.homeAddress;
    });
    
    if (attendingMembers.length < 2) {
      // Not enough attending members with addresses
      mapMarkers = createMemberMarkers();
      return;
    }
    
    isCalculating = true;
    
    try {
      // Create address list from attending members
      const addresses = attendingMembers.map((member, index) => ({
        id: index + 1,
        value: member.homeAddress.formatted || member.homeAddress.address,
        coordinates: member.homeAddress.coordinates
      }));
      
      // Calculate optimal meeting point
      const result = await findOptimalMeetingPoint(addresses, {
        showVenues: false
      });
      
      optimalPoint = result;
      routes = result.routes || [];
      
      // Update map center to optimal point
      if (result.coordinates) {
        mapCenter = result.coordinates;
      }
      
      // Create markers for map
      mapMarkers = createMapMarkers(attendingMembers, result);
      
    } catch (err) {
      console.error('Error calculating meeting point:', err);
    } finally {
      isCalculating = false;
    }
  }
  
  // Create map markers for members only
  function createMemberMarkers() {
    const markers = [];
    
    $currentGroupMembers.forEach(member => {
      const memberAttendance = get(attendance).get(member.id);
      if (member.homeAddress && memberAttendance?.isAttending) {
        markers.push({
          position: member.homeAddress.coordinates,
          title: member.displayName,
          type: 'member',
          info: `<div class="p-2">
            <h4 class="font-bold">${member.displayName}</h4>
            <p class="text-sm text-green-600">Attending</p>
          </div>`
        });
      }
    });
    
    return markers;
  }
  
  // Create map markers including optimal point
  function createMapMarkers(attendingMembers, meetingPoint) {
    const markers = [];
    
    // Add member markers
    attendingMembers.forEach(member => {
      if (member.homeAddress) {
        markers.push({
          position: member.homeAddress.coordinates,
          title: member.displayName,
          type: 'location',
          number: member.displayName.charAt(0).toUpperCase()
        });
      }
    });
    
    // Add meeting point marker
    if (meetingPoint && meetingPoint.coordinates) {
      markers.push({
        position: meetingPoint.coordinates,
        title: 'Meeting Point',
        type: 'meeting-point',
        info: `<div class="p-2">
          <h4 class="font-bold">Optimal Meeting Point</h4>
          <p class="text-sm">${meetingPoint.name || 'Central location'}</p>
        </div>`
      });
    }
    
    return markers;
  }
  
  // Handle attendance confirmation
  async function handleAttendanceConfirm() {
    const newStatus = !isAttending;
    
    // Get user's home address for location
    const location = $profile?.homeAddress?.coordinates || null;
    
    const success = await updateMyAttendance(groupId, newStatus, location);
    
    if (success) {
      isAttending = newStatus;
      
      // Recalculate meeting point when attendance changes
      setTimeout(() => {
        calculateMeetingPoint();
      }, 500);
    }
  }
  
  // Watch for attendance changes
  $: if ($attendance.size > 0) {
    calculateMeetingPoint();
  }
  
  // Get user avatar or initial
  function getUserAvatar(member) {
    if (member.photoURL) {
      return `<img src="${member.photoURL}" alt="${member.displayName}" class="w-full h-full object-cover" />`;
    }
    return `<div class="w-full h-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-sm">
      ${member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
    </div>`;
  }
  
  // Check if member is attending
  function isMemberAttending(memberId) {
    const memberAttendance = $attendance.get(memberId);
    return memberAttendance?.isAttending || false;
  }
</script>

<svelte:head>
  <title>{$currentGroup?.name || 'Group'} | Voilà!</title>
</svelte:head>

<main class="min-h-screen bg-gray-50">
  {#if $isLoading}
    <div class="flex justify-center items-center h-screen">
      <svg class="animate-spin h-10 w-10 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
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
    </header>
    
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
            zoomToFitMarkers={true}
            height="100%"
          />
          
          {#if isCalculating}
            <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div class="text-center">
                <svg class="animate-spin h-8 w-8 text-primary-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm text-gray-600">Calculating optimal meeting point...</p>
              </div>
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
          on:confirm={handleAttendanceConfirm}
        />
      </div>
    </div>
    
    <!-- Members List -->
    <div class="bg-white shadow-sm mt-2">
      <div class="px-4 sm:px-6 lg:px-8 py-4">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Group Members</h2>
        
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
        
        {#if optimalPoint && Object.keys($attendance).length >= 2}
          <div class="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 class="text-sm font-medium text-blue-900 mb-2">Meeting Point Information</h3>
            <p class="text-sm text-blue-700">
              {optimalPoint.name || 'Optimal meeting point'} has been calculated based on attending members' locations.
            </p>
            {#if optimalPoint.travelTimes && optimalPoint.travelTimes.length > 0}
              <div class="mt-3 space-y-1">
                {#each optimalPoint.travelTimes as time}
                  <p class="text-xs text-blue-600">
                    • {time.address}: {time.duration} min
                  </p>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
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