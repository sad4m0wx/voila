<script>
    import { createEventDispatcher } from "svelte";
    import VenueTypeSelector from "$components/venues/VenueTypeSelector.svelte";

    const dispatch = createEventDispatcher();

    export let showVenues = true;
    export let venueTypes = ["restaurant"];
    export let venueRadius = 500;
    export let isCalculating = false;

    function handleVenueTypeChange(event) {
        venueTypes = event.detail.selectedTypes;
        dispatch("venue-options-changed", {
            showVenues,
            venueTypes,
            venueRadius,
        });
    }

    function handleVenueToggle() {
        showVenues = !showVenues;
        dispatch("venue-options-changed", {
            showVenues,
            venueTypes,
            venueRadius,
        });
    }

    function handleRadiusChange() {
        dispatch("venue-options-changed", {
            showVenues,
            venueTypes,
            venueRadius,
        });
    }
</script>

<div class="mt-4 pt-3 border-t border-neutral-200">
    <div class="flex items-center justify-between">
        <label class="flex items-center">
            <input
                type="checkbox"
                bind:checked={showVenues}
                on:change={handleVenueToggle}
                class="form-checkbox h-4 w-4 text-primary-600"
            />
            <span class="ml-2 text-sm">Show venues</span>
        </label>

        {#if showVenues}
            <div class="flex items-center">
                <span class="text-xs mr-1">{venueRadius}m</span>
                <input
                    type="range"
                    min="100"
                    max="1000"
                    step="100"
                    bind:value={venueRadius}
                    on:input={handleRadiusChange}
                    disabled={isCalculating}
                    class="form-range w-20 h-2"
                />
            </div>
        {/if}
    </div>

    {#if showVenues}
        <div class="mt-3">
            <VenueTypeSelector
                bind:selectedTypes={venueTypes}
                disabled={isCalculating}
                on:change={handleVenueTypeChange}
            />
        </div>
    {/if}
</div>
