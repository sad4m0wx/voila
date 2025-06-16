<script>
    import { createEventDispatcher, tick, onMount } from "svelte";
    import VenueList from "$components/venues/VenueList.svelte";
    import RouteDetails from "./RouteDetails.svelte";

    const dispatch = createEventDispatcher();

    export let meetingPoint = null;
    export let meetingPoints = []; // Array of all meeting points
    export let currentMeetingPointIndex = 0; // Current selected index
    export let venues = [];
    export let routes = [];
    export let isCalculating = false;
    export let isMobile = false;
    
    let showRouteDetails = false;
    let routeDetailsElement;
    let carouselContainer;
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let translateX = 0;
    let initialTranslateX = 0;

    // Reactive variables
    $: hasMultipleMeetingPoints = meetingPoints && meetingPoints.length > 1;
    $: canNavigatePrev = hasMultipleMeetingPoints; // Always true if multiple points
    $: canNavigateNext = hasMultipleMeetingPoints; // Always true if multiple points

    function handleVenueSelected(event) {
        dispatch("venue-selected", event.detail);
    }

    function toggleResults() {
        dispatch("toggle-results");
    }

    function navigateToPrevious() {
        if (canNavigatePrev) {
            const newIndex = currentMeetingPointIndex === 0 
                ? meetingPoints.length - 1 
                : currentMeetingPointIndex - 1;
            dispatch("meeting-point-change", { index: newIndex });
        }
    }

    function navigateToNext() {
        if (canNavigateNext) {
            const newIndex = currentMeetingPointIndex === meetingPoints.length - 1 
                ? 0 
                : currentMeetingPointIndex + 1;
            dispatch("meeting-point-change", { index: newIndex });
        }
    }

    function navigateToIndex(index) {
        if (index >= 0 && index < meetingPoints.length) {
            dispatch("meeting-point-change", { index });
        }
    }

    // Touch/Mouse event handlers for swipe navigation
    function handleStart(event) {
        if (!hasMultipleMeetingPoints || !isMobile) return;
        
        isDragging = true;
        startX = event.type === 'mousedown' ? event.clientX : event.touches[0].clientX;
        currentX = startX;
        initialTranslateX = translateX;
        
        if (carouselContainer) {
            carouselContainer.style.transition = 'none';
        }
    }

    function handleMove(event) {
        if (!isDragging || !hasMultipleMeetingPoints || !isMobile) return;
        
        event.preventDefault();
        currentX = event.type === 'mousemove' ? event.clientX : event.touches[0].clientX;
        const deltaX = currentX - startX;
        translateX = initialTranslateX + deltaX;
        
        if (carouselContainer) {
            carouselContainer.style.transform = `translateX(${translateX}px)`;
        }
    }

    function handleEnd() {
        if (!isDragging || !hasMultipleMeetingPoints || !isMobile) return;
        
        isDragging = false;
        const deltaX = currentX - startX;
        const threshold = 50; // Minimum swipe distance
        
        if (carouselContainer) {
            carouselContainer.style.transition = 'transform 0.3s ease-out';
        }
        
        if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0) {
                navigateToPrevious();
            } else if (deltaX < 0) {
                navigateToNext();
            }
        }
        
        // Reset transform
        translateX = 0;
        if (carouselContainer) {
            carouselContainer.style.transform = 'translateX(0)';
        }
    }

    // Keyboard navigation
    function handleKeydown(event) {
        if (!hasMultipleMeetingPoints) return;
        
        if (event.key === 'ArrowLeft') {
            navigateToPrevious();
        } else if (event.key === 'ArrowRight') {
            navigateToNext();
        }
    }

    // Helper function to format coordinates for Google Maps
    function getGoogleMapsUrl(coordinates) {
        return `https://www.google.com/maps/search/?api=1&query=${coordinates[1]},${coordinates[0]}`;
    }

    // Helper function to get travel time color
    function getTravelTimeColor(duration) {
        const minutes = parseInt(duration);
        if (minutes <= 10) return 'text-success-600 bg-success-50';
        if (minutes <= 20) return 'text-warning-600 bg-warning-50';
        return 'text-error-600 bg-error-50';
    }

    // Auto-scroll to detailed routes when opened
    $: if (showRouteDetails && routeDetailsElement) {
        tick().then(() => {
            routeDetailsElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
        });
    }

    onMount(() => {
        // Add keyboard event listener
        window.addEventListener('keydown', handleKeydown);
        
        return () => {
            window.removeEventListener('keydown', handleKeydown);
        };
    });
</script>

<svelte:window 
    on:mousemove={handleMove}
    on:mouseup={handleEnd}
    on:touchmove={handleMove}
    on:touchend={handleEnd}
/>

