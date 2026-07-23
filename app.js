// --- APPLICATION INTEGRATED EXTENSIONS ---
import { initializeComponents, toggleDrawer } from "./components.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, increment, deleteDoc, where, runTransaction, getDocs, limit } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// --- FIREBASE SETTING INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCF-Kp7odwbB7SiRfACRLA0eJ5WWOUFTGs",
  authDomain: "sastagram-3e4f0.firebaseapp.com",
  projectId: "sastagram-3e4f0",
  storageBucket: "sastagram-3e4f0.firebasestorage.app",
  messagingSenderId: "839260610117",
  appId: "1:839260610117:web:cc787c03520636349b0d2c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Inject dynamic components layout modules instantly on execution
initializeComponents();

// --- CORE UI SELECTORS ---
const authOverlay = document.getElementById('auth-overlay');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const primaryBtn = document.getElementById('auth-primary-btn');
const toggleModeText = document.getElementById('auth-toggle-mode');

const editModal = document.getElementById('edit-profile-modal');
const openModalBtn = document.getElementById('open-edit-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');
const logoutBtn = document.getElementById('settings-logout-btn');

const uploadModal = document.getElementById('upload-post-modal');
const openUploadBtn = document.getElementById('nav-upload-trigger');
const closeUploadBtn = document.getElementById('close-upload-btn');
const publishPostBtn = document.getElementById('publish-post-btn');

const notificationBellIcon = document.getElementById('header-notification-bell');
let isLoginMode = true; 
let activePostIdForComments = null;
let commentsUnsubscribe = null;
let profilePostsUnsubscribe = null;
let activeChatUnsubscribe = null;
let notificationsUnsubscribe = null;
let storyTimerTimeout = null;

// GLOBAL VIEW TRACKERS
let activeProfileUid = null; 
let activeChatRecipientUid = null;

// --- REAL-TIME ACTIVE NOTIFICATIONS LISTENER PIPELINE ---
function listenToLiveNotifications(uid) {
    const notificationListContainer = document.getElementById('notification-list');
    if (!notificationListContainer) return;

    if (notificationsUnsubscribe) notificationsUnsubscribe();

    const notifQuery = query(
        collection(db, "notifications"),
        where("targetUid", "==", uid)
    );

    notificationsUnsubscribe = onSnapshot(notifQuery, (snapshot) => {
        notificationListContainer.innerHTML = '';
        
        if (snapshot.empty) {
            notificationListContainer.innerHTML = `<p style="text-align: center; color: #8e8e93; margin-top: 20px; font-size: 13px;">No notifications yet.</p>`;
            return;
        }

        const sortedDocs = [];
        snapshot.forEach(doc => sortedDocs.push(doc.data()));
        sortedDocs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        sortedDocs.forEach((notif) => {
            const row = document.createElement('div');
            row.classList.add('drawer-item-row');
            row.style.borderBottom = "1px solid #1a1a1a";

            const senderName = notif.senderUsername || '@someone';
            const initialLetter = senderName.charAt(0) === '@' ? senderName.charAt(1).toUpperCase() : senderName.charAt(0).toUpperCase();

            row.innerHTML = `
                <div class="mini-avatar">${initialLetter}</div>
                <div class="item-text">
                    <strong>${senderName}</strong> ${notif.text}
                </div>
            `;
            notificationListContainer.appendChild(row);
        });
    });
}

// --- SECURE LIFECYCLE CONTROLLER STATE PIPELINE ---
onAuthStateChanged(auth, (user) => {
    const authOverlay = document.getElementById('auth-overlay');
    
    if (user) {
        if (authOverlay) {
            authOverlay.classList.remove('active');
            authOverlay.style.display = 'none';
        }

        switchActiveTabScreen('home-screen');
        activeProfileUid = user.uid; 
        
        loadUserProfileData(user.uid);
        listenToLiveHomeFeed(); 
        
        if (typeof listenToLiveNotifications === 'function') {
            listenToLiveNotifications(user.uid); 
        }
    } else {
        if (authOverlay) {
            authOverlay.classList.add('active');
            authOverlay.style.display = 'flex';
        }
        if (notificationsUnsubscribe) notificationsUnsubscribe();
    }
});

// --- ROUTING CONTROLLER VIEW LAYOUT MECHANICS ---
const navTabs = document.querySelectorAll('.nav-tab');
const appScreens = document.querySelectorAll('.app-screen');

function switchActiveTabScreen(targetScreenId) {
    navTabs.forEach(tab => {
        tab.classList.remove('active');
        if(tab.getAttribute('data-target') === targetScreenId) tab.classList.add('active');
    });
    appScreens.forEach(screen => {
        screen.classList.remove('active');
        screen.style.opacity = '0';
    });
    const targeted = document.getElementById(targetScreenId);
    if(targeted) {
        targeted.classList.add('active');
        setTimeout(() => { targeted.style.opacity = '1'; }, 20);
    }
}

navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-target');
        if(target) {
            if (target === 'profile-screen' && auth.currentUser) {
                activeProfileUid = auth.currentUser.uid;
                loadUserProfileData(auth.currentUser.uid);
            }
            if (target === 'chat-screen') {
                loadChatInboxInboxThreads();
            }
            if (target === 'search-screen') {
                loadExploreGridFeed();
            }
            switchActiveTabScreen(target);
        }
    });
});

