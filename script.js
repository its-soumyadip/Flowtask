/* ============================================
   FlowTask — script.js
   Premium Productivity Dashboard
   ============================================ */
(function () {
  'use strict';

  /* ── STATE ─────────────────────────────────── */
  const STATE = {
    tasks: [],
    currentView: 'dashboard',
    currentCategory: null,
    sortBy: 'created',
    filterPriority: 'all',
    searchQuery: '',
    calendarDate: new Date(),
    deletedTask: null,
    undoTimer: null,
    modalSubtasks: [],
    pomodoro: { mode: 'work', seconds: 25 * 60, running: false, interval: null, sessions: 0 },
  };

  const CATEGORY_COLORS = {
    Work: '#6C63FF', Personal: '#48CFCB', Urgent: '#FF6B6B',
    Health: '#51CF66', Finance: '#FCC419',
  };
  const PRIORITY_COLORS = { high: '#FF6B6B', medium: '#FCC419', low: '#51CF66' };
  const POMO_DURATIONS = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };

  /* ── DOM REFERENCES ────────────────────────── */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const DOM = {
    sidebar: $('#sidebar'), sidebarOverlay: $('#sidebarOverlay'),
    hamburgerBtn: $('#hamburgerBtn'), sidebarCloseBtn: $('#sidebarCloseBtn'),
    navList: $('#navList'), categoryNav: $('#categoryNav'),
    mainContent: $('#mainContent'),
    searchInput: $('#searchInput'),
    themeToggle: $('#themeToggle'),
    // Views
    viewDashboard: $('#viewDashboard'), viewTasks: $('#viewTasks'),
    viewCalendar: $('#viewCalendar'), viewPomodoro: $('#viewPomodoro'),
    viewPlanner: $('#viewPlanner'),
    // Dashboard
    statTotal: $('#statTotal'), statCompleted: $('#statCompleted'),
    statPending: $('#statPending'), statOverdue: $('#statOverdue'),
    progressPercent: $('#progressPercent'), progressFill: $('#progressFill'),
    categoryBars: $('#categoryBars'), donutSvg: $('#donutSvg'),
    donutCenter: $('#donutCenter'), donutLegend: $('#donutLegend'),
    recentTasksList: $('#recentTasksList'), dashboardGreeting: $('#dashboardGreeting'),
    // Tasks
    taskList: $('#taskList'), emptyState: $('#emptyState'),
    taskViewTitle: $('#taskViewTitle'), taskViewSubtitle: $('#taskViewSubtitle'),
    // Badges
    badgeAll: $('#badgeAll'), badgeToday: $('#badgeToday'), badgeCompleted: $('#badgeCompleted'),
    // Modal
    taskModal: $('#taskModal'), modalTitle: $('#modalTitle'),
    taskForm: $('#taskForm'), taskTitle: $('#taskTitle'),
    taskDesc: $('#taskDesc'), taskDueDate: $('#taskDueDate'),
    taskDueTime: $('#taskDueTime'), taskPriority: $('#taskPriority'),
    taskCategory: $('#taskCategory'), taskReminder: $('#taskReminder'),
    taskEditId: $('#taskEditId'), subtaskList: $('#subtaskList'),
    subtaskInput: $('#subtaskInput'), btnAddSubtask: $('#btnAddSubtask'),
    modalClose: $('#modalClose'), btnCancelModal: $('#btnCancelModal'),
    btnOpenAddModal: $('#btnOpenAddModal'), fab: $('#fab'),
    // Sort/filter
    sortBtn: $('#sortBtn'), sortMenu: $('#sortMenu'),
    filterBtn: $('#filterBtn'), filterMenu: $('#filterMenu'),
    moreBtn: $('#moreBtn'), moreMenu: $('#moreMenu'),
    // Import/Export
    btnExportJSON: $('#btnExportJSON'), btnExportCSV: $('#btnExportCSV'),
    btnImport: $('#btnImport'), fileImport: $('#fileImport'),
    // Undo
    undoBar: $('#undoBar'), undoBtn: $('#undoBtn'),
    // Toast
    toastContainer: $('#toastContainer'),
    // Calendar
    calPrev: $('#calPrev'), calNext: $('#calNext'),
    calMonth: $('#calMonth'), calendarGrid: $('#calendarGrid'),
    // Pomodoro
    pomoTime: $('#pomoTime'), pomoRing: $('#pomoRing'),
    pomoStart: $('#pomoStart'), pomoReset: $('#pomoReset'),
    pomoSessionCount: $('#pomoSessionCount'),
    // Planner
    plannerTimeline: $('#plannerTimeline'), plannerDate: $('#plannerDate'),
    // Shortcuts
    shortcutsModal: $('#shortcutsModal'), shortcutsClose: $('#shortcutsClose'),
  };

  /* ── HELPERS ───────────────────────────────── */
  function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr), t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  function isOverdue(task) {
    if (!task.dueDate || task.completed) return false;
    const due = new Date(task.dueDate + (task.dueTime ? 'T' + task.dueTime : 'T23:59'));
    return due < new Date();
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning! ☀️ Here\'s your productivity overview.';
    if (h < 17) return 'Good afternoon! 🌤️ Keep up the great work.';
    return 'Good evening! 🌙 Review your day\'s progress.';
  }

  /* ── LOCALSTORAGE ──────────────────────────── */
  function saveTasks() { localStorage.setItem('flowtask_tasks', JSON.stringify(STATE.tasks)); }
  function loadTasks() {
    try { STATE.tasks = JSON.parse(localStorage.getItem('flowtask_tasks')) || []; }
    catch { STATE.tasks = []; }
  }
  function saveTheme(t) { localStorage.setItem('flowtask_theme', t); }
  function loadTheme() { return localStorage.getItem('flowtask_theme') || 'dark'; }

  /* ── TOAST NOTIFICATIONS ───────────────────── */
  function showToast(message, type = 'success') {
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 3000);
  }

  /* ── THEME ─────────────────────────────────── */
  function initTheme() {
    const theme = loadTheme();
    document.documentElement.setAttribute('data-theme', theme);
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    saveTheme(next);
  }

  /* ── SIDEBAR ───────────────────────────────── */
  function openSidebar() { DOM.sidebar.classList.add('open'); DOM.sidebarOverlay.classList.add('open'); }
  function closeSidebar() { DOM.sidebar.classList.remove('open'); DOM.sidebarOverlay.classList.remove('open'); }

  /* ── NAVIGATION ────────────────────────────── */
  function setView(view, category) {
    STATE.currentView = view;
    STATE.currentCategory = category || null;

    // Update nav active
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    const sel = category
      ? `.nav-item[data-category="${category}"]`
      : `.nav-item[data-view="${view}"]`;
    const el = $(sel);
    if (el) el.classList.add('active');

    // Show correct view section
    const views = { dashboard: DOM.viewDashboard, all: DOM.viewTasks, today: DOM.viewTasks,
      upcoming: DOM.viewTasks, completed: DOM.viewTasks, category: DOM.viewTasks,
      calendar: DOM.viewCalendar, pomodoro: DOM.viewPomodoro, planner: DOM.viewPlanner };

    [DOM.viewDashboard, DOM.viewTasks, DOM.viewCalendar, DOM.viewPomodoro, DOM.viewPlanner]
      .forEach(v => v.classList.add('hidden'));
    const target = views[view];
    if (target) target.classList.remove('hidden');

    // Update title
    const titles = {
      all: ['All Tasks', 'Manage all your tasks in one place.'],
      today: ['Today', 'Tasks due today.'],
      upcoming: ['Upcoming', 'Tasks with future due dates.'],
      completed: ['Completed', 'Tasks you have finished.'],
      category: [category || '', `Tasks in ${category || ''} category.`],
    };
    if (titles[view]) {
      DOM.taskViewTitle.textContent = titles[view][0];
      DOM.taskViewSubtitle.textContent = titles[view][1];
    }

    if (view === 'dashboard') renderDashboard();
    else if (view === 'calendar') renderCalendar();
    else if (view === 'planner') renderPlanner();
    else if (['all', 'today', 'upcoming', 'completed', 'category'].includes(view)) renderTasks();

    closeSidebar();
  }

  /* ── FILTER TASKS ──────────────────────────── */
  function getFilteredTasks() {
    let tasks = [...STATE.tasks];

    // View filter
    switch (STATE.currentView) {
      case 'today': tasks = tasks.filter(t => isToday(t.dueDate)); break;
      case 'upcoming': tasks = tasks.filter(t => t.dueDate && !t.completed && new Date(t.dueDate) >= new Date(new Date().toDateString())); break;
      case 'completed': tasks = tasks.filter(t => t.completed); break;
      case 'category': tasks = tasks.filter(t => t.category === STATE.currentCategory); break;
    }

    // Priority filter
    if (STATE.filterPriority !== 'all') {
      tasks = tasks.filter(t => t.priority === STATE.filterPriority);
    }

    // Search
    if (STATE.searchQuery) {
      const q = STATE.searchQuery.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }

    // Sort
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    switch (STATE.sortBy) {
      case 'dueDate': tasks.sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9')); break;
      case 'priority': tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]); break;
      case 'alpha': tasks.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'status': tasks.sort((a, b) => Number(a.completed) - Number(b.completed)); break;
      default: tasks.sort((a, b) => b.createdAt - a.createdAt);
    }

    return tasks;
  }

  /* ── RENDER TASKS ──────────────────────────── */
  function renderTasks() {
    const tasks = getFilteredTasks();
    DOM.taskList.innerHTML = '';

    if (tasks.length === 0) {
      DOM.emptyState.classList.remove('hidden');
      DOM.taskList.style.display = 'none';
      return;
    }
    DOM.emptyState.classList.add('hidden');
    DOM.taskList.style.display = '';

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card' + (task.completed ? ' completed-card' : '');
      card.setAttribute('draggable', 'true');
      card.dataset.id = task.id;

      const subtasksDone = (task.subtasks || []).filter(s => s.done).length;
      const subtasksTotal = (task.subtasks || []).length;
      const subtaskPercent = subtasksTotal ? Math.round(subtasksDone / subtasksTotal * 100) : 0;

      const dueClass = isOverdue(task) ? ' overdue' : '';
      const dueLabel = task.dueDate
        ? `<span class="tag-due${dueClass}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>${formatDate(task.dueDate)}${task.dueTime ? ' ' + task.dueTime : ''}</span>`
        : '';

      card.innerHTML = `
        <div class="task-checkbox ${task.completed ? 'checked' : ''} priority-${task.priority}" data-action="toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>
        </div>
        <div class="task-content">
          <div class="task-title-row">
            <span class="task-title-text" data-action="inline-edit">${escapeHtml(task.title)}</span>
          </div>
          ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
          <div class="task-meta">
            <span class="task-tag tag-priority-${task.priority}">${task.priority.toUpperCase()}</span>
            <span class="task-tag tag-category">${task.category}</span>
            ${dueLabel}
          </div>
          ${subtasksTotal > 0 ? `<div class="subtask-progress"><div class="subtask-bar"><div class="subtask-bar-fill" style="width:${subtaskPercent}%"></div></div><span>${subtasksDone}/${subtasksTotal}</span></div>` : ''}
        </div>
        <div class="task-actions">
          <button class="task-action-btn" data-action="edit" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="task-action-btn btn-delete" data-action="delete" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      `;
      DOM.taskList.appendChild(card);
    });

    initDragAndDrop();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── TASK CRUD ─────────────────────────────── */
  function addTask(data) {
    const task = {
      id: generateId(), title: data.title, description: data.description || '',
      dueDate: data.dueDate || '', dueTime: data.dueTime || '',
      priority: data.priority || 'medium', category: data.category || 'Personal',
      completed: false, createdAt: Date.now(),
      subtasks: data.subtasks || [], reminder: data.reminder || false,
    };
    STATE.tasks.unshift(task);
    saveTasks();
    if (task.reminder && task.dueDate) scheduleReminder(task);
    showToast('Task created successfully!');
    refreshAll();
  }

  function updateTask(id, data) {
    const idx = STATE.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    Object.assign(STATE.tasks[idx], data);
    saveTasks();
    if (data.reminder && data.dueDate) scheduleReminder(STATE.tasks[idx]);
    showToast('Task updated!');
    refreshAll();
  }

  function deleteTask(id) {
    const idx = STATE.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    STATE.deletedTask = { task: STATE.tasks[idx], index: idx };
    STATE.tasks.splice(idx, 1);
    saveTasks();
    showUndoBar();
    refreshAll();
  }

  function toggleTask(id) {
    const task = STATE.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    showToast(task.completed ? 'Task completed! 🎉' : 'Task reopened.');
    refreshAll();
  }

  /* ── UNDO ──────────────────────────────────── */
  function showUndoBar() {
    clearTimeout(STATE.undoTimer);
    DOM.undoBar.classList.remove('hidden');
    STATE.undoTimer = setTimeout(() => {
      DOM.undoBar.classList.add('hidden');
      STATE.deletedTask = null;
    }, 5000);
  }

  function undoDelete() {
    if (!STATE.deletedTask) return;
    STATE.tasks.splice(STATE.deletedTask.index, 0, STATE.deletedTask.task);
    saveTasks();
    STATE.deletedTask = null;
    clearTimeout(STATE.undoTimer);
    DOM.undoBar.classList.add('hidden');
    showToast('Task restored!', 'info');
    refreshAll();
  }

  /* ── MODAL ─────────────────────────────────── */
  function openModal(editId) {
    const isEdit = !!editId;
    DOM.modalTitle.textContent = isEdit ? 'Edit Task' : 'New Task';
    DOM.taskEditId.value = editId || '';
    STATE.modalSubtasks = [];

    if (isEdit) {
      const task = STATE.tasks.find(t => t.id === editId);
      if (!task) return;
      DOM.taskTitle.value = task.title;
      DOM.taskDesc.value = task.description || '';
      DOM.taskDueDate.value = task.dueDate || '';
      DOM.taskDueTime.value = task.dueTime || '';
      DOM.taskPriority.value = task.priority;
      DOM.taskCategory.value = task.category;
      DOM.taskReminder.checked = task.reminder || false;
      STATE.modalSubtasks = (task.subtasks || []).map(s => ({ ...s }));
    } else {
      DOM.taskForm.reset();
      DOM.taskPriority.value = 'medium';
    }
    renderModalSubtasks();
    DOM.taskModal.classList.add('open');
    setTimeout(() => DOM.taskTitle.focus(), 100);
  }

  function closeModal() {
    DOM.taskModal.classList.remove('open');
    DOM.taskForm.reset();
    STATE.modalSubtasks = [];
  }

  function renderModalSubtasks() {
    DOM.subtaskList.innerHTML = STATE.modalSubtasks.map((s, i) => `
      <div class="subtask-item">
        <input type="checkbox" ${s.done ? 'checked' : ''} data-subtask-idx="${i}" />
        <span>${escapeHtml(s.title)}</span>
        <button type="button" data-remove-subtask="${i}">&times;</button>
      </div>`).join('');
  }

  /* ── INLINE EDITING ────────────────────────── */
  function startInlineEdit(titleEl, taskId) {
    titleEl.setAttribute('contenteditable', 'true');
    titleEl.focus();
    const onBlur = () => {
      titleEl.removeAttribute('contenteditable');
      const newTitle = titleEl.textContent.trim();
      if (newTitle && newTitle !== STATE.tasks.find(t => t.id === taskId)?.title) {
        updateTask(taskId, { title: newTitle });
      }
      titleEl.removeEventListener('blur', onBlur);
      titleEl.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } if (e.key === 'Escape') { titleEl.blur(); } };
    titleEl.addEventListener('blur', onBlur);
    titleEl.addEventListener('keydown', onKey);
  }

  /* ── DRAG & DROP ───────────────────────────── */
  function initDragAndDrop() {
    let dragId = null;
    DOM.taskList.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        dragId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        $$('.task-card').forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const targetId = card.dataset.id;
        if (dragId && dragId !== targetId) {
          const fromIdx = STATE.tasks.findIndex(t => t.id === dragId);
          const toIdx = STATE.tasks.findIndex(t => t.id === targetId);
          if (fromIdx !== -1 && toIdx !== -1) {
            const [moved] = STATE.tasks.splice(fromIdx, 1);
            STATE.tasks.splice(toIdx, 0, moved);
            saveTasks();
            renderTasks();
          }
        }
      });
    });
  }

  /* ── REMINDER ──────────────────────────────── */
  function scheduleReminder(task) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
    if (!task.dueDate) return;
    const dueMs = new Date(task.dueDate + (task.dueTime ? 'T' + task.dueTime : 'T09:00')).getTime();
    const delay = dueMs - Date.now() - 5 * 60 * 1000; // 5 min before
    if (delay > 0 && delay < 86400000) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('FlowTask Reminder', { body: task.title, icon: '📋' });
        }
      }, delay);
    }
  }

  /* ── DASHBOARD ─────────────────────────────── */
  function renderDashboard() {
    const total = STATE.tasks.length;
    const completed = STATE.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = STATE.tasks.filter(t => isOverdue(t)).length;
    const pct = total ? Math.round(completed / total * 100) : 0;

    DOM.statTotal.textContent = total;
    DOM.statCompleted.textContent = completed;
    DOM.statPending.textContent = pending;
    DOM.statOverdue.textContent = overdue;
    DOM.progressPercent.textContent = pct + '%';
    DOM.progressFill.style.width = pct + '%';
    DOM.dashboardGreeting.textContent = getGreeting();

    // Category bars
    const cats = Object.keys(CATEGORY_COLORS);
    const maxCat = Math.max(1, ...cats.map(c => STATE.tasks.filter(t => t.category === c).length));
    DOM.categoryBars.innerHTML = cats.map(c => {
      const count = STATE.tasks.filter(t => t.category === c).length;
      const pctC = Math.round(count / maxCat * 100);
      return `<div class="cat-bar-row"><span class="cat-bar-label">${c}</span><div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pctC}%;background:${CATEGORY_COLORS[c]}"></div></div><span class="cat-bar-count">${count}</span></div>`;
    }).join('');

    // Priority donut
    const high = STATE.tasks.filter(t => t.priority === 'high').length;
    const med = STATE.tasks.filter(t => t.priority === 'medium').length;
    const low = STATE.tasks.filter(t => t.priority === 'low').length;
    const circum = 2 * Math.PI * 55;
    DOM.donutCenter.textContent = total;

    // Remove old segments
    DOM.donutSvg.querySelectorAll('.donut-seg').forEach(s => s.remove());
    if (total > 0) {
      const segments = [
        { val: high, color: PRIORITY_COLORS.high },
        { val: med, color: PRIORITY_COLORS.medium },
        { val: low, color: PRIORITY_COLORS.low },
      ];
      let offset = 0;
      segments.forEach(seg => {
        if (seg.val === 0) return;
        const dash = (seg.val / total) * circum;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '70'); circle.setAttribute('cy', '70');
        circle.setAttribute('r', '55'); circle.classList.add('donut-seg');
        circle.setAttribute('stroke', seg.color);
        circle.setAttribute('stroke-dasharray', `${dash} ${circum - dash}`);
        circle.setAttribute('stroke-dashoffset', `${-offset}`);
        circle.style.transform = 'rotate(-90deg)'; circle.style.transformOrigin = '70px 70px';
        DOM.donutSvg.appendChild(circle);
        offset += dash;
      });
    }
    DOM.donutLegend.innerHTML = [
      { label: 'High', color: PRIORITY_COLORS.high, val: high },
      { label: 'Medium', color: PRIORITY_COLORS.medium, val: med },
      { label: 'Low', color: PRIORITY_COLORS.low, val: low },
    ].map(l => `<div class="donut-legend-item"><span class="donut-legend-dot" style="background:${l.color}"></span>${l.label} (${l.val})</div>`).join('');

    // Recent tasks
    const recent = [...STATE.tasks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    DOM.recentTasksList.innerHTML = recent.length
      ? recent.map(t => `<div class="recent-task-item"><span class="recent-task-dot" style="background:${CATEGORY_COLORS[t.category] || '#6C63FF'}"></span><span class="recent-task-title">${escapeHtml(t.title)}</span><span class="recent-task-time">${formatDate(t.dueDate) || 'No date'}</span></div>`).join('')
      : '<div style="padding:12px;color:var(--text3);font-size:.85rem;">No tasks yet.</div>';
  }

  /* ── BADGES ────────────────────────────────── */
  function updateBadges() {
    DOM.badgeAll.textContent = STATE.tasks.length;
    DOM.badgeToday.textContent = STATE.tasks.filter(t => isToday(t.dueDate) && !t.completed).length;
    DOM.badgeCompleted.textContent = STATE.tasks.filter(t => t.completed).length;
  }

  function refreshAll() {
    updateBadges();
    if (STATE.currentView === 'dashboard') renderDashboard();
    else if (STATE.currentView === 'calendar') renderCalendar();
    else if (STATE.currentView === 'planner') renderPlanner();
    else renderTasks();
  }

  /* ── CALENDAR ──────────────────────────────── */
  function renderCalendar() {
    const d = STATE.calendarDate;
    const year = d.getFullYear(), month = d.getMonth();
    DOM.calMonth.textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-header">${d}</div>`).join('');

    // Previous month padding
    const prevDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${prevDays - i}</div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday2 = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      const dayTasks = STATE.tasks.filter(t => t.dueDate === dateStr);
      const tasksHtml = dayTasks.slice(0, 3).map(t => `<div class="cal-task${t.priority === 'high' ? ' high' : ''}">${escapeHtml(t.title)}</div>`).join('');
      html += `<div class="cal-day${isToday2 ? ' today' : ''}"><div class="cal-day-num">${day}</div>${tasksHtml}</div>`;
    }

    // Next month padding
    const totalCells = firstDay + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder > 0) {
      for (let i = 1; i <= 7 - remainder; i++) {
        html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
      }
    }

    DOM.calendarGrid.innerHTML = html;
  }

  /* ── POMODORO ──────────────────────────────── */
  const POMO_CIRCUM = 2 * Math.PI * 115;
  DOM.pomoRing.setAttribute('stroke-dasharray', POMO_CIRCUM);

  function updatePomoDisplay() {
    const mins = Math.floor(STATE.pomodoro.seconds / 60);
    const secs = STATE.pomodoro.seconds % 60;
    DOM.pomoTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const total = POMO_DURATIONS[STATE.pomodoro.mode];
    const progress = 1 - STATE.pomodoro.seconds / total;
    DOM.pomoRing.setAttribute('stroke-dashoffset', POMO_CIRCUM * (1 - progress));
    DOM.pomoSessionCount.textContent = STATE.pomodoro.sessions;
  }

  function togglePomodoro() {
    if (STATE.pomodoro.running) {
      clearInterval(STATE.pomodoro.interval);
      STATE.pomodoro.running = false;
      DOM.pomoStart.textContent = 'Start';
    } else {
      STATE.pomodoro.running = true;
      DOM.pomoStart.textContent = 'Pause';
      STATE.pomodoro.interval = setInterval(() => {
        STATE.pomodoro.seconds--;
        if (STATE.pomodoro.seconds <= 0) {
          clearInterval(STATE.pomodoro.interval);
          STATE.pomodoro.running = false;
          DOM.pomoStart.textContent = 'Start';
          if (STATE.pomodoro.mode === 'work') {
            STATE.pomodoro.sessions++;
            showToast('Focus session complete! Take a break. 🎉');
          } else {
            showToast('Break over! Time to focus. 💪');
          }
          STATE.pomodoro.seconds = POMO_DURATIONS[STATE.pomodoro.mode];
          if (Notification.permission === 'granted') {
            new Notification('FlowTask Pomodoro', { body: STATE.pomodoro.mode === 'work' ? 'Session complete!' : 'Break is over!' });
          }
        }
        updatePomoDisplay();
      }, 1000);
    }
  }

  function resetPomodoro() {
    clearInterval(STATE.pomodoro.interval);
    STATE.pomodoro.running = false;
    STATE.pomodoro.seconds = POMO_DURATIONS[STATE.pomodoro.mode];
    DOM.pomoStart.textContent = 'Start';
    updatePomoDisplay();
  }

  function setPomoMode(mode) {
    clearInterval(STATE.pomodoro.interval);
    STATE.pomodoro.running = false;
    STATE.pomodoro.mode = mode;
    STATE.pomodoro.seconds = POMO_DURATIONS[mode];
    DOM.pomoStart.textContent = 'Start';
    $$('.pomo-tab').forEach(t => t.classList.toggle('active', t.dataset.pomo === mode));
    updatePomoDisplay();
  }

  /* ── DAILY PLANNER ─────────────────────────── */
  function renderPlanner() {
    const today = new Date();
    DOM.plannerDate.textContent = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let html = '';
    for (let h = 6; h <= 22; h++) {
      const hour = h % 12 || 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      const timeLabel = `${hour}:00 ${ampm}`;
      const hourStr = String(h).padStart(2, '0');
      const tasksAtHour = STATE.tasks.filter(t => t.dueDate === todayStr && t.dueTime && t.dueTime.startsWith(hourStr));
      const chips = tasksAtHour.map(t => `<span class="planner-task-chip">${escapeHtml(t.title)}</span>`).join('');
      html += `<div class="planner-slot"><div class="planner-time">${timeLabel}</div><div class="planner-content">${chips}</div></div>`;
    }
    DOM.plannerTimeline.innerHTML = html;
  }

  /* ── EXPORT / IMPORT ───────────────────────── */
  function exportJSON() {
    const blob = new Blob([JSON.stringify(STATE.tasks, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'flowtask_backup.json');
    showToast('Tasks exported as JSON!', 'info');
  }

  function exportCSV() {
    const headers = ['Title', 'Description', 'Priority', 'Category', 'Due Date', 'Due Time', 'Completed'];
    const rows = STATE.tasks.map(t => [t.title, t.description, t.priority, t.category, t.dueDate, t.dueTime, t.completed].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'flowtask_backup.csv');
    showToast('Tasks exported as CSV!', 'info');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function importTasks(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          STATE.tasks = data;
          saveTasks();
          refreshAll();
          showToast(`Imported ${data.length} tasks!`, 'success');
        } else { showToast('Invalid file format.', 'error'); }
      } catch { showToast('Failed to parse file.', 'error'); }
    };
    reader.readAsText(file);
  }

  /* ── DROPDOWN LOGIC ────────────────────────── */
  function toggleDropdown(menu) {
    const isOpen = menu.classList.contains('open');
    $$('.dropdown-menu').forEach(m => m.classList.remove('open'));
    if (!isOpen) menu.classList.add('open');
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      $$('.dropdown-menu').forEach(m => m.classList.remove('open'));
    }
  });

  /* ── EVENT LISTENERS ───────────────────────── */
  function initEvents() {
    // Sidebar toggle
    DOM.hamburgerBtn.addEventListener('click', openSidebar);
    DOM.sidebarCloseBtn.addEventListener('click', closeSidebar);
    DOM.sidebarOverlay.addEventListener('click', closeSidebar);

    // Theme
    DOM.themeToggle.addEventListener('click', toggleTheme);

    // Navigation (event delegation)
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (!navItem) return;
      const view = navItem.dataset.view;
      const category = navItem.dataset.category;
      if (view) setView(view, category);
    });

    // Open modal
    DOM.btnOpenAddModal.addEventListener('click', () => openModal());
    DOM.fab.addEventListener('click', () => openModal());
    DOM.modalClose.addEventListener('click', closeModal);
    DOM.btnCancelModal.addEventListener('click', closeModal);
    DOM.taskModal.addEventListener('click', (e) => { if (e.target === DOM.taskModal) closeModal(); });

    // Form submit
    DOM.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        title: DOM.taskTitle.value.trim(),
        description: DOM.taskDesc.value.trim(),
        dueDate: DOM.taskDueDate.value,
        dueTime: DOM.taskDueTime.value,
        priority: DOM.taskPriority.value,
        category: DOM.taskCategory.value,
        reminder: DOM.taskReminder.checked,
        subtasks: STATE.modalSubtasks,
      };
      if (!data.title) return;
      const editId = DOM.taskEditId.value;
      if (editId) updateTask(editId, data);
      else addTask(data);
      closeModal();
    });

    // Subtasks in modal
    DOM.btnAddSubtask.addEventListener('click', () => {
      const val = DOM.subtaskInput.value.trim();
      if (!val) return;
      STATE.modalSubtasks.push({ title: val, done: false });
      DOM.subtaskInput.value = '';
      renderModalSubtasks();
    });
    DOM.subtaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); DOM.btnAddSubtask.click(); }
    });
    DOM.subtaskList.addEventListener('click', (e) => {
      const rmIdx = e.target.closest('[data-remove-subtask]');
      if (rmIdx) { STATE.modalSubtasks.splice(Number(rmIdx.dataset.removeSubtask), 1); renderModalSubtasks(); }
    });
    DOM.subtaskList.addEventListener('change', (e) => {
      if (e.target.dataset.subtaskIdx !== undefined) {
        STATE.modalSubtasks[Number(e.target.dataset.subtaskIdx)].done = e.target.checked;
      }
    });

    // Task list event delegation
    DOM.taskList.addEventListener('click', (e) => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      const id = card.dataset.id;
      const action = e.target.closest('[data-action]');
      if (!action) return;
      switch (action.dataset.action) {
        case 'toggle': toggleTask(id); break;
        case 'edit': openModal(id); break;
        case 'delete': deleteTask(id); break;
        case 'inline-edit': startInlineEdit(action, id); break;
      }
    });

    // Undo
    DOM.undoBtn.addEventListener('click', undoDelete);

    // Search
    DOM.searchInput.addEventListener('input', (e) => {
      STATE.searchQuery = e.target.value;
      if (STATE.currentView === 'dashboard') setView('all');
      else renderTasks();
    });

    // Sort dropdown
    DOM.sortBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(DOM.sortMenu); });
    DOM.sortMenu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-sort]');
      if (!item) return;
      STATE.sortBy = item.dataset.sort;
      DOM.sortMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      DOM.sortMenu.classList.remove('open');
      renderTasks();
    });

    // Filter dropdown
    DOM.filterBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(DOM.filterMenu); });
    DOM.filterMenu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-filter-priority]');
      if (!item) return;
      STATE.filterPriority = item.dataset.filterPriority;
      DOM.filterMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      DOM.filterMenu.classList.remove('open');
      renderTasks();
    });

    // More dropdown
    DOM.moreBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(DOM.moreMenu); });
    DOM.btnExportJSON.addEventListener('click', () => { exportJSON(); DOM.moreMenu.classList.remove('open'); });
    DOM.btnExportCSV.addEventListener('click', () => { exportCSV(); DOM.moreMenu.classList.remove('open'); });
    DOM.btnImport.addEventListener('click', () => { DOM.fileImport.click(); DOM.moreMenu.classList.remove('open'); });
    DOM.fileImport.addEventListener('change', (e) => { if (e.target.files[0]) importTasks(e.target.files[0]); e.target.value = ''; });

    // Calendar nav
    DOM.calPrev.addEventListener('click', () => { STATE.calendarDate.setMonth(STATE.calendarDate.getMonth() - 1); renderCalendar(); });
    DOM.calNext.addEventListener('click', () => { STATE.calendarDate.setMonth(STATE.calendarDate.getMonth() + 1); renderCalendar(); });

    // Pomodoro
    DOM.pomoStart.addEventListener('click', togglePomodoro);
    DOM.pomoReset.addEventListener('click', resetPomodoro);
    document.querySelectorAll('.pomo-tab').forEach(tab => {
      tab.addEventListener('click', () => setPomoMode(tab.dataset.pomo));
    });

    // Shortcuts modal
    DOM.shortcutsClose.addEventListener('click', () => DOM.shortcutsModal.classList.remove('open'));
    DOM.shortcutsModal.addEventListener('click', (e) => { if (e.target === DOM.shortcutsModal) DOM.shortcutsModal.classList.remove('open'); });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Skip if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openModal(); }
      if (e.key === '1') setView('dashboard');
      if (e.key === '2') setView('all');
      if (e.key === '3') setView('today');
      if (e.key === '4') setView('calendar');
      if (e.key === '5') setView('pomodoro');
      if (e.key === '?') { e.preventDefault(); DOM.shortcutsModal.classList.add('open'); }
      if (e.key === 'Escape') { closeModal(); DOM.shortcutsModal.classList.remove('open'); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); DOM.searchInput.focus(); }
    });
  }

  /* ── INIT ──────────────────────────────────── */
  function init() {
    initTheme();
    loadTasks();
    initEvents();
    updatePomoDisplay();
    setView('dashboard');
  }

  // Boot
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();

