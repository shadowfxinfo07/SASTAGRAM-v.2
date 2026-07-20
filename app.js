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
        screen.style.opacity = '0'; // For smooth transition fade-in loops
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

// Toggle Drawer Panels Layout Indicator
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
        
        if (data.secure_url) {
            return data.secure_url; 
        } else {
            console.error("Cloudinary Server Error:", data.error?.message);
            return null;
        }
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
        const res = await fetch(
            "https://api.cloudinary.com/v1_1/l31byz2v/video/upload",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await res.json();
        return data.secure_url || null;

    } catch (err) {
        console.error("Cloudinary Network Error:",err);
        return null;
    }
}

// --- AUTHENTICATION FLOW MECHANICS ---
toggleModeText.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    primaryBtn.textContent = isLoginMode ? "Log In" : "Sign Up";
    toggleModeText.innerHTML = isLoginMode 
        ? `Don't have an account? <span class="toggle-link">Sign up</span>` 
        : `Already have an account? <span class="toggle-link">Log in</span>`;
});

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
        console.error("Auth Error:", error.code);
        if (error.code === 'auth/invalid-credential') {
            alert("Invalid email or password. Please try again.");
        } else if (error.code === 'auth/invalid-email') {
            alert("Please enter a valid email address.");
        } else {
            alert(error.message);
        }
    }
});

// --- PROFILE STORAGE UPDATER LAYOUT MANAGEMENT ---
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

        // FIXED: Inject micro-skeletons inside the posts grid during loading states
        const gridContainer = document.getElementById('profile-posts-grid');
        if(gridContainer) gridContainer.innerHTML = '<div class="skeleton-box" style="aspect-ratio:1/1;"></div><div class="skeleton-box" style="aspect-ratio:1/1;"></div><div class="skeleton-box" style="aspect-ratio:1/1;"></div>';

        if (docSnap.exists()) {
            const data = docSnap.data();
            usernameDisplay.textContent = data.username || "@username";
            nameDisplay.textContent = data.displayName || "Full Name";
            bioDisplay.textContent = data.bio || "No bio description set yet.";
            
            statBoxes[1].textContent = data.followersCount || 0;
            statBoxes[2].textContent = data.followingCount || 0;

            const linkElement = document.getElementById('bio-display-link');
            if (data.website) {
                linkElement.href = data.website;
                linkElement.style.display = "inline-block";
                linkElement.innerHTML = `<i class="fa-solid fa-link"></i> ${data.website.replace(/(^\w+:|^)\/\//, '')}`;
            } else {
                linkElement.style.display = "none";
            }

            const avatar = document.getElementById('profile-display-avatar');
            if (data.photoURL) {
                avatar.style.background = `url('${data.photoURL}') center/cover`;
                avatar.textContent = "";
            } else {
                avatar.style.background = "#262626";
                avatar.textContent = data.displayName ? data.displayName.charAt(0).toUpperCase() : "?";
            }
        }

        const actionButtonArea = document.querySelector('.profile-action-buttons');
        if (loggedInUser && loggedInUser.uid === uid) {
            actionButtonArea.innerHTML = `<button class="edit-profile-btn" id="open-edit-modal-btn">Edit Profile</button>`;
        } else {
            actionButtonArea.innerHTML = `<button class="edit-profile-btn" id="profile-follow-action-btn">Follow</button>`;
            const followActionBtn = document.getElementById('profile-follow-action-btn');
            await updateFollowButtonUI(uid, followActionBtn);
        }
        
        // Load User's Grid Posts
        if (profilePostsUnsubscribe) profilePostsUnsubscribe();
        const postsQuery = query(collection(db, "posts"), where("uid", "==", uid));
        profilePostsUnsubscribe = onSnapshot(postsQuery, (snapshot) => {
            if(!gridContainer) return;
            gridContainer.innerHTML = '';
            
            snapshot.forEach((postDoc) => {
                const post = postDoc.data();
                const gridItem = document.createElement('div');
                gridItem.classList.add('grid-post-item');
                if (post.type === "video") {
    gridItem.innerHTML = `
        <video src="${post.postMedia}" muted></video>
    `;
} else {
    gridItem.style.background = `url('${post.postMedia}') center/cover`;
}
                
                gridItem.addEventListener('click', async () => {
                    if (loggedInUser && loggedInUser.uid === uid) {
                        if(confirm("Do you want to delete this post?")) {
                            await deleteDoc(doc(db, "posts", postDoc.id));
                            alert("Post deleted successfully.");
                        }
                    }
                });
                gridContainer.appendChild(gridItem);
            });
            if(statBoxes[0]) statBoxes[0].textContent = snapshot.size;
        });

    } catch (err) {
        console.error("Error fetching user data:", err);
    }
}