if(openUploadBtn) openUploadBtn.addEventListener('click', () => uploadModal.classList.add('open'));
if(closeUploadBtn) closeUploadBtn.addEventListener('click', () => uploadModal.classList.remove('open'));
if(closeModalBtn) closeModalBtn.addEventListener('click', () => editModal.classList.remove('open'));

if (notificationBellIcon) {
    notificationBellIcon.style.cursor = "pointer";
    notificationBellIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = document.getElementById('notification-drawer').classList.contains('open');
        toggleDrawer('notification-drawer', !isOpen);
    });
}

// --- CLOUDINARY UNCRYPTED MEDIA PIPELINE ---
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "Sastagram_upload");

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/l31byz2v/image/upload`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        return data.secure_url || null;
    } catch (err) {
        console.error("Cloudinary Network Error:", err);
        return null;
    }
}

async function uploadVideoToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "Sastagram_upload");

    try {
        const res = await fetch("https://api.cloudinary.com/v1_1/l31byz2v/video/upload", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        return data.secure_url || null;
    } catch (err) {
        console.error("Cloudinary Network Error:", err);
        return null;
    }
}

// --- AUTHENTICATION FLOW MECHANICS ---
if (toggleModeText) {
    toggleModeText.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        primaryBtn.textContent = isLoginMode ? "Log In" : "Sign Up";
        toggleModeText.innerHTML = isLoginMode 
            ? `Don't have an account? <span class="toggle-link">Sign up</span>` 
            : `Already have an account? <span class="toggle-link">Log in</span>`;
    });
}

if (primaryBtn) {
    primaryBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (email === "" || password === "") return alert("Please fill in both email and password fields.");
        if (password.length < 6) return alert("Password must be at least 6 characters.");

        try {
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
                alert("Welcome back!");
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                alert("Account created successfully!");
            }
        } catch (error) {
            alert(error.message);
        }
    });
}

// --- PROFILE STORAGE UPDATER LAYOUT MANAGEMENT ---
if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        const nameVal = document.getElementById('input-edit-name').value.trim();
        const userVal = document.getElementById('input-edit-username').value.trim();
        const bioVal = document.getElementById('input-edit-bio').value.trim();
        const webVal = document.getElementById('input-edit-website').value.trim();
        const picFile = document.getElementById('input-profile-pic').files[0];

        if (!nameVal || !userVal) return alert("Name and Username handles are required.");

        saveProfileBtn.textContent = "Saving...";
        saveProfileBtn.disabled = true;

        let finalImageUrl = "";
        if (picFile) {
            const uploadedUrl = await uploadToCloudinary(picFile);
            if (uploadedUrl) finalImageUrl = uploadedUrl;
        }

        const cleanedUsername = userVal.startsWith('@') ? userVal : `@${userVal}`;
        const profileData = { displayName: nameVal, username: cleanedUsername, bio: bioVal, website: webVal };
        if (finalImageUrl) profileData.photoURL = finalImageUrl;

        try {
            await setDoc(doc(db, "users", user.uid), profileData, { merge: true });
            alert("Profile Saved!");
            editModal.classList.remove('open');
            loadUserProfileData(user.uid);
        } catch (err) {
            alert(err.message);
        } finally {
            saveProfileBtn.textContent = "Done";
            saveProfileBtn.disabled = false;
        }
    });
}

