<script>
    import { createEventDispatcher } from "svelte";
    import VenueList from "$components/venues/VenueList.svelte";
    import RouteDetails from "./RouteDetails.svelte";

    const dispatch = createEventDispatcher();

    export let meetingPoint = null;
    export let venues = [];
    export let routes = [];
    export let isCalculating = false;
    export let isMobile = false;
    
    let showRouteDetails = false;

    function handleVenueSelected(event) {
        dispatch("venue-selected", event.detail);
    }

    function toggleResults() {
        dispatch("toggle-results");
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
</script>

{#if meetingPoint}
    <div class="card card-gradient p-4 mb-4 animate-fade-in">
        <!-- Header -->
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-lg mr-3 shadow-sm">
                    📍
                </div>
                <div>
                    <h2 class="text-lg font-bold text-secondary-800">Perfect Meeting Spot</h2>
                    <p class="text-secondary-600 text-xs">{meetingPoint.name}</p>
                </div>
            </div>
            {#if isMobile}
                <button class="btn btn-secondary btn-sm" on:click={toggleResults}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Back
                </button>
            {/if}
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
                            <div class="min-w-0 flex-1">
                                <p class="font-medium text-secondary-800 truncate text-xs">
                                    {time.address}
                                </p>
                                {#if time.transitSummary}
                                    <p class="text-xs text-secondary-500 mt-1 truncate">
                                        {time.transitSummary}
                                    </p>
                                {/if}
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
            <div class="grid grid-cols-2 gap-3 p-3 bg-primary-50 rounded-lg">
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
            
            <!-- Route Details Toggle -->
            {#if routes && routes.length > 0}
                <button 
                    class="w-full btn btn-outline btn-sm text-xs"
                    on:click={() => showRouteDetails = !showRouteDetails}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11H7l-4-4v8h4l2-2h6.6l2.7 2.7c.9.9 2.3.9 3.2 0L24 12l-2.8-2.8c-.9-.9-2.3-.9-3.2 0L15.3 12H13l-2-2z"/>
                    </svg>
                    {showRouteDetails ? 'Hide' : 'Show'} Detailed Routes
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 ml-1 transition-transform {showRouteDetails ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </button>
            {/if}
        </div>
    </div>

    <!-- Route Details -->
    {#if showRouteDetails && routes && routes.length > 0}
        <div class="mb-4">
            <RouteDetails 
                {routes}
                travelTimes={meetingPoint.travelTimes}
            />
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
{/if}
