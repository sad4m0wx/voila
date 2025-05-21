<script>
    import { createEventDispatcher } from "svelte";

    // Props
    export let selectedTypes = ["restaurant"]; // Default to restaurants
    export let disabled = false;

    // Available venue types with their icons and labels
    const venueTypes = [
        { value: "restaurant", label: "Restaurants", icon: "🍽️" },
        { value: "cafe", label: "Cafés", icon: "☕" },
        { value: "bar", label: "Bars", icon: "🍸" },
    ];

    const dispatch = createEventDispatcher();

    // Handle type selection change
    function handleChange(type) {
        if (selectedTypes.includes(type)) {
            // If already selected, remove it (unless it's the last one)
            if (selectedTypes.length > 1) {
                selectedTypes = selectedTypes.filter((t) => t !== type);
            }
        } else {
            // If not selected, add it
            selectedTypes = [...selectedTypes, type];
        }

        dispatch("change", { selectedTypes });
    }
</script>

<div class="venue-types p-2 bg-white rounded-md shadow-sm">
    <p class="text-sm font-medium text-gray-700 mb-2">Venue Types</p>
    <div class="flex flex-wrap gap-2">
        {#each venueTypes as type}
            <button
                type="button"
                class="flex items-center px-3 py-1.5 text-sm rounded-full transition-colors
                 {selectedTypes.includes(type.value)
                    ? 'bg-primary-100 text-primary-700 border-primary-300'
                    : 'bg-gray-100 text-gray-600 border-gray-300'} 
                 border hover:bg-primary-50 disabled:opacity-50"
                {disabled}
                on:click={() => handleChange(type.value)}
                aria-pressed={selectedTypes.includes(type.value)}
            >
                <span class="mr-1">{type.icon}</span>
                {type.label}
            </button>
        {/each}
    </div>
</div>
