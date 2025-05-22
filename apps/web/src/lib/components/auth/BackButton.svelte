<!-- BackButton.svelte -->
<script>
  import { goto } from '$app/navigation';
  
  export let href = null;
  export let label = 'Back';
  
  function handleClick() {
    if (href) {
      goto(href);
    } else {
      history.back();
    }
  }
</script>

<button
  type="button"
  class="back-button flex items-center text-sm text-neutral-600 hover:text-neutral-900 transition-colors mb-4"
  on:click={handleClick}
>
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
  </svg>
  {label}
</button>

<style>
  .back-button {
    background: transparent;
    border: none;
    padding: 0.5rem 0;
    cursor: pointer;
    font-weight: 500;
  }
  
  @media (hover: hover) {
    .back-button:hover {
      text-decoration: underline;
    }
  }
  
  @media screen and (max-width: 640px) {
    .back-button {
      padding: 0.75rem 0;
    }
  }
</style> 