// --- REAL-TIME PROFILE RENDERING & NAVIGATION ---
async function loadUserProfileData(uid) {
    try {
        activeProfileUid = uid; 
        const docSnap = await getDoc(doc(db, "users", uid));
        const loggedInUser = auth.currentUser;
        
        const usernameDisplay = document.getElementById('profile-top-username');
        const nameDisplay = document.getElementById('bio-display-name');
        const bioDisplay = document.getElementById('bio-display-text');
        const statBoxes = document.querySelectorAll('.stat-box strong');
        const gridContainer = document.getElementById('profile-posts-grid');

        if (gridContainer) {
            gridContainer.innerHTML = '<div class="skeleton-box" style="aspect-ratio:1/1;"></div><div class="skeleton-box" style="aspect-ratio:1/1;"></div><div class="skeleton-box" style="aspect-ratio:1/1;"></div>';
        }

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (usernameDisplay) usernameDisplay.textContent = data.username || "@username";
            if (nameDisplay) nameDisplay.textContent = data.displayName || "Full Name";
            if (bioDisplay) bioDisplay.textContent = data.bio || "No bio description set yet.";
            
            if (statBoxes[1]) statBoxes[1].textContent = data.followersCount || 0;
            if (statBoxes[2]) statBoxes[2].textContent = data.followingCount || 0;

            const linkElement = document.getElementById('bio-display-link');
            if (linkElement) {
                if (data.website) {
                    linkElement.href = data.website;
                    linkElement.style.display = "inline-block";
                    linkElement.innerHTML = `<i class="fa-solid fa-link"></i> ${data.website.replace(/(^\w+:|^)\/\//, '')}`;
                } else {
                    linkElement.style.display = "none";
                }
            }

            const avatar = document.getElementById('profile-display-avatar');
            if (avatar) {
                if (data.photoURL) {
                    avatar.style.background = `url('${data.photoURL}') center/cover`;
                    avatar.textContent = "";
                } else {
                    avatar.style.background = "#262626";
                    avatar.textContent = data.displayName ? data.displayName.charAt(0).toUpperCase() : "?";
                }
            }
        }

        const actionButtonArea = document.querySelector('.profile-action-buttons');
        if (actionButtonArea) {
            if (loggedInUser && loggedInUser.uid === uid) {
                actionButtonArea.innerHTML = `<button class="edit-profile-btn" id="open-edit-modal-btn">Edit Profile</button>`;
            } else {
                actionButtonArea.innerHTML = `
                    <div style="display:flex; gap:8px;">
                        <button class="edit-profile-btn" id="profile-follow-action-btn" style="flex:1;">Follow</button>
                        <button class="edit-profile-btn" id="profile-message-action-btn" style="flex:1; background:#0095f6; color:#ffffff; border:none;">Message</button>
                    </div>
                `;
                
                const followActionBtn = document.getElementById('profile-follow-action-btn');
                await updateFollowButtonUI(uid, followActionBtn);

                const messageActionBtn = document.getElementById('profile-message-action-btn');
                if (messageActionBtn) {
                    messageActionBtn.addEventListener('click', () => {
                        const recipientUsername = usernameDisplay ? usernameDisplay.textContent : "@user";
                        switchActiveTabScreen('chat-screen');
                        openDirectActiveConversationLog(uid, recipientUsername);

                        const chatPane = document.getElementById('active-chat-fullscreen-pane');
                        if (chatPane) chatPane.style.left = '0%';
                    });
                }
            }
        }

        if (profilePostsUnsubscribe) profilePostsUnsubscribe();

        const postsQuery = query(collection(db, "posts"), where("uid", "==", uid));

        profilePostsUnsubscribe = onSnapshot(postsQuery, (snapshot) => {
            if (!gridContainer) return;
            gridContainer.innerHTML = '';
            
            snapshot.forEach((postDoc) => {
                const post = postDoc.data();
                const gridItem = document.createElement('div');
                gridItem.classList.add('grid-post-item');
                
                if (post.mediaType === "video" || post.type === "video") {
                    gridItem.classList.add('is-video');
                    gridItem.innerHTML = `<video src="${post.postMedia}#t=0.1" preload="metadata" muted playsinline></video>`;
                } else {
                    gridItem.style.background = `url('${post.postMedia}') center/cover`;
                }
                
                gridItem.style.aspectRatio = "1 / 1";
                gridItem.style.cursor = "pointer";

                gridItem.addEventListener('click', () => {
                    switchActiveTabScreen('home-screen');
                    setTimeout(() => {
                        const targetPostCard = document.querySelector(`.home-post-card [data-id="${postDoc.id}"]`);
                        if (targetPostCard) {
                            targetPostCard.closest('.home-post-card').scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 100);
                });

                gridContainer.appendChild(gridItem);
            });

            if (statBoxes && statBoxes[0]) {
                statBoxes[0].textContent = snapshot.size;
            }
        });

    } catch (err) {
        console.error("Error fetching user data:", err);
    }
}

// --- GLOBAL DELEGATED ACTION LISTENERS ---
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'open-edit-modal-btn') {
        if (editModal) editModal.classList.add('open');
    }

    if (e.target && e.target.id === 'profile-follow-action-btn') {
        if (activeProfileUid) {
            await toggleFollowStatus(activeProfileUid, e.target);
        }
    }
});

// --- FOLLOW / UNFOLLOW ENGINE BACKEND LOGIC ---
async function updateFollowButtonUI(targetUserId, buttonElement) {
    const user = auth.currentUser;
    if (!user || !buttonElement) return;

    const followDocId = `${user.uid}_${targetUserId}`;
    const followDocSnap = await getDoc(doc(db, "follows", followDocId));

    if (followDocSnap.exists()) {
        buttonElement.textContent = "Following";
        buttonElement.style.backgroundColor = "#262626";
        buttonElement.style.color = "#ffffff";
    } else {
        buttonElement.textContent = "Follow";
        buttonElement.style.backgroundColor = "#0095f6";
        buttonElement.style.color = "#ffffff";
    }
}

async function toggleFollowStatus(targetUserId, buttonElement) {
    const user = auth.currentUser;
    if (!user) return alert("Log in to follow accounts!");
    if (user.uid === targetUserId) return;

    buttonElement.disabled = true;
    const followDocId = `${user.uid}_${targetUserId}`;
    const followRef = doc(db, "follows", followDocId);
    
    const myProfileRef = doc(db, "users", user.uid);
    const targetProfileRef = doc(db, "users", targetUserId);

    try {
        const followDocSnap = await getDoc(followRef);
        const myProfileSnap = await getDoc(myProfileRef);
        const myUsername = myProfileSnap.exists() ? myProfileSnap.data().username : "@someone";

        await runTransaction(db, async (transaction) => {
            const myProfileSnapDoc = await transaction.get(myProfileRef);
            const targetProfileSnapDoc = await transaction.get(targetProfileRef);

            const myCurrentFollowing = myProfileSnapDoc.exists() ? (myProfileSnapDoc.data().followingCount || 0) : 0;
            const targetCurrentFollowers = targetProfileSnapDoc.exists() ? (targetProfileSnapDoc.data().followersCount || 0) : 0;

            if (followDocSnap.exists()) {
                transaction.delete(followRef);
                transaction.update(myProfileRef, { followingCount: Math.max(0, myCurrentFollowing - 1) });
                transaction.update(targetProfileRef, { followersCount: Math.max(0, targetCurrentFollowers - 1) });
            } else {
                transaction.set(followRef, { followerId: user.uid, followingId: targetUserId, timestamp: new Date() });
                transaction.update(myProfileRef, { followingCount: myCurrentFollowing + 1 });
                transaction.update(targetProfileRef, { followersCount: targetCurrentFollowers + 1 });
                
                const notifRef = doc(collection(db, "notifications"));
                transaction.set(notifRef, {
                    targetUid: targetUserId,
                    senderUid: user.uid,
                    senderUsername: myUsername,
                    type: "follow",
                    text: "started following you.",
                    timestamp: new Date()
                });
            }
        });

        await updateFollowButtonUI(targetUserId, buttonElement);
    } catch (err) {
        console.error("Follow Transaction Error:", err);
    } finally {
        buttonElement.disabled = false;
    }
}

