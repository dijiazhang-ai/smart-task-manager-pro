// 云同步模块 - GitHub Gist 自动同步

const CloudSync = {
    TOKEN_KEY: 'github-token',
    GIST_ID_KEY: 'gist-id',
    LAST_SYNC_KEY: 'last-sync-time',
    gistId: null,
    token: null,
    syncing: false,
    autoSyncInterval: null,

    // 初始化
    init() {
        this.token = localStorage.getItem(this.TOKEN_KEY);
        this.gistId = localStorage.getItem(this.GIST_ID_KEY);
        
        if (this.token) {
            console.log('✅ 云同步已启用');
            this.updateSyncButton('已启用');
            // 启动时自动同步
            this.pullFromCloud();
            // 启动自动同步（每5分钟）
            this.startAutoSync();
        } else {
            console.log('ℹ️ 云同步未配置');
            this.updateSyncButton('未配置');
        }
    },

    // 配置Token
    configureToken(token) {
        if (!token || !(token.startsWith('ghp_') || token.startsWith('github_pat_'))) {
            alert('Token格式不正确！应该以 ghp_ 或 github_pat_ 开头');
            return false;
        }

        this.token = token;
        localStorage.setItem(this.TOKEN_KEY, token);
        
        // 测试Token
        this.testToken().then(success => {
            if (success) {
                alert('✅ Token配置成功！云同步已启用');
                this.updateSyncButton('已启用');
                this.pullFromCloud();
                this.startAutoSync();
            } else {
                alert('❌ Token无效或权限不足！请检查Token是否正确');
                this.removeToken();
            }
        });

        return true;
    },

    // 移除Token
    removeToken() {
        this.token = null;
        this.gistId = null;
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.GIST_ID_KEY);
        this.stopAutoSync();
        this.updateSyncButton('未配置');
        alert('云同步已禁用');
    },

    // 测试Token
    async testToken() {
        if (!this.token) return false;

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('Token测试失败:', error);
            return false;
        }
    },

    // 上传到云端
    async pushToCloud() {
        if (!this.token) {
            console.log('未配置Token，跳过云同步');
            return;
        }

        if (this.syncing) {
            console.log('正在同步中，跳过');
            return;
        }

        this.syncing = true;
        this.updateSyncButton('上传中...');

        try {
            const data = {
                version: '1.0',
                tasks: AppState.tasks,
                tags: Array.from(AppState.tags),
                lastModified: new Date().toISOString(),
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform
                }
            };

            const content = JSON.stringify(data, null, 2);

            if (this.gistId) {
                // 更新现有Gist
                await this.updateGist(content);
            } else {
                // 创建新Gist
                await this.createGist(content);
            }

            localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
            this.updateSyncButton('已同步');
            console.log('✅ 云同步成功');

        } catch (error) {
            console.error('云同步失败:', error);
            this.updateSyncButton('同步失败');
            UI.showToast('云同步失败：' + error.message, 'error');
        } finally {
            this.syncing = false;
        }
    },

    // 从云端下载
    async pullFromCloud() {
        if (!this.token || !this.gistId) {
            console.log('未配置云同步，跳过下载');
            return;
        }

        if (this.syncing) {
            console.log('正在同步中，跳过');
            return;
        }

        this.syncing = true;
        this.updateSyncButton('下载中...');

        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('获取云端数据失败');
            }

            const gist = await response.json();
            const file = gist.files['smart-tasks-pro.json'];
            
            if (!file) {
                throw new Error('云端数据文件不存在');
            }

            const cloudData = JSON.parse(file.content);
            
            // 合并数据
            this.mergeData(cloudData);

            localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
            this.updateSyncButton('已同步');
            console.log('✅ 云端数据下载成功');

            // 刷新界面
            UI.renderTodayView();
            UI.updateStats();

        } catch (error) {
            console.error('下载云端数据失败:', error);
            this.updateSyncButton('下载失败');
        } finally {
            this.syncing = false;
        }
    },

    // 创建Gist
    async createGist(content) {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: '智能任务管理Pro - 数据同步',
                public: false,
                files: {
                    'smart-tasks-pro.json': {
                        content: content
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error('创建Gist失败');
        }

        const gist = await response.json();
        this.gistId = gist.id;
        localStorage.setItem(this.GIST_ID_KEY, gist.id);
        console.log('✅ Gist创建成功:', gist.id);
    },

    // 更新Gist
    async updateGist(content) {
        const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'smart-tasks-pro.json': {
                        content: content
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error('更新Gist失败');
        }

        console.log('✅ Gist更新成功');
    },

    // 合并数据
    mergeData(cloudData) {
        if (!cloudData.tasks || !Array.isArray(cloudData.tasks)) {
            console.error('云端数据格式错误');
            return;
        }

        // 创建本地任务ID映射
        const localTasksMap = new Map();
        AppState.tasks.forEach(task => {
            localTasksMap.set(task.id, task);
        });

        // 合并云端任务
        let newCount = 0;
        let updateCount = 0;

        cloudData.tasks.forEach(cloudTask => {
            const localTask = localTasksMap.get(cloudTask.id);
            
            if (!localTask) {
                // 新任务，直接添加
                AppState.tasks.push(cloudTask);
                newCount++;
            } else {
                // 已存在，比较时间戳，取最新的
                const cloudTime = new Date(cloudTask.createdAt || 0).getTime();
                const localTime = new Date(localTask.createdAt || 0).getTime();
                
                if (cloudTime > localTime) {
                    // 云端更新，替换本地
                    Object.assign(localTask, cloudTask);
                    updateCount++;
                }
            }
        });

        // 重新提取标签
        AppState.tags.clear();
        AppState.tasks.forEach(task => {
            if (task.tags) {
                task.tags.forEach(tag => AppState.tags.add(tag));
            }
        });

        // 保存合并后的数据
        Storage.saveTasks();

        if (newCount > 0 || updateCount > 0) {
            console.log(`✅ 数据合并完成: 新增${newCount}个, 更新${updateCount}个`);
            UI.showToast(`同步成功！新增${newCount}个任务，更新${updateCount}个任务`, 'success');
        }
    },

    // 启动自动同步
    startAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        // 每5分钟自动同步一次
        this.autoSyncInterval = setInterval(() => {
            console.log('🔄 执行自动同步...');
            this.pullFromCloud();
        }, 5 * 60 * 1000);

        console.log('✅ 自动同步已启动（每5分钟）');
    },

    // 停止自动同步
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            console.log('⏹️ 自动同步已停止');
        }
    },

    // 更新同步按钮状态
    updateSyncButton(status) {
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.title = `云同步: ${status}`;
            
            // 根据状态改变图标颜色
            if (status === '已同步' || status === '已启用') {
                syncBtn.style.color = '#10b981'; // 绿色
            } else if (status.includes('失败')) {
                syncBtn.style.color = '#ef4444'; // 红色
            } else if (status.includes('中')) {
                syncBtn.style.color = '#f59e0b'; // 黄色
                // 添加旋转动画
                syncBtn.style.animation = 'spin 1s linear infinite';
            } else {
                syncBtn.style.color = ''; // 默认颜色
                syncBtn.style.animation = '';
            }
        }
    },

    // 显示配置对话框
    showConfigDialog() {
        const currentToken = this.token || '';
        const hasToken = !!this.token;

        const message = hasToken 
            ? '云同步已启用\n\n当前Token: ' + currentToken.substring(0, 10) + '...\n\n是否要重新配置？'
            : '请输入GitHub Personal Access Token\n\n获取方法：\n1. 访问 github.com/settings/tokens\n2. 创建新Token\n3. 勾选 gist 权限\n4. 复制Token';

        if (hasToken) {
            const reconfigure = confirm(message);
            if (!reconfigure) {
                // 询问是否禁用
                const disable = confirm('是否要禁用云同步？');
                if (disable) {
                    this.removeToken();
                }
                return;
            }
        }

        const token = prompt(message, currentToken);
        
        if (token) {
            this.configureToken(token.trim());
        }
    }
};

// 添加旋转动画CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// 扩展Storage，在保存时自动同步到云端
const originalSaveTasks = Storage.saveTasks;
Storage.saveTasks = function() {
    originalSaveTasks.call(this);
    // 异步上传到云端
    if (CloudSync.token) {
        setTimeout(() => CloudSync.pushToCloud(), 1000);
    }
};

// 页面加载时初始化云同步
document.addEventListener('DOMContentLoaded', () => {
    CloudSync.init();
    
    // 添加云同步按钮事件
    const cloudSyncBtn = document.getElementById('cloudSyncBtn');
    if (cloudSyncBtn) {
        cloudSyncBtn.addEventListener('click', () => {
            CloudSync.showConfigDialog();
        });
    }
    
    // 添加同步按钮点击事件
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            if (CloudSync.token) {
                CloudSync.pullFromCloud();
            } else {
                alert('请先配置云同步！\n\n点击菜单中的"云同步设置"进行配置');
            }
        });
    }
});

console.log('☁️ 云同步模块已加载');