// --- GLOBAL DELEGATED ACTION LISTENERS ---
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'open-edit-modal-btn') {
        editModal.classList.add('open');
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
        if (activeProfileUid) {
            const statBoxes = document.querySelectorAll('.stat-box strong');
            const updatedProfileSnap = await getDoc(doc(doc(db, "users", activeProfileUid)));
            if (updatedProfileSnap.exists()) {
                statBoxes[1].textContent = updatedProfileSnap.data().followersCount || 0;
                statBoxes[2].textContent = updatedProfileSnap.data().followingCount || 0;
            }
        }

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
publishPostBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return alert("Log in first!");

    const captionVal = document.getElementById('input-post-caption').value.trim();
    const mediaFile = document.getElementById("input-post-pic").files[0];

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
    type: mediaType,
    caption: captionVal,
    likesCount: 0,
    timestamp: new Date()
});

        alert("Post Shared Successfully!");
        uploadModal.classList.remove('open');
        document.getElementById('input-post-caption').value = "";
        document.getElementById('input-post-pic').value = "";
    } catch (err) {
        alert(err.message);
    } finally {
        publishPostBtn.textContent = "Share";
        publishPostBtn.disabled = false;
    }
});

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
            
            // FIXED: Add scale animation on interaction execution
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

// --- DYNAMIC COMMENTS PIPELINE INTERFACES ---
function openCommentsPanel(postId) {
    activePostIdForComments = postId;
    toggleDrawer('comments-drawer', true);

    const commentsContainer = document.getElementById('comments-list-container');
    if (!commentsContainer) return;

    if (commentsUnsubscribe) commentsUnsubscribe();

    const commentsQuery = query(collection(db, "posts", postId, "comments"), orderBy("timestamp", "desc"));
    
    commentsUnsubscribe = onSnapshot(commentsQuery, (snapshot) => {
        commentsContainer.innerHTML = '';
        if (snapshot.empty) {
            commentsContainer.innerHTML = `<p style="text-align: center; color: #8e8e93; margin-top: 20px; font-size: 13px;">No comments yet.</p>`;
            return;
        }

        snapshot.forEach((commentDoc) => {
            const comment = commentDoc.data();
            const commentRow = document.createElement('div');
            commentRow.classList.add('drawer-item-row');
            commentRow.innerHTML = `
                <div class="mini-avatar">${comment.username ? comment.username.charAt(1).toUpperCase() : "?"}</div>
                <div class="item-text"><strong>${comment.username}</strong> <span>${comment.text}</span></div>
            `;
            commentsContainer.appendChild(commentRow);
        });
    });
}

document.addEventListener('click', async (e) => {
    if (e.target && e.target.closest('#submit-comment-btn')) {
        const user = auth.currentUser;
        const inputField = document.getElementById('comment-input-field');
        if (!user || !inputField || !activePostIdForComments) return;

        const textStr = inputField.value.trim();
        if (textStr === "") return;

        try {
            const userProfile = await getDoc(doc(db, "users", user.uid));
            const username = userProfile.exists() ? userProfile.data().username : "@anonymous";

            await addDoc(collection(db, "posts"), {
                userId: user.uid,
                username: username,
                text: textStr,
                timestamp: new Date()
            });
            inputField.value = "";
        } catch (err) {
            console.error("Comment Error:", err);
        }
    }
});