{#if meetingPoint}
    <div class="relative">
        <!-- Navigation Header (only show if multiple meeting points) -->
        {#if hasMultipleMeetingPoints}
            <div class="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200/50">
                <div class="flex items-center">
                    <span class="text-sm font-semibold text-blue-800 mr-2">Meeting Options</span>
                    <div class="flex items-center space-x-1">
                        {#each meetingPoints as _, index}
                            <button
                                class="w-2 h-2 rounded-full transition-colors {index === currentMeetingPointIndex ? 'bg-blue-500' : 'bg-blue-200 hover:bg-blue-300'}"
                                on:click={() => navigateToIndex(index)}
                                aria-label="Go to meeting point {index + 1}"
                            ></button>
                        {/each}
                    </div>
                </div>
                
                <!-- Desktop Navigation Arrows -->
                {#if !isMobile}
                    <div class="flex items-center space-x-2">
                        <button
                            class="w-8 h-8 rounded-full bg-white border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            on:click={navigateToPrevious}
                            disabled={!canNavigatePrev}
                            aria-label="Previous meeting point"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>
                        </button>
                        <span class="text-xs text-blue-600 font-medium">
                            {currentMeetingPointIndex + 1} of {meetingPoints.length}
                        </span>
                        <button
                            class="w-8 h-8 rounded-full bg-white border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            on:click={navigateToNext}
                            disabled={!canNavigateNext}
                            aria-label="Next meeting point"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </button>
                    </div>
                {:else}
                    <!-- Mobile swipe arrows -->
                    <div class="flex items-center space-x-3">
                        <div class="text-xs text-blue-600 font-medium">
                            {currentMeetingPointIndex + 1} of {meetingPoints.length}
                        </div>
                        <div class="flex items-center space-x-1">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400 opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>
                            <div class="w-8 h-1 bg-gradient-to-r from-blue-200 to-blue-400 rounded-full"></div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400 opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Meeting Point Card Container -->
        <div 
            class="overflow-hidden {isMobile && hasMultipleMeetingPoints ? 'touch-pan-y' : ''}"
            bind:this={carouselContainer}
            on:mousedown={handleStart}
            on:touchstart={handleStart}
            style="user-select: none;"
        >
            <div class="card card-gradient p-4 mb-4 animate-fade-in">
                <!-- Header -->
                <div class="flex items-center mb-4">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-lg mr-3 shadow-sm">
                        📍
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between">
                            <div>
                                <h2 class="text-lg font-bold text-secondary-800">
                                    {hasMultipleMeetingPoints ? `Option ${currentMeetingPointIndex + 1}` : 'Perfect Meeting Spot'}
                                </h2>
                                <p class="text-secondary-600 text-xs">{meetingPoint.name}</p>
                            </div>
                            {#if hasMultipleMeetingPoints}
                                <div class="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                    {currentMeetingPointIndex + 1}/{meetingPoints.length}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- Google Maps Link -->
                <a
                    href={getGoogleMapsUrl(meetingPoint.coordinates)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-outline btn-sm mb-4 inline-flex items-center text-xs"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    Open in Google Maps
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-2 h-2 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 17L17 7M17 7H7M17 7V17"/>
                    </svg>
                </a>

                <div class="grid grid-cols-2 gap-3 p-3 bg-primary-50 rounded-lg mb-4">
                    <div class="text-center">
                        <div class="text-xl font-bold text-primary-700">
                            {Math.round(meetingPoint.travelTimes.reduce((sum, time) => sum + parseInt(time.duration), 0) / meetingPoint.travelTimes.length)}
                        </div>
                        <div class="text-xs text-primary-600 font-medium">Avg. Travel Time</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-primary-700">
                            {Math.max(...meetingPoint.travelTimes.map(time => parseInt(time.duration)))}
                        </div>
                        <div class="text-xs text-primary-600 font-medium">Max Travel Time</div>
                    </div>
                </div>

                <!-- Travel Times -->
                <div class="mb-4">
                    <h3 class="text-sm font-semibold mb-3 flex items-center text-secondary-800">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-2 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Travel Times
                    </h3>
                    <div class="grid gap-2">
                        {#each meetingPoint.travelTimes as time, index}
                            <div class="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white/50 hover:bg-white/80 transition-colors">
                                <div class="flex items-center flex-1 min-w-0">
                                    <div class="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold mr-2 flex-shrink-0">
                                        {index + 1}
                                    </div>
                                    <div class="min-w-0 flex-1 overflow-hidden">
                                        <p class="font-medium text-secondary-800 truncate text-xs max-w-[120px] md:max-w-[180px]">
                                            {time.address}
                                        </p>
                                    </div>
                                </div>
                                <div class="ml-2 flex-shrink-0">
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {getTravelTimeColor(time.duration)}">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-2 h-2 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                        </svg>
                                        {time.duration} min
                                    </span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Summary Stats and Route Details Toggle -->
                <div class="space-y-3">
                    <!-- Route Details Toggle -->
                    {#if routes && routes.length > 0}
                        <button 
                            class="w-full btn btn-outline btn-sm text-xs"
                            on:click={() => showRouteDetails = !showRouteDetails}
                        >
                            {showRouteDetails ? 'Hide' : 'Show'} Detailed Routes
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 ml-1 transition-transform {showRouteDetails ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 9l6 6 6-6"/>
                            </svg>
                        </button>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Route Details -->
        {#if showRouteDetails && routes && routes.length > 0}
            <div class="mb-4" bind:this={routeDetailsElement}>
                <div class="bg-white/70 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg overflow-hidden">
                    <div class="px-4 py-3 bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200">
                        <h3 class="text-sm font-semibold text-secondary-800 flex items-center">Detailed Routes</h3>
                    </div>
                    <div class="max-h-96 overflow-y-auto scrollbar-thin p-4">
                        <RouteDetails 
                            {routes}
                            travelTimes={meetingPoint.travelTimes}
                        />
                    </div>
                </div>
            </div>
        {/if}

        <!-- Venues List -->
        {#if venues && venues.length > 0}
            <div class="mb-4">
                {#if venues.length > 0}
                <VenueList
                    {venues}
                    loading={isCalculating}
                    on:select={handleVenueSelected}
                />
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
  /* Enhanced Scrollbar for Route Details */
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.1);
    border-radius: 2px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
    border-radius: 2px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #2563eb, #7c3aed);
  }

  /* Disable text selection during drag */
  .touch-pan-y {
    touch-action: pan-y;
  }
</style>
