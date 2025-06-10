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

<!-- Enhanced Animated Metro Trails Background with Parallax -->
<div bind:this={parallaxContainer} class="fixed inset-0 pointer-events-none opacity-20 z-0" style="will-change: transform;">
  <svg class="w-full h-full" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
    <!-- Primary Metro Trails -->
    <!-- Metro Trail 1 - Main horizontal with curve -->
    <path
      id="trail1"
      d="M-100,200 Q200,120 400,180 Q600,240 800,200 Q1000,160 1200,220 Q1400,280 1600,200"
      stroke="url(#gradient1)"
      stroke-width="3"
      fill="none"
      opacity="0.8"
    />
    <circle r="5" fill="#3B82F6" opacity="0.9">
      <animateMotion dur="28s" repeatCount="indefinite">
        <mpath href="#trail1"/>
      </animateMotion>
    </circle>
    <circle r="3" fill="#3B82F6" opacity="0.6">
      <animateMotion dur="28s" begin="14s" repeatCount="indefinite">
        <mpath href="#trail1"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 2 - Bottom flowing curve -->
    <path
      id="trail2"
      d="M-100,700 Q300,620 500,680 Q700,740 900,700 Q1100,660 1300,720 Q1500,780 1700,700"
      stroke="url(#gradient2)"
      stroke-width="3"
      fill="none"
      opacity="0.7"
    />
    <circle r="4" fill="#10B981" opacity="0.8">
      <animateMotion dur="32s" repeatCount="indefinite">
        <mpath href="#trail2"/>
      </animateMotion>
    </circle>
    <circle r="6" fill="#10B981" opacity="0.4">
      <animateMotion dur="32s" begin="10s" repeatCount="indefinite">
        <mpath href="#trail2"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 3 - Reverse top elegant curve -->
    <path
      id="trail3"
      d="M1700,100 Q1400,60 1200,120 Q1000,180 800,140 Q600,100 400,160 Q200,220 -100,180"
      stroke="url(#gradient3)"
      stroke-width="2.5"
      fill="none"
      opacity="0.6"
    />
    <circle r="4" fill="#F59E0B" opacity="0.7">
      <animateMotion dur="35s" repeatCount="indefinite">
        <mpath href="#trail3"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 4 - Vertical left flowing -->
    <path
      id="trail4"
      d="M200,-100 Q180,100 220,300 Q260,500 240,700 Q220,800 200,1000"
      stroke="url(#gradient4)"
      stroke-width="2.5"
      fill="none"
      opacity="0.5"
    />
    <circle r="3.5" fill="#8B5CF6" opacity="0.7">
      <animateMotion dur="38s" repeatCount="indefinite">
        <mpath href="#trail4"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 5 - Vertical right organic -->
    <path
      id="trail5"
      d="M1200,-100 Q1180,150 1220,350 Q1160,550 1200,750 Q1240,850 1200,1000"
      stroke="url(#gradient5)"
      stroke-width="2"
      fill="none"
      opacity="0.5"
    />
    <circle r="3" fill="#EF4444" opacity="0.6">
      <animateMotion dur="42s" repeatCount="indefinite">
        <mpath href="#trail5"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 6 - Diagonal sweep -->
    <path
      id="trail6"
      d="M-100,500 Q150,420 400,480 Q650,540 900,500 Q1150,460 1400,520 Q1600,580 1700,540"
      stroke="url(#gradient6)"
      stroke-width="2"
      fill="none"
      opacity="0.4"
    />
    <circle r="3" fill="#06B6D4" opacity="0.6">
      <animateMotion dur="45s" repeatCount="indefinite">
        <mpath href="#trail6"/>
      </animateMotion>
    </circle>
    
    <!-- Metro Trail 7 - Middle gentle wave -->
    <path
      id="trail7"
      d="M-100,400 Q200,380 500,420 Q800,460 1100,440 Q1300,420 1500,460 Q1600,480 1700,460"
      stroke="url(#gradient7)"
      stroke-width="1.5"
      fill="none"
      opacity="0.4"
    />
    <circle r="2.5" fill="#84CC16" opacity="0.5">
      <animateMotion dur="48s" repeatCount="indefinite">
        <mpath href="#trail7"/>
      </animateMotion>
    </circle>

    <!-- Additional Decorative Trails -->
    <!-- Metro Trail 8 - Top accent -->
    <path
      id="trail8"
      d="M-100,80 Q400,40 800,100 Q1200,160 1600,120"
      stroke="url(#gradient8)"
      stroke-width="1.5"
      fill="none"
      opacity="0.3"
    />
    <circle r="2" fill="#F97316" opacity="0.5">
      <animateMotion dur="52s" repeatCount="indefinite">
        <mpath href="#trail8"/>
      </animateMotion>
    </circle>

    <!-- Metro Trail 9 - Bottom accent -->
    <path
      id="trail9"
      d="M1600,820 Q1200,780 800,840 Q400,900 -100,860"
      stroke="url(#gradient9)"
      stroke-width="1.5"
      fill="none"
      opacity="0.3"
    />
    <circle r="2" fill="#EC4899" opacity="0.5">
      <animateMotion dur="55s" repeatCount="indefinite">
        <mpath href="#trail9"/>
      </animateMotion>
    </circle>

    <!-- Floating Particles for Extra Depth -->
    <g opacity="0.2">
      <circle cx="300" cy="250" r="1" fill="#3B82F6">
        <animate attributeName="cy" values="250;230;250" dur="4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.2;0.5;0.2" dur="4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="800" cy="150" r="1.5" fill="#10B981">
        <animate attributeName="cy" values="150;170;150" dur="6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.1;0.4;0.1" dur="6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="1100" cy="600" r="1" fill="#F59E0B">
        <animate attributeName="cy" values="600;580;600" dur="5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="400" cy="700" r="1.5" fill="#8B5CF6">
        <animate attributeName="cy" values="700;720;700" dur="7s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.1;0.3;0.1" dur="7s" repeatCount="indefinite"/>
      </circle>
    </g>
    
    <!-- Enhanced Gradients with More Sophisticated Colors -->
    <defs>
      <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:0" />
        <stop offset="30%" style="stop-color:#3B82F6;stop-opacity:0.8" />
        <stop offset="70%" style="stop-color:#6366F1;stop-opacity:0.8" />
        <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:0" />
      </linearGradient>
      
      <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#10B981;stop-opacity:0" />
        <stop offset="30%" style="stop-color:#10B981;stop-opacity:0.7" />
        <stop offset="70%" style="stop-color:#059669;stop-opacity:0.7" />
        <stop offset="100%" style="stop-color:#047857;stop-opacity:0" />
      </linearGradient>
      
      <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#F59E0B;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#F59E0B;stop-opacity:0.6" />
        <stop offset="100%" style="stop-color:#D97706;stop-opacity:0" />
      </linearGradient>
      
      <linearGradient id="gradient4" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#8B5CF6;stop-opacity:0.5" />
        <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:0" />
      </linearGradient>
      
      <linearGradient id="gradient5" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#EF4444;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#EF4444;stop-opacity:0.5" />
        <stop offset="100%" style="stop-color:#DC2626;stop-opacity:0" />
      </linearGradient>
      
      <linearGradient id="gradient6" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#06B6D4;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#06B6D4;stop-opacity:0.4" />
        <stop offset="100%" style="stop-color:#0891B2;stop-opacity:0" />
      </linearGradient>
      
      <linearGradient id="gradient7" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#84CC16;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#84CC16;stop-opacity:0.4" />
        <stop offset="100%" style="stop-color:#65A30D;stop-opacity:0" />
      </linearGradient>

      <linearGradient id="gradient8" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#F97316;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#F97316;stop-opacity:0.3" />
        <stop offset="100%" style="stop-color:#EA580C;stop-opacity:0" />
      </linearGradient>

      <linearGradient id="gradient9" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#EC4899;stop-opacity:0" />
        <stop offset="50%" style="stop-color:#EC4899;stop-opacity:0.3" />
        <stop offset="100%" style="stop-color:#DB2777;stop-opacity:0" />
      </linearGradient>
    </defs>
  </svg>
</div> 