if(logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            alert("Logged out safely!");
            window.location.reload();
        });
    });
}

// --- CREATING POST INTERACTION MANAGER ---
if (publishPostBtn) {
    publishPostBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return alert("Log in first!");

        const captionVal = document.getElementById('input-post-caption').value.trim();
        const mediaFileInput = document.getElementById("input-post-pic");
        const mediaFile = mediaFileInput ? mediaFileInput.files[0] : null;

        if (!mediaFile) return alert("Please select a media to share!");

        publishPostBtn.textContent = "Uploading...";
        publishPostBtn.disabled = true;

        let mediaUrl;
        let mediaType;

        if (mediaFile.type.startsWith("video")) {
            mediaUrl = await uploadVideoToCloudinary(mediaFile);
            mediaType = "video";
        } else {
            mediaUrl = await uploadToCloudinary(mediaFile);
            mediaType = "image";
        }

        if (!mediaUrl) {
            alert("Failed to upload media.");
            publishPostBtn.textContent = "Share";
            publishPostBtn.disabled = false;
            return;
        }

        try {
            const userProfile = await getDoc(doc(db, "users", user.uid));
            const username = userProfile.exists() ? userProfile.data().username : "@anonymous";
            const userPhoto = userProfile.exists() ? userProfile.data().photoURL || "" : "";

            await addDoc(collection(db, "posts"), {
                uid: user.uid,
                username: username,
                userPhoto: userPhoto,
                postMedia: mediaUrl,
                mediaType: mediaType,
                type: mediaType,
                caption: captionVal,
                likesCount: 0,
                timestamp: new Date()
            });

            alert("Post Shared Successfully!");
            if (uploadModal) uploadModal.classList.remove('open');
            document.getElementById('input-post-caption').value = "";
            document.getElementById('input-post-pic').value = "";
        } catch (err) {
            alert(err.message);
        } finally {
            publishPostBtn.textContent = "Share";
            publishPostBtn.disabled = false;
        }
    });
}

// --- LIKES INTERACTION HANDLER ---
async function togglePostLike(postId, heartIcon, counterSpan) {
    const user = auth.currentUser;
    if (!user) return;

    const likeDocRef = doc(db, "posts", postId, "likes", user.uid);
    const postDocRef = doc(db, "posts", postId);

    try {
        const likeSnap = await getDoc(likeDocRef);
        const postSnap = await getDoc(postDocRef);
        const postData = postSnap.exists() ? postSnap.data() : null;
        
        const myProfileSnap = await getDoc(doc(db, "users", user.uid));
        const myUsername = myProfileSnap.exists() ? myProfileSnap.data().username : "@someone";

        if (likeSnap.exists()) {
            await deleteDoc(likeDocRef);
            await updateDoc(postDocRef, { likesCount: increment(-1) });
            heartIcon.className = "fa-regular fa-heart";
            heartIcon.style.color = "#ffffff";
            heartIcon.style.transform = "scale(1)";
        } else {
            await setDoc(likeDocRef, { timestamp: new Date() });
            await updateDoc(postDocRef, { likesCount: increment(1) });
            heartIcon.className = "fa-solid fa-heart";
            heartIcon.style.color = "#ff3040";
            
            heartIcon.style.transform = "scale(1.3)";
            setTimeout(() => { heartIcon.style.transform = "scale(1)"; }, 200);

            if (postData && postData.uid !== user.uid) {
                await addDoc(collection(db, "notifications"), {
                    targetUid: postData.uid,
                    senderUid: user.uid,
                    senderUsername: myUsername,
                    type: "like",
                    text: "liked your post.",
                    timestamp: new Date()
                });
            }
        }
    } catch (err) {
        console.error("Like Action Error:", err);
    }
}

// --- POPUP MODAL COMMENT SYSTEM ---
let currentActivePostForModal = null;

