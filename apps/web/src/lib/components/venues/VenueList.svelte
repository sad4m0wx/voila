<script>
    import { createEventDispatcher } from "svelte";

    // Props
    export let venues = [];
    export let loading = false;

    const dispatch = createEventDispatcher();

    // Helper function to get price level string
    function getPriceLevel(level) {
        if (level === null || level === undefined) return "N/A";
        return "€".repeat(level);
    }

    // Helper function to get venue type icon
    function getVenueTypeIcon(types) {
        if (types.includes("restaurant")) return "🍽️";
        if (types.includes("cafe")) return "☕";
        if (types.includes("bar")) return "🍸";
        return "📍";
    }

    function selectVenue(venue) {
        dispatch("select", { venue });
    }
</script>

<div class="venues-container mt-4">
    <h3 class="text-lg font-semibold mb-2">Nearby Venues</h3>

    {#if loading}
        <div class="flex justify-center py-8">
            <div
                class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"
            ></div>
        </div>
    {:else if venues.length === 0}
        <div class="text-center py-6 text-gray-500">
            No venues found in this area.
        </div>
    {:else}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {#each venues as venue}
                <div
                    class="venue-card bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    on:click={() => selectVenue(venue)}
                >
                    <div class="h-32 bg-gray-200 relative">
                        {#if venue.photo_reference}
                            <img
                                src={`/api/venue-photo?reference=${venue.photo_reference}`}
                                alt={venue.name}
                                class="w-full h-full object-cover"
                            />
                        {:else}
                            <div
                                class="w-full h-full flex items-center justify-center text-4xl"
                            >
                                {getVenueTypeIcon(venue.types)}
                            </div>
                        {/if}
                        {#if venue.rating}
                            <div
                                class="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-sm font-medium flex items-center"
                            >
                                ⭐ {venue.rating.toFixed(1)}
                            </div>
                        {/if}
                    </div>

                    <div class="p-3">
                        <h4 class="font-medium text-gray-900 truncate">
                            {venue.name}
                        </h4>
                        <p class="text-gray-500 text-sm truncate mt-1">
                            {venue.address}
                        </p>
                        <div class="flex justify-between items-center mt-2">
                            <div class="text-sm text-gray-700">
                                {getVenueTypeIcon(venue.types)}
                                {venue.types && venue.types.length > 0
                                    ? venue.types[0].replace("_", " ")
                                    : "Unknown"}
                            </div>
                            {#if venue.price_level !== undefined && venue.price_level !== null}
                                <div
                                    class="text-sm font-medium text-primary-600"
                                >
                                    {getPriceLevel(venue.price_level)}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
