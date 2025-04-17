<!-- apps/web/src/lib/components/groups/GroupDetail.svelte -->
<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import { 
      currentGroup, 
      updateGroupInfo, 
      deleteCurrentGroup, 
      leaveCurrentGroup, 
      isLoading 
    } from '$lib/stores/groups';
    import { authStore } from '$lib/stores/auth';
    
    // Props
    export let groupId;
    
    // Local state
    let isEditing = false;
    let editName = '';
    let editDescription = '';
    let showDeleteConfirm = false;
    let showLeaveConfirm = false;
    let error = null;
    
    const dispatch = createEventDispatcher();
    
    // Initialize edit form when editing starts
    $: if (isEditing && $currentGroup) {
      editName = $currentGroup.name;
      editDescription = $currentGroup.description || '';
    }
    
    // Compute user role
    $: userRole = $currentGroup && $authStore.user ? 
      $currentGroup.creatorId === $authStore.user.uid ? 'creator' :
      $currentGroup.admins.includes($authStore.user.uid) ? 'admin' :
      'member' : 'none';
    
    // Start editing
    function startEditing() {
      isEditing = true;
    }
    
    // Cancel editing
    function cancelEditing() {
      isEditing = false;
      error = null;
    }
    
    // Save changes
    async function saveChanges() {
      if (!editName.trim()) {
        error = 'Group name is required';
        return;
      }
      
      error = null;
      
      const updateData = {
        name: editName.trim(),
        description: editDescription.trim()
      };
      
      try {
        const success = await updateGroupInfo(groupId, updateData);
        
        if (success) {
          isEditing = false;
        }
      } catch (err) {
        error = err.message;
      }
    }
    
    // Delete group
    async function handleDeleteGroup() {
      try {
        const success = await deleteCurrentGroup();
        
        if (success) {
          dispatch('deleted');
          // Redirect to groups list
          goto('/groups');
        }
      } catch (err) {
        error = err.message;
        showDeleteConfirm = false;
      }
    }
    
    // Leave group
    async function handleLeaveGroup() {
      try {
        const success = await leaveCurrentGroup();
        
        if (success) {
          dispatch('left');
          // Redirect to groups list
          goto('/groups');
        }
      } catch (err) {
        error = err.message;
        showLeaveConfirm = false;
      }
    }
    
    // Format date
    function formatDate(date) {
      if (!date) return '';
      
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(date).toLocaleDateString(undefined, options);
    }
  </script>
  
  <div class="group-detail">
    {#if $isLoading}
      <div class="loading">
        <div class="loader"></div>
        <p>Loading group details...</p>
      </div>
    {:else if $currentGroup}
      {#if isEditing}
        <!-- Edit Mode -->
        <div class="edit-form">
          <h2 class="section-title">Edit Group</h2>
          
          {#if error}
            <div class="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          {/if}
          
          <div class="form-group">
            <label for="groupName">Group Name</label>
            <input 
              type="text" 
              id="groupName" 
              class="input" 
              bind:value={editName} 
              placeholder="Enter group name"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="groupDescription">Description (optional)</label>
            <textarea 
              id="groupDescription" 
              class="input" 
              bind:value={editDescription} 
              placeholder="What's this group about?"
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button class="btn btn-outline" on:click={cancelEditing}>
              Cancel
            </button>
            
            <button 
              class="btn btn-primary" 
              on:click={saveChanges}
              disabled={$isLoading || !editName.trim()}
            >
              {#if $isLoading}
                <span class="loader loader-sm"></span>
                <span>Saving...</span>
              {:else}
                <span>Save Changes</span>
              {/if}
            </button>
          </div>
        </div>
      {:else}
        <!-- View Mode -->
        <div class="group-header">
          <div class="group-title-section">
            <h1 class="group-name">{$currentGroup.name}</h1>
            
            {#if userRole !== 'none' && (userRole === 'creator' || userRole === 'admin')}
              <button 
                class="btn btn-sm btn-outline edit-button" 
                on:click={startEditing}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
                <span>Edit</span>
              </button>
            {/if}
          </div>
          
          {#if $currentGroup.description}
            <p class="group-description">{$currentGroup.description}</p>
          {/if}
          
          <div class="group-meta">
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>{$currentGroup.members.length} {$currentGroup.members.length === 1 ? 'member' : 'members'}</span>
            </div>
            
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Created {formatDate($currentGroup.createdAt)}</span>
            </div>
            
            <div class="meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>Your role: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>
            </div>
          </div>
        </div>
        
        <div class="group-actions">
          {#if userRole === 'creator'}
            <button 
              class="btn btn-error" 
              on:click={() => showDeleteConfirm = true}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Delete Group</span>
            </button>
          {:else if userRole === 'member' || userRole === 'admin'}
            <button 
              class="btn btn-outline" 
              on:click={() => showLeaveConfirm = true}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Leave Group</span>
            </button>
          {/if}
        </div>
        
        {#if error}
          <div class="alert alert-error mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        {/if}
      {/if}
      
      <!-- Confirmation Modals -->
      {#if showDeleteConfirm}
        <div class="modal-overlay" on:click={() => showDeleteConfirm = false}>
          <div class="modal-content" on:click|stopPropagation>
            <h3 class="modal-title">Delete Group?</h3>
            <p class="modal-text">Are you sure you want to delete this group? This action cannot be undone and all group data will be permanently lost.</p>
            
            <div class="modal-actions">
              <button class="btn btn-outline" on:click={() => showDeleteConfirm = false}>
                Cancel
              </button>
              <button 
                class="btn btn-error" 
                on:click={handleDeleteGroup}
                disabled={$isLoading}
              >
                {#if $isLoading}
                  <span class="loader loader-sm"></span>
                  <span>Deleting...</span>
                {:else}
                  <span>Yes, Delete Group</span>
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
      
      {#if showLeaveConfirm}
        <div class="modal-overlay" on:click={() => showLeaveConfirm = false}>
          <div class="modal-content" on:click|stopPropagation>
            <h3 class="modal-title">Leave Group?</h3>
            <p class="modal-text">Are you sure you want to leave this group? You'll need an invitation to rejoin.</p>
            
            <div class="modal-actions">
              <button class="btn btn-outline" on:click={() => showLeaveConfirm = false}>
                Cancel
              </button>
              <button 
                class="btn btn-primary" 
                on:click={handleLeaveGroup}
                disabled={$isLoading}
              >
                {#if $isLoading}
                  <span class="loader loader-sm"></span>
                  <span>Leaving...</span>
                {:else}
                  <span>Yes, Leave Group</span>
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
    {:else}
      <div class="not-found">
        <svg xmlns="http://www.w3.org/2000/svg" class="not-found-icon" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h2>Group Not Found</h2>
        <p>The group you're looking for doesn't exist or you don't have access to it.</p>
        <a href="/groups" class="btn btn-primary">Go to My Groups</a>
      </div>
    {/if}
  </div>
  
  <style>
    .group-detail {
      position: relative;
    }
    
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-8) 0;
      color: var(--text-secondary);
    }
    
    .group-header {
      margin-bottom: var(--space-6);
    }
    
    .group-title-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-4);
    }
    
    .group-name {
      margin: 0;
      font-size: var(--text-3xl);
      color: var(--text-primary);
      font-weight: var(--font-bold);
    }
    
    .edit-button {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    
    .group-description {
      margin: 0 0 var(--space-4) 0;
      color: var(--text-secondary);
      font-size: var(--text-base);
      line-height: 1.6;
    }
    
    .group-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--neutral-200);
    }
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--text-tertiary);
      font-size: var(--text-sm);
    }
    
    .meta-icon {
      color: var(--neutral-500);
    }
    
    .group-actions {
      display: flex;
      gap: var(--space-4);
      margin-top: var(--space-6);
    }
    
    .section-title {
      font-size: var(--text-2xl);
      color: var(--text-primary);
      margin-bottom: var(--space-6);
    }
    
    .form-group {
      margin-bottom: var(--space-4);
    }
    
    .form-group label {
      display: block;
      margin-bottom: var(--space-2);
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }
    
    .form-actions {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      margin-top: var(--space-6);
    }
    
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-8) 0;
    }
    
    .not-found-icon {
      margin-bottom: var(--space-4);
      color: var(--error);
    }
    
    .not-found h2 {
      margin-bottom: var(--space-2);
      color: var(--text-primary);
    }
    
    .not-found p {
      margin-bottom: var(--space-6);
      color: var(--text-secondary);
    }
    
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .modal-content {
      background-color: var(--bg-card);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      max-width: 500px;
      width: 90%;
      box-shadow: var(--shadow-lg);
    }
    
    .modal-title {
      font-size: var(--text-xl);
      color: var(--text-primary);
      margin-bottom: var(--space-4);
    }
    
    .modal-text {
      color: var(--text-secondary);
      margin-bottom: var(--space-6);
    }
    
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-4);
    }
    
    @media (max-width: 768px) {
      .group-title-section {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      
      .edit-button {
        margin-top: var(--space-2);
      }
      
      .group-meta {
        flex-direction: column;
        gap: var(--space-2);
      }
      
      .group-actions {
        flex-direction: column;
      }
      
      .group-actions button {
        width: 100%;
      }
      
      .form-actions {
        flex-direction: column;
      }
      
      .form-actions button {
        width: 100%;
      }
      
      .modal-actions {
        flex-direction: column;
      }
      
      .modal-actions button {
        width: 100%;
      }
    }
  </style>