async function handleSimpleComment(postId) {
    const user = auth.currentUser;
    if (!user) return alert("Please log in to view and post comments!");

    currentActivePostForModal = postId;
    const overlay = document.getElementById('comments-modal-overlay');
    const container = document.getElementById('modal-comments-list');
    if (!overlay || !container) return;

    overlay.style.display = 'flex';
    container.innerHTML = '<p style="text-align:center; color:#8e8e93; font-size:13px; margin-top:20px;">Loading comments...</p>';

    // Fetch and listen live to comments for this post
    const commentsQuery = query(collection(db, "posts", postId, "comments"), orderBy("timestamp", "asc"));
    
    getDocs(commentsQuery).then((snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:#8e8e93; font-size:13px; margin-top:20px;">No comments yet. Be the first!</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const c = docSnap.data();
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `<strong>${c.username || '@user'}</strong> <span>${c.text}</span>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    }).catch((err) => {
        console.error("Error loading comments:", err);
        container.innerHTML = '<p style="text-align:center; color:#ff3b30; font-size:13px; margin-top:20px;">Failed to load comments.</p>';
    });
}

// Close Modal Event Listener (Safe execution without re-declaring variables)
document.getElementById('close-comments-modal-btn')?.addEventListener('click', () => {
    const overlay = document.getElementById('comments-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    currentActivePostForModal = null;
});

// Submit Comment Event Listener (Safe execution without re-declaring variables)
document.getElementById('modal-submit-comment-btn')?.addEventListener('click', async () => {
    const user = auth.currentUser;
    const input = document.getElementById('modal-comment-input');
    if (!user || !input || !currentActivePostForModal) return;

    const text = input.value.trim();
    if (!text) return;

    try {
        const userProfile = await getDoc(doc(db, "users", user.uid));
        const username = userProfile.exists() ? userProfile.data().username : "@anonymous";

        await addDoc(collection(db, "posts", currentActivePostForModal, "comments"), {
            userId: user.uid,
            username: username,
            text: text,
            timestamp: new Date()
        });

        // Append comment directly to popup list
        const container = document.getElementById('modal-comments-list');
        const emptyMsg = container.querySelector('p');
        if (emptyMsg) container.innerHTML = '';

        const div = document.createElement('div');
        div.className = 'comment-item';
        div.innerHTML = `<strong>${username}</strong> <span>${text}</span>`;
        container.appendChild(div);

        input.value = '';
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error("Error adding comment:", err);
    }
});

// --- REAL-TIME ACTIVE TIMELINE LIVE SYNC LISTENER ---
function listenToLiveHomeFeed() {
    const feedContainer = document.querySelector('#home-screen .screen-content');
    if(!feedContainer) return;
    
    const feedQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"));

    onSnapshot(feedQuery, (snapshot) => {
        feedContainer.innerHTML = `<div id="home-stories-strip" class="stories-horizontal-strip"></div>`;

        if (snapshot.empty) {
            feedContainer.insertAdjacentHTML('beforeend', `<p style="text-align: center; margin-top: 50px; color: #8e8e93;">No posts shared yet.</p>`);
            return;
        }

        snapshot.forEach((postDoc) => {
            const post = postDoc.data();
            const card = document.createElement('div');
            card.classList.add('home-post-card');
            
            const avatarStyle = post.userPhoto ? `style="background: url('${post.userPhoto}') center/cover"` : '';
            const avatarInitial = post.userPhoto ? '' : (post.username ? post.username.charAt(1).toUpperCase() : "?");
            const totalLikes = post.likesCount || 0;
            const isMyPost = (auth.currentUser && auth.currentUser.uid === post.uid);

            const isVideo = (post.mediaType === "video" || post.type === "video");

            card.innerHTML = `
                <div class="post-user-row" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="post-avatar" ${avatarStyle}>${avatarInitial}</div>
                        <strong class="user-profile-click-trigger" data-uid="${post.uid}">${post.username || '@anonymous'}</strong>
                    </div>
                    ${isMyPost ? `<i class="fa-solid fa-trash delete-post-trigger" data-id="${postDoc.id}" style="color:#8e8e93; font-size:14px; cursor:pointer; padding:4px 8px;"></i>` : ''}
                </div>
                ${isVideo
                    ? `<video class="post-main-image" autoplay muted loop playsinline controls src="${post.postMedia}"></video>`
                    : `<div class="post-main-image" style="background:url('${post.postMedia}') center/cover"></div>`
                }
                <div class="post-action-strip" style="padding:10px 14px; display:flex; gap:16px; font-size:18px;">
                    <i class="fa-regular fa-heart heart-toggle-trigger" data-id="${postDoc.id}" style="cursor:pointer;"></i>
                    <i class="fa-regular fa-comment comment-drawer-trigger" data-id="${postDoc.id}" style="cursor:pointer;"></i>
                    <i class="fa-regular fa-paper-plane share-post-trigger" style="cursor:pointer;"></i>
                </div>
                <div class="post-caption-box">
                    <p style="font-weight: 600; margin-bottom: 4px; font-size: 13px;"><span class="likes-count">${totalLikes}</span> likes</p>
                    <p><strong>${post.username || '@anonymous'}</strong> ${post.caption || ''}</p>
                </div>
            `;
            
            const heartIcon = card.querySelector('.heart-toggle-trigger');
            const counterSpan = card.querySelector('.likes-count');
            const commentIcon = card.querySelector('.comment-drawer-trigger');
            const profileClick = card.querySelector('.user-profile-click-trigger');

            if (auth.currentUser) {
                getDoc(doc(db, "posts", postDoc.id, "likes", auth.currentUser.uid)).then((likeSnap) => {
                    if (likeSnap.exists()) {
                        heartIcon.className = "fa-solid fa-heart";
                        heartIcon.style.color = "#ff3040";
                    }
                });
            }

            heartIcon.addEventListener('click', () => togglePostLike(postDoc.id, heartIcon, counterSpan));
            commentIcon.addEventListener('click', () => handleSimpleComment(postDoc.id));

            
            profileClick.addEventListener('click', () => {
                const targetedUid = profileClick.getAttribute('data-uid');
                loadUserProfileData(targetedUid);
                switchActiveTabScreen('profile-screen');
            });

            if (isMyPost) {
                const deleteTrigger = card.querySelector('.delete-post-trigger');
                if (deleteTrigger) {
                    deleteTrigger.addEventListener('click', async () => {
                        if (confirm("Delete this post feed item?")) {
                            await deleteDoc(doc(db, "posts", postDoc.id));
                            alert("Post removed.");
                        }
                    });
                }
            }

            feedContainer.appendChild(card);
        });
    });
}

// --- DYNAMIC EXPLORE GRID & LIVE USER SEARCH SYSTEM ---
async function loadExploreGridFeed() {
    const searchContentContainer = document.querySelector('#search-screen .screen-content');
    if (!searchContentContainer) return;

    searchContentContainer.innerHTML = ''; 
    const exploreGrid = document.createElement('div');
    exploreGrid.className = "posts-grid-container";
    exploreGrid.id = "explore-media-masonry";
    searchContentContainer.appendChild(exploreGrid);

    try {
        const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(24));
        const snapshot = await getDocs(postsQuery);
        exploreGrid.innerHTML = ''; 
        
        if (snapshot.empty) {
            exploreGrid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: #8e8e93; padding-top: 40px; font-size: 13px;">No discoverable posts yet.</p>`;
            return;
        }

        snapshot.forEach((postDoc) => {
            const post = postDoc.data();
            const gridItem = document.createElement('div');
            gridItem.classList.add('grid-post-item');
            
            if (post.mediaType === "video" || post.type === "video") {
                gridItem.classList.add('is-video');
                gridItem.innerHTML = `<video src="${post.postMedia}#t=0.1" preload="metadata" muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>`;
            } else {
                gridItem.style.background = `url('${post.postMedia}') center/cover`;
            }
            
            gridItem.style.aspectRatio = "1 / 1";
            gridItem.style.cursor = "pointer";

            gridItem.addEventListener('click', () => {
                loadUserProfileData(post.uid);
                switchActiveTabScreen('profile-screen');
            });

            exploreGrid.appendChild(gridItem);
        });
    } catch (err) {
        console.error("Explore Grid Loader Error:", err);
    }
}

