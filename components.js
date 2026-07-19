// --- SASTAGRAM COMPONENT INJECTION ENGINE ---

export function initializeComponents() {
    const phoneContainer = document.querySelector('.phone-container');
    if (!phoneContainer) return;

    const componentHTML = `
        <!-- NOTIFICATIONS DRAWER PANEL -->
        <div class="component-drawer" id="notification-drawer">
            <div class="drawer-header">
                <span>Notifications</span>
                <i class="fa-solid fa-xmark close-drawer-trigger" data-close="notification-drawer"></i>
            </div>
            <div class="drawer-body" id="notification-list">
                <!-- Live database notification rows populate here natively -->
            </div>
        </div>

        <!-- COMMENTS SLIDE-UP DRAWER -->
        <div class="component-drawer drawer-bottom" id="comments-drawer">
            <div class="drawer-header">
                <span>Comments</span>
                <i class="fa-solid fa-xmark close-drawer-trigger" data-close="comments-drawer"></i>
            </div>
            <div class="drawer-body" id="comments-list-container"></div>
            <div class="drawer-input-row">
                <input type="text" id="comment-input-field" placeholder="Add a comment...">
                <button id="submit-comment-btn"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </div>
    `;

    phoneContainer.insertAdjacentHTML('beforeend', componentHTML);

    document.querySelectorAll('.close-drawer-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const targetId = trigger.getAttribute('data-close');
            toggleDrawer(targetId, false);
        });
    });
}

export function toggleDrawer(drawerId, shouldOpen) {
    const drawerElement = document.getElementById(drawerId);
    if (!drawerElement) return;

    if (shouldOpen) {
        drawerElement.classList.add('open');
    } else {
        drawerElement.classList.remove('open');
    }
}