// --- REAL-TIME USER STORIES PIPELINE ---
function listenToLiveUserStories() {
    const storiesContainer = document.getElementById('home-stories-strip');
    if (!storiesContainer) return;

    const storiesQuery = query(collection(db, "stories"), orderBy("timestamp", "desc"));
    onSnapshot(storiesQuery, (snapshot) => {
        storiesContainer.innerHTML = '';
        
        const hiddenStoryInput = document.createElement('input');
        hiddenStoryInput.type = 'file';
        hiddenStoryInput.accept = 'image/*';
        hiddenStoryInput.style.display = 'none';
        storiesContainer.appendChild(hiddenStoryInput);

        const selfBubble = document.createElement('div');
        selfBubble.className = "story-bubble";
        selfBubble.innerHTML = `
            <div class="story-ring" style="background: #262626;"><i class="fa-solid fa-plus" style="font-size:12px; color:#fff;"></i></div>
            <span>Your Story</span>
        `;
        
        selfBubble.addEventListener('click', () => hiddenStoryInput.click());
        
        hiddenStoryInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !auth.currentUser) return;

            alert("Uploading your Sastagram Story...");
            const url = await uploadToCloudinary(file);
            if (!url) return alert("Failed to host story image.");

            const userProfile = await getDoc(doc(db, "users", auth.currentUser.uid));
            const username = userProfile.exists() ? userProfile.data().username : "@user";
            const userPhoto = userProfile.exists() ? userProfile.data().photoURL || "" : "";

            await addDoc(collection(db, "stories"), {
                uid: auth.currentUser.uid,
                username: username,
                userPhoto: userPhoto,
                storyImage: url,
                timestamp: new Date()
            });
            alert("Story Published Successfully!");
        });

        storiesContainer.appendChild(selfBubble);

        const uniqueStoryOwners = new Set();
        snapshot.forEach((storyDoc) => {
            const story = storyDoc.data();
            if (story.uid && !uniqueStoryOwners.has(story.uid)) {
                uniqueStoryOwners.add(story.uid);

                const bubble = document.createElement('div');
                bubble.className = "story-bubble";

                const avatarStyle = story.userPhoto ? `style="background: url('${story.userPhoto}') center/cover"` : '';
                const avatarInitial = story.userPhoto ? '' : (story.username ? story.username.charAt(1).toUpperCase() : "?");

                bubble.innerHTML = `
                    <div class="story-ring" ${avatarStyle}>${avatarInitial}</div>
                    <span>${story.username || '@user'}</span>
                `;

                bubble.addEventListener('click', () => {
                    launchFullscreenStoryView(story.username, story.storyImage, storyDoc.id, story.uid);
                });

                storiesContainer.appendChild(bubble);
            }
        });
    });
}

function launchFullscreenStoryView(username, imageUrl, storyId, ownerUid) {
    let storyModal = document.getElementById('fullscreen-story-modal');
    
    if (!storyModal) {
        storyModal = document.createElement('div');
        storyModal.id = 'fullscreen-story-modal';
        storyModal.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:#000; z-index:9999; display:none; flex-direction:column; justify-content:space-between; padding:16px 0;";
        document.querySelector('.phone-container').appendChild(storyModal);
    }

    const showDeleteBtn = (auth.currentUser && auth.currentUser.uid === ownerUid);

    storyModal.innerHTML = `
        <div class="story-top-bars" style="width:100%; padding:0 10px; display:flex; flex-direction:column; gap:8px;">
            <div class="progress-bg" style="width:100%; height:3px; background:#333; border-radius:2px; overflow:hidden;">
                <div id="story-progress-fill" style="width:0%; height:100%; background:#fff; transition: width 4s linear;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#fff; font-size:13px; font-weight:600; padding-left:4px;">${username}</span>
                <div style="display:flex; align-items:center; gap:12px;">
                    ${showDeleteBtn ? `<i class="fa-solid fa-trash" id="delete-story-modal-btn" style="color:#ff3040; font-size:16px; cursor:pointer; padding:4px;"></i>` : ''}
                    <i class="fa-solid fa-xmark" id="close-story-modal-btn" style="color:#fff; font-size:18px; cursor:pointer; padding:4px 10px;"></i>
                </div>
            </div>
        </div>
        <div style="flex:1; width:100%; background:url('${imageUrl}') center/contain no-repeat; margin:16px 0;"></div>
    `;

    storyModal.style.display = 'flex';
    clearTimeout(storyTimerTimeout);

    setTimeout(() => {
        const fillBar = document.getElementById('story-progress-fill');
        if(fillBar) fillBar.style.width = '100%';
    }, 50);

    const closeStory = () => {
        storyModal.style.display = 'none';
        clearTimeout(storyTimerTimeout);
    };

    document.getElementById('close-story-modal-btn').addEventListener('click', closeStory);
    
    if (showDeleteBtn) {
        document.getElementById('delete-story-modal-btn').addEventListener('click', async () => {
            if (confirm("Delete this story slide?")) {
                closeStory();
                await deleteDoc(doc(db, "stories", storyId));
                alert("Story deleted.");
            }
        });
    }
    
    storyTimerTimeout = setTimeout(closeStory, 4050);
}