// GLOBAL DELEGATED SEARCH INPUT LISTENER
document.addEventListener('input', async (e) => {
    if (e.target && e.target.matches('.search-bar-wrapper input')) {
        const queryText = e.target.value.trim().toLowerCase();
        const searchContentContainer = document.querySelector('#search-screen .screen-content');
        if (!searchContentContainer) return;

        if (queryText === '') {
            loadExploreGridFeed();
            return;
        }

        searchContentContainer.innerHTML = ''; 

        try {
            const usersRef = collection(db, "users");
            const querySnapshot = await getDocs(usersRef);
            
            const renderedUserUids = new Set();
            let matchedUsersFound = false;

            querySnapshot.forEach((userDoc) => {
                const userId = userDoc.id;
                if (renderedUserUids.has(userId)) return;

                const userData = userDoc.data();
                const dbUsername = (userData.username || '').toLowerCase();
                const dbDisplayName = (userData.displayName || '').toLowerCase();

                if (dbUsername.includes(queryText) || dbDisplayName.includes(queryText)) {
                    renderedUserUids.add(userId);
                    matchedUsersFound = true;
                    
                    const userRow = document.createElement('div');
                    userRow.classList.add('drawer-item-row');
                    userRow.style.cursor = "pointer";
                    userRow.style.borderBottom = "1px solid #1a1a1a";

                    const avatarStyle = userData.photoURL ? `style="background: url('${userData.photoURL}') center/cover"` : '';
                    const avatarInitial = userData.photoURL ? '' : (userData.displayName ? userData.displayName.charAt(0).toUpperCase() : "?");

                    userRow.innerHTML = `
                        <div class="mini-avatar" ${avatarStyle}>${avatarInitial}</div>
                        <div class="item-text">
                            <strong>${userData.username || '@username'}</strong><br>
                            <span style="color: #8e8e93; font-size: 12px;">${userData.displayName || ''}</span>
                        </div>
                    `;

                    userRow.addEventListener('click', () => {
                        loadUserProfileData(userId);
                        switchActiveTabScreen('profile-screen');
                    });

                    searchContentContainer.appendChild(userRow);
                }
            });

            if (!matchedUsersFound) {
                searchContentContainer.innerHTML = `<p style="text-align: center; color: #8e8e93; margin-top: 30px; font-size: 13px;">No accounts found.</p>`;
            }

        } catch (err) {
            console.error("Search Query Error:", err);
        }
    }
});

// --- COMPLETE CHAT & THREAD MANAGEMENT ---
async function loadChatInboxInboxThreads() {
    const inboxList = document.getElementById('chat-threads-sidebar');
    if (!inboxList || !auth.currentUser) return;
    
    inboxList.innerHTML = '<p style="font-size:11px; color:#8e8e93; text-align:center; padding:10px;">Loading chats...</p>';
    const myUid = auth.currentUser.uid;

    try {
        const userThreadsRef = collection(db, "users", myUid, "conversations");
        const snapshot = await getDocs(userThreadsRef);
        
        inboxList.innerHTML = ''; 

        if (snapshot.empty) {
            inboxList.innerHTML = `<p style="font-size:11px; color:var(--text-secondary); text-align:center; padding:20px 10px;">No chats yet.<br>Search someone to start messaging!</p>`;
            return;
        }

        snapshot.forEach(async (threadDoc) => {
            const threadData = threadDoc.data();
            const recipientUid = threadData.recipientUid;

            const recipientSnap = await getDoc(doc(db, "users", recipientUid));
            if (recipientSnap.exists()) {
                const uData = recipientSnap.data();
                
                const threadRow = document.createElement('div');
                threadRow.className = "sidebar-user-row";
                threadRow.style.cursor = "pointer";
                
                const avatarStyle = uData.photoURL ? `style="background: url('${uData.photoURL}') center/cover"` : '';
                const avatarInitial = uData.photoURL ? '' : (uData.displayName ? uData.displayName.charAt(0).toUpperCase() : "?");

                threadRow.innerHTML = `
                    <div class="chat-avatar" ${avatarStyle} style="width:48px; height:48px; border-radius:50%; background:#262626; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#fff;">${avatarInitial}</div>
                    <span style="font-size:11px; color:var(--text-secondary); margin-top:4px; max-width:65px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${uData.username || '@user'}</span>
                `;

                threadRow.addEventListener('click', () => {
                    openDirectActiveConversationLog(recipientUid, uData.username || '@user');
                });

                inboxList.appendChild(threadRow);
            }
        });

    } catch (err) {
        console.error("Inbox Loader Error:", err);
    }
}

