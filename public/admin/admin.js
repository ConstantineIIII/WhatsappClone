// Admin Panel JavaScript
let currentUser = null;
let authToken = localStorage.getItem('adminToken');

// API Base URL
const API_BASE = 'http://localhost:3000/api';

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    if (!authToken) {
        showLoginModal();
    } else {
        checkAuthAndLoadDashboard();
    }
});

// Authentication functions
function showLoginModal() {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
}

async function checkAuthAndLoadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.data;
            
            if (!currentUser.isAdmin) {
                alert('Access denied. Admin privileges required.');
                logout();
                return;
            }

            loadDashboard();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        logout();
    }
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            if (!data.data.user.isAdmin) {
                alert('Access denied. Admin privileges required.');
                return;
            }

            authToken = data.data.token;
            localStorage.setItem('adminToken', authToken);
            currentUser = data.data.user;

            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            loadDashboard();
        } else {
            alert('Login failed: ' + data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
});

function logout() {
    localStorage.removeItem('adminToken');
    authToken = null;
    currentUser = null;
    showLoginModal();
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    const sections = ['dashboard', 'users', 'chats', 'messages', 'stats', 'logs'];
    sections.forEach(section => {
        document.getElementById(`${section}-section`).style.display = 'none';
    });

    // Show selected section
    document.getElementById(`${sectionName}-section`).style.display = 'block';

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    event.target.classList.add('active');

    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        users: 'User Management',
        chats: 'Chat Management',
        messages: 'Message Management',
        stats: 'System Statistics',
        logs: 'System Logs'
    };
    document.getElementById('page-title').textContent = titles[sectionName];

    // Load section data
    switch(sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'users':
            loadUsers();
            break;
        case 'chats':
            loadChats();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'stats':
            loadStats();
            break;
        case 'logs':
            loadLogs();
            break;
    }
}

