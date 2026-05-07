document.addEventListener('DOMContentLoaded', () => {
    // Supabase Initialization
    const supabaseUrl = 'https://mpsshmlgvrhlqqnqbdkq.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wc3NobWxndnJobHFxbnFiZGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTExNzYsImV4cCI6MjA5MzY2NzE3Nn0.n-wD7D9oWxU8KoHtJCRzH8f6rlrdF4PQOLbYDvgNN6M';
    const supabaseApp = supabase.createClient(supabaseUrl, supabaseKey);

    let appData = {};
    let myIdentity = localStorage.getItem('planMateIdentity');
    let currentUser = myIdentity;

    async function loadData() {
        const { data, error } = await supabaseApp.from('planmate_users').select('*');
        if (data) {
            appData = {};
            data.forEach(user => {
                appData[user.id] = {
                    id: user.id,
                    name: user.name || user.id,
                    avatar: user.avatar,
                    color: user.color,
                    yearlyGoals: user.yearlyGoals || [],
                    monthlyTasks: user.monthlyTasks || []
                };
            });
            if (myIdentity && !appData[myIdentity]) {
                // If profile was lost from server, ask to recreate
                localStorage.removeItem('planMateIdentity');
                myIdentity = null;
                currentUser = Object.keys(appData)[0];
                const welcomeModal = document.getElementById('welcome-modal');
                if (welcomeModal) welcomeModal.classList.add('active');
            } else if (!currentUser && Object.keys(appData).length > 0) {
                currentUser = Object.keys(appData)[0];
            }
            render();
        } else if (error) {
            alert('데이터 로드 실패: ' + error.message);
        }
    }

    // Subscribe to real-time changes
    supabaseApp
        .channel('public:planmate_users')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planmate_users' }, payload => {
            if (payload.eventType === 'DELETE') {
                delete appData[payload.old.id];
                if (currentUser === payload.old.id) currentUser = Object.keys(appData)[0];
            } else {
                const user = payload.new;
                if (user && user.id) {
                    appData[user.id] = {
                        id: user.id,
                        name: user.name || user.id,
                        avatar: user.avatar,
                        color: user.color,
                        yearlyGoals: user.yearlyGoals || [],
                        monthlyTasks: user.monthlyTasks || []
                    };
                }
            }
            render();
        })
        .subscribe();

    loadData();

    const welcomeModal = document.getElementById('welcome-modal');
    const welcomeSaveBtn = document.getElementById('welcome-save-btn');
    const welcomeInputName = document.getElementById('welcome-input-name');
    
    if (welcomeModal) {
        let selectedColor = '#10B981';
        document.querySelectorAll('.color-option').forEach(el => {
            el.addEventListener('click', (e) => {
                document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                selectedColor = e.target.getAttribute('data-color');
            });
        });

        if (!myIdentity) {
            welcomeModal.classList.add('active');
        }

        welcomeSaveBtn.addEventListener('click', () => {
            const name = welcomeInputName.value.trim();
            if (!name) {
                alert('이름을 입력해주세요!');
                return;
            }
            
            myIdentity = name;
            localStorage.setItem('planMateIdentity', myIdentity);
            
            if (!appData[myIdentity]) {
                appData[myIdentity] = {
                    id: myIdentity,
                    name: myIdentity,
                    avatar: myIdentity.substring(0, 2),
                    color: selectedColor,
                    yearlyGoals: [],
                    monthlyTasks: []
                };
                saveData();
            }
            
            currentUser = myIdentity;
            welcomeModal.classList.remove('active');
            render();
        });
    }
    let modalMode = ""; // 'yearly' or 'monthly'

    const friendsContainer = document.getElementById('friends-container');
    const yearlyContainer = document.getElementById('yearly-container');
    const monthlyContainer = document.getElementById('monthly-container');
    const currentUserName = document.getElementById('current-user-name');
    
    // Modal Elements
    const modalOverlay = document.getElementById('add-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInputTitle = document.getElementById('modal-input-title');
    const modalInputDesc = document.getElementById('modal-input-desc');
    const modalCancel = document.getElementById('modal-cancel');
    const modalSave = document.getElementById('modal-save');
    
    document.getElementById('add-yearly-btn').addEventListener('click', () => openModal('yearly'));
    document.getElementById('add-monthly-btn').addEventListener('click', () => openModal('monthly'));


    modalCancel.addEventListener('click', closeModal);
    modalSave.addEventListener('click', saveModalData);

    async function saveData() {
        if (!myIdentity || !appData[myIdentity]) return;
        const myData = appData[myIdentity];
        
        const { error } = await supabaseApp.from('planmate_users').upsert({
            id: myData.id,
            name: myData.name,
            avatar: myData.avatar,
            color: myData.color,
            yearlyGoals: myData.yearlyGoals,
            monthlyTasks: myData.monthlyTasks
        });
        
        if (error) {
            console.error('Supabase Save Error:', error);
            alert(`데이터 저장 실패!\n\n메시지: ${error.message}\n코드: ${error.code}\n힌트: ${error.hint || '없음'}\n\n(Supabase 테이블 생성 및 RLS 설정을 확인해주세요)`);
        }
    }

    function openModal(mode) {
        modalMode = mode;
        modalTitle.textContent = mode === 'yearly' ? '연간 목표 추가' : '월간 계획 추가';
        modalInputTitle.value = '';
        modalInputDesc.value = '';
        const badgeSelect = document.getElementById('modal-input-badge');
        if (mode === 'yearly') {
            badgeSelect.style.display = 'block';
        } else {
            badgeSelect.style.display = 'none';
        }
        modalOverlay.classList.add('active');
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    function saveModalData() {
        const title = modalInputTitle.value.trim();
        const desc = modalInputDesc.value.trim();
        if (!title) {
            alert('제목을 입력해주세요.');
            return;
        }

        const userObj = appData[currentUser];
        const badgeSelect = document.getElementById('modal-input-badge');
        
        if (modalMode === 'yearly') {
            userObj.yearlyGoals.push({
                id: Date.now(),
                title: title,
                badge: badgeSelect.value,
                progress: 0,
                desc: desc
            });
        } else if (modalMode === 'monthly') {
            userObj.monthlyTasks.push({
                id: Date.now(),
                title: title,
                desc: desc,
                completed: false
            });
        }
        
        saveData();
        closeModal();
        render();
    }

    function toggleTask(taskId) {
        const userObj = appData[currentUser];
        const task = userObj.monthlyTasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            saveData();
            renderMonthly(); // re-render to update UI
        }
    }

    window.toggleTask = toggleTask; // make accessible globally for onclick

    function renderFriends() {
        friendsContainer.innerHTML = '';
        Object.keys(appData).forEach(userName => {
            const user = appData[userName];
            const isActive = userName === currentUser;
            const friendHTML = `
                <div class="friend-item ${isActive ? 'active' : ''}" onclick="selectUser('${userName}')">
                    <div class="avatar" style="${isActive ? `border-color: ${user.color}; box-shadow: 0 0 0 3px ${user.color}33; background-color: ${user.color}; color: white;` : `background-color: #CBD5E1; color: white;`}">
                        ${user.avatar}
                    </div>
                    <span class="name">${user.name}</span>
                </div>
            `;
            friendsContainer.innerHTML += friendHTML;
        });
    }

    window.selectUser = function(userName) {
        currentUser = userName;
        render();
    };

    window.getBadgeStyle = function(badgeText) {
        if (badgeText === '취미') return 'background-color: #D1FAE5; color: #059669;'; // Green
        if (badgeText === '운동') return 'background-color: #DBEAFE; color: #1D4ED8;'; // Blue
        if (badgeText === '자기개발' || badgeText === '자기계발' || badgeText === '공부') return 'background-color: #FEF3C7; color: #D97706;'; // Yellow
        return 'background-color: #F1F5F9; color: #475569;'; // Gray
    };

    function renderYearly() {
        yearlyContainer.innerHTML = '';
        if (!currentUser || !appData[currentUser]) return;
        const goals = appData[currentUser].yearlyGoals;
        currentUserName.textContent = appData[currentUser].name;

        if (goals.length === 0) {
            yearlyContainer.innerHTML = '<div class="empty-state">등록된 연간 목표가 없습니다. 우측 + 버튼을 눌러 추가해보세요!</div>';
            return;
        }

        goals.forEach(goal => {
            const goalHTML = `
                <div class="goal-item">
                    <div class="goal-info">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <h3>${goal.title}</h3>
                            <button class="delete-btn" onclick="deleteYearlyGoal(${goal.id}, event)"><i class="ri-delete-bin-line"></i></button>
                        </div>
                        <span class="badge" style="${getBadgeStyle(goal.badge)}">${goal.badge}</span>
                    </div>
                    ${goal.desc ? `<p class="goal-desc-text" style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">${goal.desc}</p>` : ''}
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${goal.progress}%; background-color: var(--primary-color);"></div>
                    </div>
                    <p class="goal-desc">현재 진척도 ${goal.progress}%</p>
                </div>
            `;
            yearlyContainer.innerHTML += goalHTML;
        });

        // Trigger animation
        setTimeout(() => {
            const progressBars = yearlyContainer.querySelectorAll('.progress-bar');
            progressBars.forEach(bar => {
                const targetWidth = bar.style.width;
                bar.style.width = '0%';
                setTimeout(() => { bar.style.width = targetWidth; }, 50);
            });
        }, 10);
    }

    function renderMonthly() {
        monthlyContainer.innerHTML = '';
        if (!currentUser || !appData[currentUser]) return;
        const tasks = appData[currentUser].monthlyTasks;

        if (tasks.length === 0) {
            monthlyContainer.innerHTML = '<div class="empty-state">등록된 월간 계획이 없습니다. 우측 + 버튼을 눌러 추가해보세요!</div>';
            return;
        }

        tasks.forEach(task => {
            const taskHTML = `
                <div class="task-card ${task.completed ? 'completed' : ''}" onclick="toggleTask(${task.id})">
                    <div class="checkbox ${!task.completed ? 'empty' : ''}">
                        ${task.completed ? '<i class="ri-check-line"></i>' : ''}
                    </div>
                    <div class="task-content">
                        <h4>${task.title}</h4>
                        <p>${task.desc}</p>
                    </div>
                    <button class="delete-btn" onclick="deleteMonthlyTask(${task.id}, event)"><i class="ri-delete-bin-line"></i></button>
                </div>
            `;
            monthlyContainer.innerHTML += taskHTML;
        });
    }

    function render() {
        renderFriends();
        renderYearly();
        renderMonthly();
        
        // Also update MY view if it's currently visible
        const viewMy = document.getElementById('view-my');
        if (viewMy && viewMy.style.display !== 'none') {
            renderMyView();
        }
    }

    // Tab Switching Logic
    const navItems = document.querySelectorAll('.nav-item');
    const viewHome = document.getElementById('view-home');
    const viewMy = document.getElementById('view-my');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.querySelector('span').textContent;
            
            if (tabName === 'MY') {
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                viewHome.style.display = 'none';
                viewMy.style.display = 'block';
                renderMyView();
            } else if (tabName === '홈') {
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                viewMy.style.display = 'none';
                viewHome.style.display = 'block';
                render();
            } else {
                alert('해당 기능은 준비 중입니다.');
            }
        });
    });

    // Edit Profile Logic
    const editModal = document.getElementById('edit-profile-modal');
    const editSaveBtn = document.getElementById('edit-save-btn');
    const editCancelBtn = document.getElementById('edit-cancel-btn');
    const editInputName = document.getElementById('edit-input-name');
    let editSelectedColor = '#10B981';

    if (editModal) {
        document.querySelectorAll('.edit-color-option').forEach(el => {
            el.addEventListener('click', (e) => {
                document.querySelectorAll('.edit-color-option').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                editSelectedColor = e.target.getAttribute('data-color');
            });
        });

        window.openEditProfile = function() {
            if (!myIdentity || !appData[myIdentity]) return;
            const myData = appData[myIdentity];
            editInputName.value = myData.name;
            editSelectedColor = myData.color;
            document.querySelectorAll('.edit-color-option').forEach(c => {
                if (c.getAttribute('data-color') === myData.color) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
            editModal.classList.add('active');
        };

        editCancelBtn.addEventListener('click', () => {
            editModal.classList.remove('active');
        });

        editSaveBtn.addEventListener('click', async () => {
            const newName = editInputName.value.trim();
            if (!newName) {
                alert('이름을 입력해주세요!');
                return;
            }

            const oldIdentity = myIdentity;
            const myData = appData[oldIdentity];

            if (newName !== oldIdentity && appData[newName]) {
                alert('이미 다른 사용자가 사용중인 이름입니다.');
                return;
            }

            const updatedData = {
                ...myData,
                id: newName,
                name: newName,
                avatar: newName.substring(0, 2),
                color: editSelectedColor
            };

            if (newName !== oldIdentity) {
                await supabaseApp.from('planmate_users').delete().eq('id', oldIdentity);
                delete appData[oldIdentity];
                myIdentity = newName;
                localStorage.setItem('planMateIdentity', newName);
                currentUser = newName;
            }

            appData[newName] = updatedData;
            await saveData();

            editModal.classList.remove('active');
            render();
        });
    }

    function renderMyView() {
        const container = document.getElementById('my-progress-container');
        container.innerHTML = '';
        if (!currentUser || !appData[currentUser]) return;
        const userObj = appData[currentUser];
        
        if (userObj.yearlyGoals.length === 0) {
            container.innerHTML = '<div class="empty-state">등록된 연간 목표가 없습니다. 홈 화면에서 먼저 추가해주세요.</div>';
            return;
        }

        userObj.yearlyGoals.forEach(goal => {
            let stepsHtml = '';
            for (let i = 25; i <= 100; i += 25) {
                const isChecked = goal.progress >= i;
                stepsHtml += `
                    <div class="step-bar ${isChecked ? 'active' : ''}" 
                         onclick="updateProgress(${goal.id}, ${i})">
                         <span class="step-label">${i}%</span>
                    </div>
                `;
            }

            const html = `
                <div class="yearly-card" style="margin-bottom: 16px;">
                    <div class="goal-info" style="margin-bottom: 8px;">
                        <h3 style="font-size: 16px; font-weight: 600;">${goal.title}</h3>
                        <span style="font-weight: 800; font-size: 18px; color: var(--primary-color);">${goal.progress}%</span>
                    </div>
                    <div class="step-bars-container">
                        ${stepsHtml}
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
    }

    window.updateProgress = function(goalId, stepValue) {
        const userObj = appData[currentUser];
        const goal = userObj.yearlyGoals.find(g => g.id === goalId);
        if (goal) {
            // If clicking the current exact progress, unset it to the previous step or 0
            if (goal.progress === stepValue) {
                goal.progress = stepValue - 25;
            } else {
                goal.progress = stepValue;
            }
            if (goal.progress < 0) goal.progress = 0;
            
            saveData();
            renderMyView(); // Re-render to update checkboxes
        }
    };

    window.deleteYearlyGoal = function(goalId, event) {
        if (event) event.stopPropagation();
        if (confirm('이 연간 목표를 정말 삭제하시겠습니까? (MY 탭에서도 삭제됩니다)')) {
            const userObj = appData[currentUser];
            userObj.yearlyGoals = userObj.yearlyGoals.filter(g => g.id !== goalId);
            saveData();
            render();
        }
    };

    window.deleteMonthlyTask = function(taskId, event) {
        if (event) event.stopPropagation();
        if (confirm('이 계획을 정말 삭제하시겠습니까?')) {
            const userObj = appData[currentUser];
            userObj.monthlyTasks = userObj.monthlyTasks.filter(t => t.id !== taskId);
            saveData();
            render();
        }
    };

});