// --- REAL-TIME ACTIVE TIMELINE LIVE SYNC LISTENER ---
function listenToLiveHomeFeed() {
    const feedContainer = document.querySelector('#home-screen .screen-content');
    if(!feedContainer) return;
    
    const feedQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"));

    onSnapshot(feedQuery, (snapshot) => {
        feedContainer.innerHTML = `<div id="home-stories-strip" class="stories-horizontal-strip"></div>`;
        listenToLiveUserStories(); 

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

            card.innerHTML = `
                <div class="post-user-row" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="post-avatar" ${avatarStyle}>${avatarInitial}</div>
                        <strong class="user-profile-click-trigger" data-uid="${post.uid}">${post.username || '@anonymous'}</strong>
                    </div>
                    ${isMyPost ? `<i class="fa-solid fa-trash delete-post-trigger" data-id="${postDoc.id}" style="color:#8e8e93; font-size:14px; cursor:pointer; padding:4px 8px;"></i>` : ''}
                </div>
${post.type === "video"
? `<video class="post-main-image" autoplay muted loop playsinline controls
src="${post.postMedia}"></video>`
: `<div class="post-main-image" style="background:url('${post.postMedia}') center/cover"></div>`
}
                <div class="post-action-strip" style="padding:10px 14px; display:flex; gap:16px; font-size:18px;">
                    <i class="fa-regular fa-heart heart-toggle-trigger" data-id="${postDoc.id}" style="cursor:pointer; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);"></i>
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
            const shareIcon = card.querySelector('.share-post-trigger');

            if (auth.currentUser) {
                getDoc(doc(db, "posts", postDoc.id, "likes", auth.currentUser.uid)).then((likeSnap) => {
                    if (likeSnap.exists()) {
                        heartIcon.className = "fa-solid fa-heart";
                        heartIcon.style.color = "#ff3040";
                    }
                });
            }

            // Click Bindings
            heartIcon.addEventListener('click', () => togglePostLike(postDoc.id, heartIcon, counterSpan));
            commentIcon.addEventListener('click', () => openCommentsPanel(postDoc.id));
            
            profileClick.addEventListener('click', () => {
                const targetedUid = profileClick.getAttribute('data-uid');
                loadUserProfileData(targetedUid);
                switchActiveTabScreen('profile-screen');
            });

            shareIcon.addEventListener('click', () => {
                alert(`Link copied! Share Sastagram Post: \n${post.postMedia}`);
            });

            if (isMyPost) {
                card.querySelector('.delete-post-trigger').addEventListener('click', async () => {
                    if (confirm("Delete this post feed item?")) {
                        await deleteDoc(doc(db, "posts", postDoc.id));
                        alert("Post removed.");
                    }
                });
            }

            feedContainer.appendChild(card);
        });
    });
}

// --- DYNAMIC EXPLORE GRID & LIVE USER SEARCH SYSTEM ---
const searchInput = document.querySelector('.search-bar input');
const searchContentContainer = document.querySelector('#search-screen .screen-content');

async function loadExploreGridFeed() {
    if (searchInput && searchInput.value.trim() !== '') return; 
    searchContentContainer.innerHTML = ''; 
    
    const exploreGrid = document.createElement('div');
    exploreGrid.className = "posts-grid-container";
    exploreGrid.id = "explore-media-masonry";
    
    // FIXED: Inject skeletons while public discover grid objects compile
    exploreGrid.innerHTML = '<div class="skeleton-box" style="aspect-ratio:1/1;"></div><div class="skeleton-box" style="aspect-ratio:1/1;"></div><div class="skeleton-box" style="aspect-ratio:1/1;"></div>';
    searchContentContainer.appendChild(exploreGrid);

    try {
        const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(24));
        const snapshot = await getDocs(postsQuery);
        exploreGrid.innerHTML = ''; // Clear out placeholders smoothly
        
        if (snapshot.empty) {
            exploreGrid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: #8e8e93; padding-top: 40px; font-size: 13px;">No discoverable posts yet.</p>`;
            return;
        }

        snapshot.forEach((postDoc) => {
            const post = postDoc.data();
            const gridItem = document.createElement('div');
            gridItem.classList.add('grid-post-item');
            if (post.type === "video") {
    gridItem.innerHTML = `
        <video src="${post.postMedia}" muted></video>
    `;
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

if (searchInput && searchContentContainer) {
    searchInput.addEventListener('input', async (e) => {
        const queryText = e.target.value.trim().toLowerCase();
        if (queryText === '') {
            loadExploreGridFeed();
            return;
        }

        searchContentContainer.innerHTML = ''; 

        try {
            const usersRef = collection(db, "users");
            const querySnapshot = await getDocs(usersRef);
            
            let matchedUsersFound = false;

            querySnapshot.forEach((userDoc) => {
                const userData = userDoc.data();
                const dbUsername = (userData.username || '').toLowerCase();
                const dbDisplayName = (userData.displayName || '').toLowerCase();

                if (dbUsername.includes(queryText) || dbDisplayName.includes(queryText)) {
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
                        loadUserProfileData(userDoc.id);
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
    });
}

// --- REAL-TIME LIVE DIRECT MESSAGING FRAMEWORK ---
async function loadChatInboxInboxThreads() {
    const inboxList = document.getElementById('chat-threads-sidebar');
    if (!inboxList || !auth.currentUser) return;
    inboxList.innerHTML = '';

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((userDoc) => {
            if (userDoc.id !== auth.currentUser.uid) {
                const uData = userDoc.data();
                const threadRow = document.createElement('div');
                threadRow.className = "sidebar-user-row";
                threadRow.style.cursor = "pointer";
                
                const avatarStyle = uData.photoURL ? `style="background: url('${uData.photoURL}') center/cover"` : '';
                const avatarInitial = uData.photoURL ? '' : (uData.displayName ? uData.displayName.charAt(0).toUpperCase() : "?");

                threadRow.innerHTML = `
                    <div class="chat-avatar" ${avatarStyle}>${avatarInitial}</div>
                    <div class="chat-meta-preview">
                        <strong>${uData.username || '@username'}</strong>
                        <span>Tap to open chat thread</span>
                    </div>
                `;

                threadRow.addEventListener('click', () => {
                    openDirectActiveConversationLog(userDoc.id, uData.username || '@username');
                });

                inboxList.appendChild(threadRow);
            }
        });
    } catch (err) {
        console.error("Inbox Threads Loader Error:", err);
    }
}

function openDirectActiveConversationLog(recipientUid, recipientUsername) {
    activeChatRecipientUid = recipientUid;
    document.getElementById('chat-active-title').textContent = recipientUsername;

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
            
            bubble.className = `bubble ${typeClass}`;
            let time = "";

if (msg.timestamp && msg.timestamp.toDate) {
    time = msg.timestamp.toDate().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
} else {
    time = "";
}

bubble.innerHTML = `
<div>${msg.text}</div>
<div class="msg-time">${time}</div>
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
    homeChatIcon.addEventListener('click', () => {
        switchActiveTabScreen('chat-screen');
        loadChatInboxInboxThreads();
    });
}

// --- REAL-TIME ACTIVE NOTIFICATIONS LISTENER PIPELINE (INDEX-FREE) ---
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
    if (user) {
        authOverlay.classList.remove('active');
        switchActiveTabScreen('home-screen');
        activeProfileUid = user.uid; 
        loadUserProfileData(user.uid);
        listenToLiveHomeFeed(); 
        listenToLiveNotifications(user.uid); 
    } else {
        authOverlay.classList.add('active');
        if (notificationsUnsubscribe) notificationsUnsubscribe();
    }
});
// Your existing code...

const dropZone = document.getElementById("media-drop-trigger");
const fileInput = document.getElementById("input-post-pic");

// Paste here
dropZone.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        console.log(file.name);
    }
});

// Rest of your code...