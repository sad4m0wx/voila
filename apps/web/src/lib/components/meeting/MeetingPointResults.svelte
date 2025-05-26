<script>
    import { createEventDispatcher } from "svelte";
    import VenueList from "$components/venues/VenueList.svelte";

    const dispatch = createEventDispatcher();

    export let meetingPoint = null;
    export let venues = [];
    export let showVenues = true;
    export let isCalculating = false;
    export let isMobile = false;

    function handleVenueSelected(event) {
        dispatch("venue-selected", event.detail);
    }

    function toggleResults() {
        dispatch("toggle-results");
    }
</script>

{#if meetingPoint}
    <div class="card bg-white p-4 rounded-lg shadow-sm mb-4">
        <div class="flex justify-between items-start mb-3">
            <h2 class="text-lg font-semibold">Meeting Point</h2>
            {#if isMobile}
                <button class="btn btn-sm btn-outline" on:click={toggleResults}>
                    Back to Form
                </button>
            {/if}
            <div class="badge badge-primary text-sm">
                <span>📍</span>
                <span class="ml-1">{meetingPoint.name}</span>
            </div>
        </div>

        <a
            href={`https://www.google.com/maps/search/?api=1&query=${meetingPoint.coordinates[1]},${meetingPoint.coordinates[0]}`}
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center text-primary-600 hover:text-primary-700 mb-4 text-sm"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 mr-1"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Open in Google Maps
        </a>

        <h3 class="text-base font-medium mb-2">Travel Times</h3>
        <ul class="space-y-2 mb-2">
            {#each meetingPoint.travelTimes as time}
                <li
                    class="p-2 bg-bg-subtle rounded-md flex justify-between items-center"
                >
                    <div class="truncate pr-2">
                        <p class="font-medium text-sm truncate">
                            {time.address}
                        </p>
                    </div>
                    <div class="badge badge-accent whitespace-nowrap">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-3 h-3 mr-1"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>{time.duration} min</span>
                    </div>
                </li>
            {/each}
        </ul>
    </div>

    <!-- Venues List -->
    {#if venues && venues.length > 0}
        <div class="mb-4">
            <VenueList
                {venues}
                loading={isCalculating}
                on:select={handleVenueSelected}
            />
        </div>
    {:else if showVenues && !isCalculating}
        <div class="card bg-white p-4 rounded-lg shadow-sm mb-4">
            <h3 class="text-base font-medium mb-2">Nearby Venues</h3>
            <div
                class="p-4 bg-bg-subtle rounded-md text-center text-neutral-500 text-sm"
            >
                No venues found near this location.
            </div>
        </div>
    {/if}
{/if}