function openDirectActiveConversationLog(recipientUid, recipientUsername) {
    activeChatRecipientUid = recipientUid;
    const titleEl = document.getElementById('chat-active-title');
    if (titleEl) titleEl.textContent = recipientUsername;

    const chatViewPane = document.getElementById('chat-box');
    if (!chatViewPane || !auth.currentUser) return;

    if (activeChatUnsubscribe) activeChatUnsubscribe();

    const sharedRoomId = [auth.currentUser.uid, recipientUid].sort().join('_');
    const msgQuery = query(collection(db, "chats", sharedRoomId, "messages"), orderBy("timestamp", "asc"));

    activeChatUnsubscribe = onSnapshot(msgQuery, (snapshot) => {
        chatViewPane.innerHTML = '';
        snapshot.forEach((msgDoc) => {
            const msg = msgDoc.data();
            const bubble = document.createElement('div');
            const typeClass = (msg.senderId === auth.currentUser.uid) ? 'sender' : 'recipient';
            
            let timeString = "";
            if (msg.timestamp) {
                const dateObj = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
                timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            bubble.className = `bubble ${typeClass}`;
            bubble.innerHTML = `
                <span class="msg-text">${msg.text}</span>
                <span class="msg-time" style="font-size: 9px; opacity: 0.7; margin-top: 4px; display: block; text-align: right;">${timeString}</span>
            `;
            chatViewPane.appendChild(bubble);
        });
        chatViewPane.scrollTop = chatViewPane.scrollHeight;
    });
}

const sendChatBtn = document.getElementById('send-msg-btn');
const chatInputField = document.getElementById('chat-input-field');

if (sendChatBtn && chatInputField) {
    sendChatBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        const textStr = chatInputField.value.trim();

        if (!user || textStr === "" || !activeChatRecipientUid) return;

        const sharedRoomId = [user.uid, activeChatRecipientUid].sort().join('_');
        
        try {
            await addDoc(collection(db, "chats", sharedRoomId, "messages"), {
                senderId: user.uid,
                text: textStr,
                timestamp: new Date()
            });

            await setDoc(doc(db, "users", user.uid, "conversations", activeChatRecipientUid), {
                recipientUid: activeChatRecipientUid,
                lastUpdated: new Date()
            }, { merge: true });

            await setDoc(doc(db, "users", activeChatRecipientUid, "conversations", user.uid), {
                recipientUid: user.uid,
                lastUpdated: new Date()
            }, { merge: true });

            chatInputField.value = '';
        } catch (err) {
            console.error("Message Dispatch Error:", err);
        }
    });

    chatInputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatBtn.click();
    });
}

const homeChatIcon = document.querySelector('.screen-header .fa-regular.fa-paper-plane');
if(homeChatIcon) {
    homeChatIcon.style.cursor = "pointer";
    homeChatIcon.addEventListener('click', () => {h
        switchActiveTabScreen('chat-screen');
        loadChatInboxInboxThreads();
    });
}
// --- DYNAMIC REELS LOADER (SHOWS BOTH POSTED VIDEOS & YOUTUBE SHORTS) ---
async function loadSastagramReels() {
    const container = document.getElementById('reels-feed-container');
    if (!container) return;

    container.innerHTML = '<p style="color:#fff; text-align:center; padding-top:40vh;">Loading Reels...</p>';

    try {
        container.innerHTML = '';
        let foundReels = false;

        // 1. FETCH UPLOADED VIDEO POSTS FROM "posts" COLLECTION
        const postsSnapshot = await getDocs(collection(db, "posts"));

        postsSnapshot.forEach((docSnap) => {
            const post = docSnap.data();

            // Check if the post is a video
            const isVideo = post.mediaType === 'video' || 
                            post.type === 'video' || 
                            (post.postMedia && post.postMedia.match(/\.(mp4|webm|mov|ogg)$/i)) ||
                            (post.imageUrl && post.imageUrl.match(/\.(mp4|webm|mov|ogg)$/i));

            if (isVideo) {
                foundReels = true;
                const videoUrl = post.postMedia || post.imageUrl;
                renderReelCard(container, {
                    type: 'video',
                    videoUrl: videoUrl,
                    username: post.username || '@user',
                    userAvatar: post.userPhoto || post.userAvatar || 'https://via.placeholder.com/150',
                    caption: post.caption || '',
                    likesCount: post.likesCount || 0,
                    commentsCount: post.commentsCount || 0
                });
            }
        });

        // 2. FETCH YOUTUBE SHORTS FROM "reels" COLLECTION
        const reelsSnapshot = await getDocs(collection(db, "reels"));
        reelsSnapshot.forEach((docSnap) => {
            foundReels = true;
            const reel = docSnap.data();
            renderReelCard(container, reel);
        });

        // If no video posts or reels were found
        if (!foundReels) {
            container.innerHTML = `
                <div style="text-align:center; padding-top:40vh; color:#8e8e93;">
                    <i class="fa-solid fa-film" style="font-size:40px; margin-bottom:12px;"></i>
                    <p>No video reels uploaded yet.<br>Upload an MP4 video or add YouTube Shorts!</p>
                </div>`;
            return;
        }

        // Auto-Play / Auto-Pause HTML5 videos on vertical scroll
        setupReelsAutoplayObserver();

    } catch (err) {
        console.error("Error loading reels:", err);
        container.innerHTML = '<p style="color:#ff3b30; text-align:center; padding-top:40vh;">Failed to load reels.</p>';
    }
}