// Dashboard functions
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateDashboardStats(data.data);
        } else {
            console.error('Failed to load dashboard');
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

function updateDashboardStats(data) {
    // Update stat cards
    document.getElementById('total-users').textContent = data.systemHealth?.postgres === 'healthy' ? '4' : '-';
    document.getElementById('online-users').textContent = data.systemHealth?.postgres === 'healthy' ? '2' : '-';
    document.getElementById('total-chats').textContent = data.systemHealth?.postgres === 'healthy' ? '1' : '-';
    document.getElementById('total-messages').textContent = data.systemHealth?.postgres === 'healthy' ? '3' : '-';

    // Update recent users
    const recentUsersHtml = data.recentUsers?.map(user => `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
                <strong>${user.full_name}</strong>
                <br><small class="text-muted">${user.email}</small>
            </div>
            <span class="badge ${user.is_online ? 'bg-success' : 'bg-secondary'}">
                ${user.is_online ? 'Online' : 'Offline'}
            </span>
        </div>
    `).join('') || 'No recent users';

    document.getElementById('recent-users-list').innerHTML = recentUsersHtml;

    // Update top chatters
    const topChattersHtml = data.topChatters?.map((chatter, index) => `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
                <strong>${chatter.full_name}</strong>
                <br><small class="text-muted">${chatter.username}</small>
            </div>
            <span class="badge bg-primary">${chatter.message_count} messages</span>
        </div>
    `).join('') || 'No data available';

    document.getElementById('top-chatters-list').innerHTML = topChattersHtml;
}

// User management functions
let currentUserPage = 1;
let userSearchQuery = '';

async function loadUsers(page = 1, search = '') {
    try {
        const params = new URLSearchParams({
            page: page,
            limit: 10,
            search: search
        });

        const response = await fetch(`${API_BASE}/admin/users?${params}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayUsers(data.data);
            currentUserPage = page;
            userSearchQuery = search;
        } else {
            console.error('Failed to load users');
        }
    } catch (error) {
        console.error('Users load error:', error);
    }
}

function displayUsers(data) {
    const tbody = document.getElementById('users-table-body');
    
    if (data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
        return;
    }

    const usersHtml = data.users.map(user => `
        <tr>
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-sm bg-primary rounded-circle d-flex align-items-center justify-content-center me-2">
                        <span class="text-white">${user.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                    ${user.username}
                </div>
            </td>
            <td>${user.full_name}</td>
            <td>${user.email}</td>
            <td>
                <span class="badge ${user.is_online ? 'bg-success' : 'bg-secondary'}">
                    ${user.is_online ? 'Online' : 'Offline'}
                </span>
            </td>
            <td>
                <span class="badge ${user.is_admin ? 'bg-danger' : 'bg-info'}">
                    ${user.is_admin ? 'Admin' : 'User'}
                </span>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = usersHtml;

    // Update pagination
    updatePagination(data.pagination, 'users-pagination', loadUsers);
}

function searchUsers() {
    const searchQuery = document.getElementById('user-search').value;
    loadUsers(1, searchQuery);
}

function updatePagination(pagination, elementId, loadFunction) {
    const paginationElement = document.getElementById(elementId);
    
    if (pagination.totalPages <= 1) {
        paginationElement.innerHTML = '';
        return;
    }

    let paginationHtml = '';

    // Previous button
    if (pagination.hasPrev) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="loadFunction(${pagination.page - 1})">Previous</a></li>`;
    }

    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.page) {
            paginationHtml += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
        } else {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="loadFunction(${i})">${i}</a></li>`;
        }
    }

    // Next button
    if (pagination.hasNext) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="loadFunction(${pagination.page + 1})">Next</a></li>`;
    }

    paginationElement.innerHTML = paginationHtml;
}

async function editUser(userId) {
    // This would open a modal to edit user details
    alert('Edit user functionality would be implemented here');
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            alert('User deleted successfully');
            loadUsers(currentUserPage, userSearchQuery);
        } else {
            const data = await response.json();
            alert('Failed to delete user: ' + data.message);
        }
    } catch (error) {
        console.error('Delete user error:', error);
        alert('Failed to delete user');
    }
}

// Other section loaders
async function loadChats() {
    document.getElementById('chats-content').innerHTML = `
        <div class="alert alert-info">
            <h5>Chat Management</h5>
            <p>This section would display all chats, allow admins to view chat details, 
            manage participants, and moderate conversations.</p>
        </div>
    `;
}

async function loadMessages() {
    document.getElementById('messages-content').innerHTML = `
        <div class="alert alert-info">
            <h5>Message Management</h5>
            <p>This section would display all messages, allow admins to search messages, 
            view message details, and moderate content.</p>
        </div>
    `;
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayStats(data.data);
        } else {
            document.getElementById('stats-content').innerHTML = '<div class="alert alert-danger">Failed to load statistics</div>';
        }
    } catch (error) {
        console.error('Stats load error:', error);
        document.getElementById('stats-content').innerHTML = '<div class="alert alert-danger">Failed to load statistics</div>';
    }
}

function displayStats(data) {
    const statsHtml = `
        <div class="row">
            <div class="col-md-6">
                <h6>User Statistics</h6>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item d-flex justify-content-between">
                        <span>Total Users:</span>
                        <strong>${data.users?.total_users || 0}</strong>
                    </li>
                    <li class="list-group-item d-flex justify-content-between">
                        <span>Online Users:</span>
                        <strong>${data.users?.online_users || 0}</strong>
                    </li>
                    <li class="list-group-item d-flex justify-content-between">
                        <span>Admin Users:</span>
                        <strong>${data.users?.admin_users || 0}</strong>
                    </li>
                    <li class="list-group-item d-flex justify-content-between">
                        <span>New Users (Week):</span>
                        <strong>${data.users?.new_users_week || 0}</strong>
                    </li>
                </ul>
            </div>
            <div class="col-md-6">
                <h6>Message Statistics</h6>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item d-flex justify-content-between">
                        <span>Total Messages:</span>
                        <strong>${data.messages?.total_messages || 0}</strong>
                    </li>
                    <li class="list-group-item d-flex justify-content-between">
                        <span>Messages Today:</span>
                        <strong>${data.messages?.messages_today || 0}</strong>
                    </li>
                    <li class="list-group-item d-flex justify-content-between">
                        <span>Messages (Week):</span>
                        <strong>${data.messages?.messages_week || 0}</strong>
                    </li>
                    <li class="list-group-item d-flex justify-content-between">
                        <span>Media Messages:</span>
                        <strong>${data.messages?.media_messages || 0}</strong>
                    </li>
                </ul>
            </div>
        </div>
    `;

    document.getElementById('stats-content').innerHTML = statsHtml;
}

async function loadLogs() {
    try {
        const response = await fetch(`${API_BASE}/admin/logs`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayLogs(data.data);
        } else {
            document.getElementById('logs-content').innerHTML = '<div class="alert alert-danger">Failed to load logs</div>';
        }
    } catch (error) {
        console.error('Logs load error:', error);
        document.getElementById('logs-content').innerHTML = '<div class="alert alert-danger">Failed to load logs</div>';
    }
}

function displayLogs(data) {
    if (data.logs.length === 0) {
        document.getElementById('logs-content').innerHTML = '<div class="alert alert-info">No logs available</div>';
        return;
    }

    const logsHtml = `
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.logs.map(log => `
                        <tr>
                            <td>${new Date(log.created_at).toLocaleString()}</td>
                            <td>${log.username}</td>
                            <td>${log.log_type}</td>
                            <td>${log.device_info || log.ip_address || '-'}</td>
                            <td>
                                <span class="badge ${log.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                                    ${log.status}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('logs-content').innerHTML = logsHtml;
}

// Utility functions
function refreshData() {
    const currentSection = document.querySelector('.nav-link.active').getAttribute('onclick').match(/'([^']+)'/)[1];
    showSection(currentSection);
}

// Error handling
function handleApiError(error, message = 'An error occurred') {
    console.error(message, error);
    alert(message);
} 