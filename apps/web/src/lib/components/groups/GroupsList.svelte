<!-- apps/web/src/lib/components/groups/GroupsList.svelte -->
<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { groups, loadUserGroups, isLoading } from '$lib/stores/groups';
    
    // Props
    export let showCreateButton = true;
    export let showEmptyState = true;
    export let title = "My Groups";
    
    onMount(() => {
      loadUserGroups();
    });
    
    // Navigate to group details
    function viewGroup(groupId) {
      goto(`/groups/${groupId}`);
    }
    
    // Navigate to create group page
    function createGroup() {
      goto('/groups/create');
    }
    
    // Format date
    function formatDate(date) {
      if (!date) return '';
      
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(date).toLocaleDateString(undefined, options);
    }
  </script>
  
  <div class="groups-list">
    <div class="list-header">
      <h3 class="title">{title}</h3>
      
      {#if showCreateButton}
        <button 
          class="btn btn-primary btn-sm create-group" 
          on:click={createGroup}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            <line x1="19.5" y1="7.5" x2="19.5" y2="7.5"></line>
            <line x1="19.5" y1="7.5" x2="19.5" y2="7.5"></line>
          </svg>
          <span>Create Group</span>
        </button>
      {/if}
    </div>
    
    {#if $isLoading}
      <div class="loading">
        <div class="loader"></div>
        <p>Loading groups...</p>
      </div>
    {:else if $groups.length === 0 && showEmptyState}
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <p>You don't have any groups yet.</p>
        <button class="btn btn-primary" on:click={createGroup}>Create Your First Group</button>
      </div>
    {:else}
      <ul class="groups">
        {#each $groups as group (group.id)}
          <li class="group-item" on:click={() => viewGroup(group.id)}>
            <div class="group-info">
              <h4 class="group-name">{group.name}</h4>
              <p class="group-meta">
                <span class="member-count">{group.members.length} {group.members.length === 1 ? 'member' : 'members'}</span>
                <span class="separator">•</span>
                <span class="created-date">Created {formatDate(group.createdAt)}</span>
              </p>
              {#if group.description}
                <p class="group-description">{group.description}</p>
              {/if}
            </div>
            
            <div class="group-action">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  
  <style>
    .groups-list {
      margin-bottom: var(--space-6);
    }
    
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-4);
    }
    
    .title {
      margin: 0;
      font-size: var(--text-xl);
      color: var(--text-primary);
      font-weight: var(--font-semibold);
    }
    
    .create-group {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-8) 0;
      color: var(--text-secondary);
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-8) 0;
      color: var(--text-tertiary);
    }
    
    .empty-icon {
      margin-bottom: var(--space-4);
      color: var(--neutral-400);
    }
    
    .empty-state p {
      margin-bottom: var(--space-4);
    }
    
    .groups {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .group-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4);
      border-radius: var(--radius-md);
      background-color: var(--bg-subtle);
      margin-bottom: var(--space-3);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .group-item:hover {
      background-color: var(--primary-50);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }
    
    .group-info {
      flex: 1;
    }
    
    .group-name {
      margin: 0 0 var(--space-1) 0;
      font-size: var(--text-lg);
      color: var(--text-primary);
      font-weight: var(--font-medium);
    }
    
    .group-meta {
      display: flex;
      align-items: center;
      margin: 0 0 var(--space-2) 0;
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }
    
    .separator {
      margin: 0 var(--space-2);
    }
    
    .group-description {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .group-action {
      color: var(--neutral-400);
      display: flex;
      align-items: center;
      padding: var(--space-2);
    }
    
    .group-item:hover .group-action {
      color: var(--primary-500);
    }
    
    @media (max-width: 768px) {
      .list-header {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      
      .create-group {
        width: 100%;
        justify-content: center;
        margin-top: var(--space-2);
      }
    }
  </style>