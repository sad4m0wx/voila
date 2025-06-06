<script>
  import { onMount } from "svelte";
  
  // Parallax effect for metro animation
  let scrollY = 0;
  let parallaxContainer;
  
  onMount(() => {
    const handleScroll = () => {
      scrollY = window.scrollY;
      if (parallaxContainer) {
        parallaxContainer.style.transform = `translateY(${scrollY * 0.3}px)`;
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<svelte:window bind:scrollY />

<!-- Animated Metro Trails Background with Parallax -->
<div bind:this={parallaxContainer} class="fixed inset-0 pointer-events-none opacity-30 z-0" style="will-change: transform;">
  <svg class="w-full h-full" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
    <!-- Metro Trail 1 - Main horizontal -->
    <path
      id="trail1"
      d="M-100,200 Q300,150 600,300 Q900,450 1500,200"
      stroke="url(#gradient1)"
      stroke-width="4"
      fill="none"
      opacity="0.9"
    />
    <circle r="6" fill="#2563EB" opacity="1">
      <animateMotion dur="25s" repeatCount="indefinite">
        <mpath href="#trail1"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 2 - Bottom curve -->
    <path
      id="trail2"
      d="M-100,700 Q400,600 700,750 Q1000,900 1500,600"
      stroke="url(#gradient2)"
      stroke-width="4"
      fill="none"
      opacity="0.8"
    />
    <circle r="5" fill="#059669" opacity="0.9">
      <animateMotion dur="30s" repeatCount="indefinite">
        <mpath href="#trail2"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 3 - Reverse top -->
    <path
      id="trail3"
      d="M1500,100 Q1100,200 800,100 Q500,0 -100,150"
      stroke="url(#gradient3)"
      stroke-width="3"
      fill="none"
      opacity="0.7"
    />
    <circle r="4" fill="#D97706" opacity="0.8">
      <animateMotion dur="35s" repeatCount="indefinite">
        <mpath href="#trail3"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 4 - Vertical left -->
    <path
      id="trail4"
      d="M200,-100 Q250,200 300,500 Q350,700 400,1000"
      stroke="url(#gradient4)"
      stroke-width="3"
      fill="none"
      opacity="0.6"
    />
    <circle r="4" fill="#7C3AED" opacity="0.8">
      <animateMotion dur="40s" repeatCount="indefinite">
        <mpath href="#trail4"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 5 - Vertical right -->
    <path
      id="trail5"
      d="M1200,-100 Q1150,300 1100,600 Q1050,800 1000,1000"
      stroke="url(#gradient5)"
      stroke-width="3"
      fill="none"
      opacity="0.6"
    />
    <circle r="4" fill="#DC2626" opacity="0.8">
      <animateMotion dur="45s" repeatCount="indefinite">
        <mpath href="#trail5"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 6 - Diagonal -->
    <path
      id="trail6"
      d="M-100,500 Q200,400 500,500 Q800,600 1500,300"
      stroke="url(#gradient6)"
      stroke-width="2"
      fill="none"
      opacity="0.5"
    />
    <circle r="3" fill="#0891B2" opacity="0.7">
      <animateMotion dur="50s" repeatCount="indefinite">
        <mpath href="#trail6"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 7 - Middle curve -->
    <path
      id="trail7"
      d="M-100,400 Q350,350 700,450 Q1050,550 1500,400"
      stroke="url(#gradient7)"
      stroke-width="2"
      fill="none"
      opacity="0.5"
    />
    <circle r="3" fill="#65A30D" opacity="0.7">
      <animateMotion dur="55s" repeatCount="indefinite">
        <mpath href="#trail7"/>
      </animateMotion>
    </circle>
    
    <!-- Gradients -->
    <defs>
      <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#2563EB;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#2563EB;stop-opacity:0.9" />
        <stop offset="100%" style="stop-color:#2563EB;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#059669;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#059669;stop-opacity:0.8" />
        <stop offset="100%" style="stop-color:#059669;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#D97706;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#D97706;stop-opacity:0.7" />
        <stop offset="100%" style="stop-color:#D97706;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="gradient4" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#7C3AED;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#7C3AED;stop-opacity:0.6" />
        <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="gradient5" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#DC2626;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#DC2626;stop-opacity:0.6" />
        <stop offset="100%" style="stop-color:#DC2626;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="gradient6" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#0891B2;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#0891B2;stop-opacity:0.5" />
        <stop offset="100%" style="stop-color:#0891B2;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="gradient7" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#65A30D;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#65A30D;stop-opacity:0.5" />
        <stop offset="100%" style="stop-color:#65A30D;stop-opacity:0" />
      </linearGradient>
    </defs>
  </svg>
</div> 