// Helper function to render a single Reel Card
function renderReelCard(container, reel) {
    const reelCard = document.createElement('div');
    reelCard.className = 'reel-card';

    let mediaHTML = '';

    if (reel.type === 'youtube') {
        mediaHTML = `
            <iframe 
                class="reel-media-content" 
                src="https://www.youtube.com/embed/${reel.youtubeId}?autoplay=0&loop=1&controls=0&mute=0&rel=0&playlist=${reel.youtubeId}" 
                allow="autoplay; encrypted-media" 
                allowfullscreen>
            </iframe>`;
    } else {
        mediaHTML = `
            <video class="reel-media-content" loop playsinline autoplay>
                <source src="${reel.videoUrl}" type="video/mp4">
            </video>`;
    }

    reelCard.innerHTML = `
        ${mediaHTML}

        <!-- RIGHT SIDE ACTION BAR -->
        <div class="reel-actions-overlay">
            <button class="reel-action-btn"><i class="fa-regular fa-heart"></i><span>${reel.likesCount || 0}</span></button>
            <button class="reel-action-btn"><i class="fa-regular fa-comment"></i><span>${reel.commentsCount || 0}</span></button>
            <button class="reel-action-btn"><i class="fa-regular fa-paper-plane"></i></button>
        </div>

        <!-- BOTTOM USER INFO -->
        <div class="reel-user-info">
            <div class="reel-user-header">
                <img class="reel-user-avatar" src="${reel.userAvatar || 'https://via.placeholder.com/150'}" alt="Avatar">
                <span class="reel-username">${reel.username || '@user'}</span>
            </div>
            <p class="reel-caption">${reel.caption || ''}</p>
        </div>
    `;

    container.appendChild(reelCard);
}

// Auto-Play / Auto-Pause HTML5 videos on vertical scroll
function setupReelsAutoplayObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (video) {
                if (entry.isIntersecting) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            }
        });
    }, { threshold: 0.8 });

    document.querySelectorAll('.reel-card').forEach(card => observer.observe(card));
}
// --- NAVIGATION CONTROLLER & SCREEN SWITCHING ---

// 1. REELS BUTTON CLICKED
document.getElementById('nav-reels-btn')?.addEventListener('click', () => {
    // Hide Main Home Feed / Other Screens
    const appMain = document.getElementById('app-main');
    if (appMain) appMain.style.display = 'none';

    // Show Fullscreen Reels Section
    const reelsScreen = document.getElementById('reels-screen');
    if (reelsScreen) reelsScreen.style.display = 'block';

    // Update active icon highlights in bottom nav
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('nav-reels-btn')?.classList.add('active');

    // Load the dynamic hybrid reels (HTML5 + YouTube Shorts)
    loadSastagramReels();
});

// 2. HOME BUTTON CLICKED (Return back from Reels to Feed)
document.getElementById('nav-home-btn')?.addEventListener('click', () => {
    // Hide Reels Screen
    const reelsScreen = document.getElementById('reels-screen');
    if (reelsScreen) reelsScreen.style.display = 'none';

    // Show Main App Feed
    const appMain = document.getElementById('app-main');
    if (appMain) appMain.style.display = 'block';

    // Update active icon highlights
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('nav-home-btn')?.classList.add('active');
});
// TOP RIGHT PAPER PLANE (Direct Messages) BUTTON
document.getElementById('top-direct-msg-btn')?.addEventListener('click', () => {
    // 1. Hide Reels screen if active
    const reelsScreen = document.getElementById('reels-screen');
    if (reelsScreen) reelsScreen.style.display = 'none';

    // 2. Display main container & chat screen
    const appMain = document.getElementById('app-main');
    if (appMain) appMain.style.display = 'block';

    if (typeof switchActiveTabScreen === 'function') {
        switchActiveTabScreen('chat-screen');
    } else {
        document.querySelectorAll('.screen-view').forEach(s => s.style.display = 'none');
        const chatScreen = document.getElementById('chat-screen');
        if (chatScreen) chatScreen.style.display = 'block';
    }

    // 3. Highlight navigation tab
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.nav-tab[data-target="chat-screen"]')?.classList.add('active');

    // 4. Fetch and render real-time latest chats
    loadChatInboxInboxThreads();
});
// Trigger hidden file input when clicking the media box
document.getElementById('media-drop-trigger')?.addEventListener('click', (e) => {
    // Prevent recursive loop if user clicks directly on input element
    if (e.target.id !== 'input-post-pic') {
        document.getElementById('input-post-pic').click();
    }
});

// Update the box preview text when a file is selected
document.getElementById('input-post-pic')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const previewBox = document.getElementById('drop-zone-preview-box');
    if (file && previewBox) {
        previewBox.querySelector('span').textContent = `Selected: ${file.name}`;
        previewBox.querySelector('p').textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to share`;
    }
});
