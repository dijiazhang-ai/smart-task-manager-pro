// 智能任务管理Pro - 核心JavaScript

// 全局状态管理
const AppState = {
    tasks: [],
    tags: new Set(),
    currentView: 'today',
    currentDate: new Date(),
    selectedDate: new Date(),
    filter: 'all',
    
    // 时间段配置
    timeSlots: [
        { id: 'dawn', label: '凌晨', range: '00:00-05:59', start: 0, end: 6 },
        { id: 'morning', label: '早晨', range: '06:00-08:59', start: 6, end: 9 },
        { id: 'forenoon', label: '上午', range: '09:00-11:59', start: 9, end: 12 },
        { id: 'noon', label: '中午', range: '12:00-13:59', start: 12, end: 14 },
        { id: 'afternoon', label: '下午', range: '14:00-17:59', start: 14, end: 18 },
        { id: 'evening', label: '傍晚', range: '18:00-20:59', start: 18, end: 21 },
        { id: 'night', label: '夜晚', range: '21:00-23:59', start: 21, end: 24 }
    ]
};

// 工具函数
const Utils = {
    // 格式化日期
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // 解析日期
    parseDate(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    },

    // 判断是否为同一天
    isSameDay(date1, date2) {
        return this.formatDate(date1) === this.formatDate(date2);
    },

    // 获取星期几
    getWeekday(date) {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return days[date.getDay()];
    },

    // 获取月份名称
    getMonthName(date) {
        return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    },

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // 智能消息分析
    analyzeMessage(message) {
        const result = {
            description: message,
            date: this.formatDate(new Date()),
            timeSlot: 'forenoon',
            priority: 'medium',
            tags: []
        };

        // 提取标签
        const tagMatches = message.match(/#[\u4e00-\u9fa5\w]+/g);
        if (tagMatches) {
            result.tags = tagMatches.map(tag => tag.substring(1));
            result.description = message.replace(/#[\u4e00-\u9fa5\w]+/g, '').trim();
        }

        // 日期识别
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

        if (message.includes('今天') || message.includes('今日')) {
            result.date = this.formatDate(today);
        } else if (message.includes('明天') || message.includes('明日')) {
            result.date = this.formatDate(tomorrow);
        } else if (message.includes('后天')) {
            result.date = this.formatDate(dayAfterTomorrow);
        } else if (message.includes('下周')) {
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            result.date = this.formatDate(nextWeek);
        }

        // 时间识别
        const timePatterns = [
            { regex: /(\d{1,2}):(\d{2})/, handler: (h) => h },
            { regex: /下午\s*(\d{1,2})[点时]/, handler: (h) => h + 12 },
            { regex: /上午\s*(\d{1,2})[点时]/, handler: (h) => h },
            { regex: /晚上\s*(\d{1,2})[点时]/, handler: (h) => h >= 6 ? h + 12 : h },
            { regex: /(\d{1,2})[点时]/, handler: (h) => h }
        ];

        for (const pattern of timePatterns) {
            const match = message.match(pattern.regex);
            if (match) {
                const hour = pattern.handler(parseInt(match[1]));
                result.timeSlot = this.getTimeSlotByHour(hour);
                break;
            }
        }

        // 优先级识别
        if (message.includes('高优先级') || message.includes('紧急') || message.includes('重要') || message.includes('!!')) {
            result.priority = 'high';
        } else if (message.includes('低优先级') || message.includes('不急')) {
            result.priority = 'low';
        }

        return result;
    },

    // 根据小时获取时间段
    getTimeSlotByHour(hour) {
        const slot = AppState.timeSlots.find(s => hour >= s.start && hour < s.end);
        return slot ? slot.id : 'forenoon';
    },

    // 获取时间段标签
    getTimeSlotLabel(slotId) {
        const slot = AppState.timeSlots.find(s => s.id === slotId);
        return slot ? slot.label : '';
    },

    // 获取时间段范围
    getTimeSlotRange(slotId) {
        const slot = AppState.timeSlots.find(s => s.id === slotId);
        return slot ? slot.range : '';
    }
};

// 数据存储
const Storage = {
    TASKS_KEY: 'smart-tasks-pro',
    TAGS_KEY: 'smart-tags-pro',

    // 保存任务
    saveTasks() {
        localStorage.setItem(this.TASKS_KEY, JSON.stringify(AppState.tasks));
    },

    // 加载任务
    loadTasks() {
        const saved = localStorage.getItem(this.TASKS_KEY);
        if (saved) {
            try {
                AppState.tasks = JSON.parse(saved);
                // 提取所有标签
                AppState.tasks.forEach(task => {
                    if (task.tags) {
                        task.tags.forEach(tag => AppState.tags.add(tag));
                    }
                });
            } catch (e) {
                console.error('加载任务失败:', e);
                AppState.tasks = [];
            }
        }
    },

    // 添加任务
    addTask(taskData) {
        const task = {
            id: Utils.generateId(),
            description: taskData.description,
            date: taskData.date,
            timeSlot: taskData.timeSlot,
            priority: taskData.priority || 'medium',
            tags: taskData.tags || [],
            completed: false,
            createdAt: new Date().toISOString(),
            delayed: false
        };
        
        AppState.tasks.unshift(task);
        
        // 添加标签
        if (task.tags) {
            task.tags.forEach(tag => AppState.tags.add(tag));
        }
        
        this.saveTasks();
        return task;
    },

    // 更新任务
    updateTask(taskId, updates) {
        const index = AppState.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            AppState.tasks[index] = { ...AppState.tasks[index], ...updates };
            this.saveTasks();
            return AppState.tasks[index];
        }
        return null;
    },

    // 删除任务
    deleteTask(taskId) {
        AppState.tasks = AppState.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
    },

    // 切换任务完成状态
    toggleTask(taskId) {
        const task = AppState.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            return task;
        }
        return null;
    },

    // 获取今日任务
    getTodayTasks() {
        const today = Utils.formatDate(new Date());
        return AppState.tasks.filter(task => task.date === today);
    },

    // 获取日期任务
    getTasksByDate(dateStr) {
        return AppState.tasks.filter(task => task.date === dateStr);
    },

    // 获取时间段任务
    getTasksByTimeSlot(dateStr, slotId) {
        return AppState.tasks.filter(task => 
            task.date === dateStr && task.timeSlot === slotId
        );
    },

    // 获取本周任务
    getWeekTasks() {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        return AppState.tasks.filter(task => {
            const taskDate = Utils.parseDate(task.date);
            return taskDate >= weekStart && taskDate <= weekEnd;
        });
    },

    // 导出数据
    exportData() {
        const data = {
            tasks: AppState.tasks,
            tags: Array.from(AppState.tags),
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-backup-${Utils.formatDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// UI渲染
const UI = {
    // 初始化
    init() {
        this.renderTodayView();
        this.updateStats();
        this.setupEventListeners();
    },

    // 渲染今日视图
    renderTodayView() {
        this.renderTimeline();
        this.renderTaskList();
    },

    // 渲染时间轴
    renderTimeline() {
        const timeline = document.getElementById('timeline');
        if (!timeline) return;

        const today = Utils.formatDate(new Date());
        timeline.innerHTML = '';

        AppState.timeSlots.forEach(slot => {
            const tasks = Storage.getTasksByTimeSlot(today, slot.id);
            const pendingTasks = tasks.filter(t => !t.completed);
            
            const slotEl = document.createElement('div');
            slotEl.className = `timeline-slot ${pendingTasks.length > 0 ? 'has-tasks' : ''}`;
            slotEl.innerHTML = `
                <div class="slot-time">${slot.range}</div>
                <div class="slot-label">${slot.label}</div>
                <div class="slot-count">${pendingTasks.length}</div>
            `;
            
            slotEl.addEventListener('click', () => {
                this.showTimeSlotTasks(slot, tasks);
            });
            
            timeline.appendChild(slotEl);
        });
    },

    // 渲染任务列表
    renderTaskList() {
        const taskList = document.getElementById('taskList');
        if (!taskList) return;

        let tasks = [];
        
        // 根据过滤器获取任务
        switch (AppState.filter) {
            case 'pending':
                tasks = Storage.getTodayTasks().filter(t => !t.completed);
                break;
            case 'completed':
                tasks = Storage.getTodayTasks().filter(t => t.completed);
                break;
            case 'all':
            default:
                tasks = Storage.getTodayTasks();
                break;
        }

        if (tasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    <p>暂无任务</p>
                    <small>开始添加你的第一个任务吧！</small>
                </div>
            `;
            return;
        }

        taskList.innerHTML = tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-header">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                           onchange="UI.toggleTask('${task.id}')">
                    <div class="task-content">
                        <div class="task-title">${task.description}</div>
                        <div class="task-meta">
                            <span class="task-tag priority-${task.priority}">
                                ${task.priority === 'high' ? '高优先级' : task.priority === 'low' ? '低优先级' : '中优先级'}
                            </span>
                            <span class="task-tag">
                                ${Utils.getTimeSlotLabel(task.timeSlot)} ${Utils.getTimeSlotRange(task.timeSlot)}
                            </span>
                            ${task.tags.map(tag => `<span class="task-tag">#${tag}</span>`).join('')}
                            ${task.delayed ? '<span class="task-tag" style="background: rgba(239, 68, 68, 0.1); color: var(--danger-color);">延期</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // 添加点击事件
        taskList.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('task-checkbox')) {
                    const taskId = item.dataset.id;
                    this.showTaskDetail(taskId);
                }
            });
        });
    },

    // 渲染本周视图
    renderWeekView() {
        const weekGrid = document.getElementById('weekGrid');
        if (!weekGrid) return;

        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());

        weekGrid.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateStr = Utils.formatDate(date);
            const tasks = Storage.getTasksByDate(dateStr);
            const isToday = Utils.isSameDay(date, today);

            const dayEl = document.createElement('div');
            dayEl.className = `week-day ${isToday ? 'today' : ''}`;
            dayEl.innerHTML = `
                <div class="week-day-header">
                    <div class="week-day-name">${Utils.getWeekday(date)}</div>
                    <div class="week-day-date">${date.getMonth() + 1}/${date.getDate()}</div>
                </div>
                <div class="week-tasks">
                    ${tasks.length === 0 ? '<div class="empty-state"><small>无任务</small></div>' : 
                      tasks.slice(0, 5).map(task => `
                        <div class="week-task ${task.completed ? 'completed' : ''}">
                            ${task.description}
                        </div>
                      `).join('')}
                    ${tasks.length > 5 ? `<div class="week-task">+${tasks.length - 5}更多</div>` : ''}
                </div>
            `;
            weekGrid.appendChild(dayEl);
        }
    },

    // 渲染日历视图
    renderCalendarView() {
        const calendarTitle = document.getElementById('calendarTitle');
        const calendarGrid = document.getElementById('calendarGrid');
        
        if (!calendarTitle || !calendarGrid) return;

        calendarTitle.textContent = Utils.getMonthName(AppState.currentDate);

        const year = AppState.currentDate.getFullYear();
        const month = AppState.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDay = firstDay.getDay();

        let html = '<div class="calendar-weekdays">';
        ['日', '一', '二', '三', '四', '五', '六'].forEach(day => {
            html += `<div class="calendar-weekday">${day}</div>`;
        });
        html += '</div><div class="calendar-days">';

        // 上个月的日期
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            html += `<div class="calendar-day other-month">${prevMonthLastDay - i}</div>`;
        }

        // 本月日期
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = Utils.formatDate(date);
            const tasks = Storage.getTasksByDate(dateStr);
            const isToday = Utils.isSameDay(date, today);
            const hasTasks = tasks.length > 0;

            html += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''}" 
                     data-date="${dateStr}">
                    <div class="day-number">${day}</div>
                    ${hasTasks ? `<div class="day-tasks-count">${tasks.length}</div>` : ''}
                </div>
            `;
        }

        // 下个月的日期
        const remainingDays = 42 - (startDay + daysInMonth);
        for (let day = 1; day <= remainingDays; day++) {
            html += `<div class="calendar-day other-month">${day}</div>`;
        }

        html += '</div>';
        calendarGrid.innerHTML = html;

        // 添加点击事件
        calendarGrid.querySelectorAll('.calendar-day[data-date]').forEach(day => {
            day.addEventListener('click', () => {
                const dateStr = day.dataset.date;
                AppState.selectedDate = Utils.parseDate(dateStr);
                this.showDateTasks(dateStr);
            });
        });
    },

    // 渲染标签视图
    renderTagsView() {
        const tagsContainer = document.getElementById('tagsContainer');
        if (!tagsContainer) return;

        if (AppState.tags.size === 0) {
            tagsContainer.innerHTML = `
                <div class="empty-state">
                    <p>暂无标签</p>
                    <small>在任务中使用 #标签名 来创建标签</small>
                </div>
            `;
            return;
        }

        tagsContainer.innerHTML = Array.from(AppState.tags).map(tag => {
            const count = AppState.tasks.filter(t => t.tags && t.tags.includes(tag)).length;
            return `
                <div class="tag-card">
                    <div class="tag-name">#${tag}</div>
                    <div class="tag-count">${count} 个任务</div>
                </div>
            `;
        }).join('');
    },

    // 渲染统计视图
    renderStatsView() {
        const statsCharts = document.getElementById('statsCharts');
        if (!statsCharts) return;

        const totalTasks = AppState.tasks.length;
        const completedTasks = AppState.tasks.filter(t => t.completed).length;
        const pendingTasks = totalTasks - completedTasks;
        const highPriorityTasks = AppState.tasks.filter(t => t.priority === 'high' && !t.completed).length;

        // 按优先级统计
        const priorityStats = {
            high: AppState.tasks.filter(t => t.priority === 'high').length,
            medium: AppState.tasks.filter(t => t.priority === 'medium').length,
            low: AppState.tasks.filter(t => t.priority === 'low').length
        };

        // 按时间段统计
        const timeSlotStats = {};
        AppState.timeSlots.forEach(slot => {
            timeSlotStats[slot.label] = AppState.tasks.filter(t => t.timeSlot === slot.id).length;
        });

        statsCharts.innerHTML = `
            <div class="chart-card">
                <h3 class="chart-title">总体统计</h3>
                <div class="stats-cards">
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-value">${totalTasks}</div>
                            <div class="stat-label">总任务数</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-value">${completedTasks}</div>
                            <div class="stat-label">已完成</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-value">${pendingTasks}</div>
                            <div class="stat-label">待完成</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-value">${highPriorityTasks}</div>
                            <div class="stat-label">高优先级待办</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="chart-card">
                <h3 class="chart-title">优先级分布</h3>
                <div class="stats-cards">
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-value" style="color: var(--danger-color);">${priorityStats.high}</div>
                            <div class="stat-label">高优先级</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-value" style="color: var(--warning-color);">${priorityStats.medium}</div>
                            <div class="stat-label">中优先级</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <div class="stat-value" style="color: var(--success-color);">${priorityStats.low}</div>
                            <div class="stat-label">低优先级</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="chart-card">
                <h3 class="chart-title">时间段分布</h3>
                <div class="task-list">
                    ${Object.entries(timeSlotStats).map(([label, count]) => `
                        <div class="task-item">
                            <div class="task-header">
                                <div class="task-content">
                                    <div class="task-title">${label}</div>
                                </div>
                            </div>
                            <div style="font-size: 1.5rem; font-weight: 700;">${count}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // 更新统计数据
    updateStats() {
        const todayTasks = Storage.getTodayTasks();
        const total = todayTasks.length;
        const completed = todayTasks.filter(t => t.completed).length;
        const pending = total - completed;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('pendingTasks').textContent = pending;
        document.getElementById('completionRate').textContent = `${rate}%`;
        document.getElementById('todayBadge').textContent = pending;
    },

    // 切换任务状态
    toggleTask(taskId) {
        Storage.toggleTask(taskId);
        this.renderTodayView();
        this.updateStats();
    },

    // 显示时间段任务
    showTimeSlotTasks(slot, tasks) {
        const modal = document.getElementById('taskModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) return;

        modalBody.innerHTML = `
            <h4 style="margin-bottom: 1rem;">${slot.label} (${slot.range})</h4>
            ${tasks.length === 0 ? '<p style="color: var(--text-light);">该时间段暂无任务</p>' : `
                <div class="task-list">
                    ${tasks.map(task => `
                        <div class="task-item ${task.completed ? 'completed' : ''}">
                            <div class="task-header">
                                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                                       onchange="UI.toggleTask('${task.id}')">
                                <div class="task-content">
                                    <div class="task-title">${task.description}</div>
                                    <div class="task-meta">
                                        <span class="task-tag priority-${task.priority}">
                                            ${task.priority === 'high' ? '高优先级' : task.priority === 'low' ? '低优先级' : '中优先级'}
                                        </span>
                                        ${task.tags.map(tag => `<span class="task-tag">#${tag}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        `;

        modal.classList.add('active');
    },

    // 显示日期任务
    showDateTasks(dateStr) {
        const modal = document.getElementById('taskModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) return;

        const date = Utils.parseDate(dateStr);
        const tasks = Storage.getTasksByDate(dateStr);

        modalBody.innerHTML = `
            <h4 style="margin-bottom: 1rem;">${Utils.formatDate(date)} ${Utils.getWeekday(date)}</h4>
            ${tasks.length === 0 ? '<p style="color: var(--text-light);">该日期暂无任务</p>' : `
                <div class="task-list">
                    ${tasks.map(task => `
                        <div class="task-item ${task.completed ? 'completed' : ''}">
                            <div class="task-header">
                                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                                       onchange="UI.toggleTask('${task.id}')">
                                <div class="task-content">
                                    <div class="task-title">${task.description}</div>
                                    <div class="task-meta">
                                        <span class="task-tag priority-${task.priority}">
                                            ${task.priority === 'high' ? '高优先级' : task.priority === 'low' ? '低优先级' : '中优先级'}
                                        </span>
                                        <span class="task-tag">
                                            ${Utils.getTimeSlotLabel(task.timeSlot)}
                                        </span>
                                        ${task.tags.map(tag => `<span class="task-tag">#${tag}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        `;

        modal.classList.add('active');
    },

    // 显示任务详情
    showTaskDetail(taskId) {
        const task = AppState.tasks.find(t => t.id === taskId);
        if (!task) return;

        const modal = document.getElementById('taskModal');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalBody) return;

        modalBody.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 0.5rem;">任务描述</h4>
                <p style="font-size: 1.125rem;">${task.description}</p>
            </div>
            <div style="margin-bottom: 1rem;">
                <h4 style="margin-bottom: 0.5rem;">详细信息</h4>
                <div class="task-meta" style="flex-direction: column; align-items: flex-start; gap: 0.75rem;">
                    <div><strong>日期：</strong>${task.date} ${Utils.getWeekday(Utils.parseDate(task.date))}</div>
                    <div><strong>时间：</strong>${Utils.getTimeSlotLabel(task.timeSlot)} (${Utils.getTimeSlotRange(task.timeSlot)})</div>
                    <div><strong>优先级：</strong>
                        <span class="task-tag priority-${task.priority}">
                            ${task.priority === 'high' ? '高优先级' : task.priority === 'low' ? '低优先级' : '中优先级'}
                        </span>
                    </div>
                    ${task.tags.length > 0 ? `<div><strong>标签：</strong>${task.tags.map(tag => `<span class="task-tag">#${tag}</span>`).join(' ')}</div>` : ''}
                    <div><strong>状态：</strong>${task.completed ? '✓ 已完成' : '待完成'}</div>
                    ${task.delayed ? '<div style="color: var(--danger-color);"><strong>⚠ 延期任务</strong></div>' : ''}
                </div>
            </div>
            <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                <button onclick="UI.toggleTask('${task.id}'); UI.closeModal();" 
                        style="flex: 1; padding: 0.75rem; border: 1px solid var(--border-color); background: white; border-radius: var(--radius-md); cursor: pointer;">
                    ${task.completed ? '标记为未完成' : '标记为已完成'}
                </button>
                <button onclick="if(confirm('确定删除此任务？')) { Storage.deleteTask('${task.id}'); UI.closeModal(); UI.renderTodayView(); UI.updateStats(); }" 
                        style="flex: 1; padding: 0.75rem; border: 1px solid var(--danger-color); background: white; color: var(--danger-color); border-radius: var(--radius-md); cursor: pointer;">
                    删除任务
                </button>
            </div>
        `;

        modal.classList.add('active');
    },

    // 关闭模态框
    closeModal() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.renderTodayView();
        this.updateStats();
    },

    // 切换视图
    switchView(viewName) {
        AppState.currentView = viewName;
        
        // 隐藏所有视图
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.remove('active');
        });

        // 显示当前视图
        const viewMap = {
            'today': 'todayView',
            'week': 'weekView',
            'calendar': 'calendarView',
            'tags': 'tagsView',
            'stats': 'statsView'
        };

        const viewId = viewMap[viewName];
        const viewElement = document.getElementById(viewId);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        // 渲染对应视图
        switch (viewName) {
            case 'today':
                this.renderTodayView();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'calendar':
                this.renderCalendarView();
                break;
            case 'tags':
                this.renderTagsView();
                break;
            case 'stats':
                this.renderStatsView();
                break;
        }

        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });

        // 关闭侧边栏
        this.closeSidebar();
    },

    // 打开侧边栏
    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('active');
        }
    },

    // 关闭侧边栏
    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('active');
        }
    },

    // 设置事件监听
    setupEventListeners() {
        // 菜单按钮
        document.getElementById('menuBtn')?.addEventListener('click', () => this.openSidebar());
        document.getElementById('closeSidebar')?.addEventListener('click', () => this.closeSidebar());
        document.getElementById('sidebarOverlay')?.addEventListener('click', () => this.closeSidebar());

        // 导航项
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if (view) {
                    this.switchView(view);
                }
            });
        });

        // 智能输入
        const smartInput = document.getElementById('smartInput');
        const inputPreview = document.getElementById('inputPreview');
        
        smartInput?.addEventListener('input', (e) => {
            const message = e.target.value.trim();
            if (message) {
                const analysis = Utils.analyzeMessage(message);
                inputPreview.textContent = `📅 ${analysis.date} | ⏰ ${Utils.getTimeSlotLabel(analysis.timeSlot)} | 🎯 ${analysis.priority === 'high' ? '高' : analysis.priority === 'low' ? '低' : '中'}优先级${analysis.tags.length > 0 ? ' | 🏷️ ' + analysis.tags.join(', ') : ''}`;
                inputPreview.classList.add('active');
            } else {
                inputPreview.classList.remove('active');
            }
        });

        smartInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTaskFromInput();
            }
        });

        document.getElementById('addTaskBtn')?.addEventListener('click', () => this.addTaskFromInput());
        document.getElementById('fabBtn')?.addEventListener('click', () => {
            smartInput?.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // 过滤器
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                AppState.filter = tab.dataset.filter;
                this.renderTaskList();
            });
        });

        // 日历导航
        document.getElementById('prevMonth')?.addEventListener('click', () => {
            AppState.currentDate.setMonth(AppState.currentDate.getMonth() - 1);
            this.renderCalendarView();
        });

        document.getElementById('nextMonth')?.addEventListener('click', () => {
            AppState.currentDate.setMonth(AppState.currentDate.getMonth() + 1);
            this.renderCalendarView();
        });

        // 导出按钮
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            Storage.exportData();
        });

        // 模态框关闭
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal());
        document.querySelector('.modal-overlay')?.addEventListener('click', () => this.closeModal());
    },

    // 从输入框添加任务
    addTaskFromInput() {
        const input = document.getElementById('smartInput');
        const preview = document.getElementById('inputPreview');
        
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        const taskData = Utils.analyzeMessage(message);
        Storage.addTask(taskData);

        input.value = '';
        preview.classList.remove('active');

        this.renderTodayView();
        this.updateStats();

        // 显示成功提示
        this.showToast('任务添加成功！');
    },

    // 显示提示
    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 5rem;
            left: 50%;
            transform: translateX(-50%);
            background: var(--text-primary);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            z-index: 9999;
            animation: slideUp 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
};

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    Storage.loadTasks();
    UI.init();

    // 添加示例任务（仅首次使用）
    if (AppState.tasks.length === 0) {
        const today = Utils.formatDate(new Date());
        const tomorrow = Utils.formatDate(new Date(Date.now() + 86400000));

        Storage.addTask({
            description: '查看智能任务管理系统功能',
            date: today,
            timeSlot: 'forenoon',
            priority: 'high',
            tags: ['教程']
        });

        Storage.addTask({
            description: '尝试添加第一个任务',
            date: today,
            timeSlot: 'afternoon',
            priority: 'medium',
            tags: ['开始']
        });

        Storage.addTask({
            description: '探索不同的视图模式',
            date: tomorrow,
            timeSlot: 'morning',
            priority: 'low',
            tags: ['探索']
        });

        UI.renderTodayView();
        UI.updateStats();
    }
});
