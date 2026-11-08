(() => {
  'use strict';

  const STORAGE_KEY = 'dela.todo.tasks.v1';
  const elements = {
    form: document.querySelector('#task-form'),
    input: document.querySelector('#task-input'),
    hint: document.querySelector('#form-hint'),
    list: document.querySelector('#task-list'),
    empty: document.querySelector('#empty-state'),
    emptyTitle: document.querySelector('#empty-title'),
    emptyCopy: document.querySelector('#empty-copy'),
    total: document.querySelector('#total-count'),
    active: document.querySelector('#active-count'),
    completed: document.querySelector('#completed-count'),
    allFilterCount: document.querySelector('#filter-all-count'),
    progress: document.querySelector('#progress-fill'),
    clear: document.querySelector('#clear-completed'),
    storageStatus: document.querySelector('#storage-status'),
    toast: document.querySelector('#toast'),
    filterButtons: [...document.querySelectorAll('[data-filter]')]
  };

  let tasks = loadTasks();
  let currentFilter = 'all';
  let toastTimer;

  function loadTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) throw new Error('Некорректный формат данных');
      return parsed.filter(task => task && typeof task.id === 'string' && typeof task.text === 'string' && typeof task.completed === 'boolean');
    } catch (error) {
      console.warn('Не удалось прочитать задачи из localStorage:', error);
      elements.storageStatus.textContent = 'Не удалось загрузить данные';
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      elements.storageStatus.textContent = 'Только для вас';
      return true;
    } catch (error) {
      console.warn('Не удалось сохранить задачи в localStorage:', error);
      elements.storageStatus.textContent = 'Ошибка сохранения';
      showToast('Не удалось сохранить изменения в браузере');
      return false;
    }
  }

  function makeId() {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function getVisibleTasks() {
    if (currentFilter === 'active') return tasks.filter(task => !task.completed);
    if (currentFilter === 'completed') return tasks.filter(task => task.completed);
    return tasks;
  }

  function render() {
    const completedCount = tasks.filter(task => task.completed).length;
    const activeCount = tasks.length - completedCount;
    elements.total.textContent = String(tasks.length);
    elements.active.textContent = String(activeCount);
    elements.completed.textContent = String(completedCount);
    elements.allFilterCount.textContent = String(tasks.length);
    elements.progress.style.width = tasks.length ? `${Math.round(completedCount / tasks.length * 100)}%` : '0%';
    elements.progress.parentElement.setAttribute('aria-label', `Выполнено ${completedCount} из ${tasks.length}`);
    elements.clear.disabled = completedCount === 0;

    const visibleTasks = getVisibleTasks();
    elements.list.replaceChildren(...visibleTasks.map(createTaskElement));
    const isEmpty = visibleTasks.length === 0;
    elements.empty.hidden = !isEmpty;
    if (isEmpty) {
      if (tasks.length === 0) {
        elements.emptyTitle.textContent = 'Пока здесь чисто';
        elements.emptyCopy.textContent = 'Добавьте первую задачу — маленький шаг уже считается.';
      } else if (currentFilter === 'active') {
        elements.emptyTitle.textContent = 'Все задачи выполнены';
        elements.emptyCopy.textContent = 'Отличная работа — активных задач не осталось.';
      } else {
        elements.emptyTitle.textContent = 'Выполненных пока нет';
        elements.emptyCopy.textContent = 'Отмечайте задачи галочкой, когда закончите.';
      }
    }
  }

  function createTaskElement(task) {
    const item = document.createElement('li');
    item.className = `task-item${task.completed ? ' is-completed' : ''}`;
    item.dataset.id = task.id;

    const checkbox = document.createElement('input');
    checkbox.className = 'task-toggle';
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', task.completed ? `Отметить задачу «${task.text}» как активную` : `Отметить задачу «${task.text}» как выполненную`);
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    const remove = document.createElement('button');
    remove.className = 'delete-button';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Удалить задачу «${task.text}»`);
    remove.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m3 0-.7 10H5.7L5 6m3 3v4m4-4v4"/></svg>';
    remove.addEventListener('click', () => deleteTask(task.id));

    item.append(checkbox, text, remove);
    return item;
  }

  function addTask(text) {
    const normalizedText = text.trim();
    if (!normalizedText) {
      elements.hint.textContent = 'Введите текст задачи, чтобы добавить её';
      elements.input.focus();
      return;
    }
    tasks.unshift({ id: makeId(), text: normalizedText, completed: false, createdAt: Date.now() });
    currentFilter = 'all';
    updateFilterTabs();
    saveTasks();
    render();
    elements.input.value = '';
    elements.hint.textContent = 'Нажмите Enter, чтобы быстро добавить задачу';
    elements.input.focus();
  }

  function toggleTask(id) {
    tasks = tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
    saveTasks();
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    saveTasks();
    render();
  }

  function clearCompleted() {
    const count = tasks.filter(task => task.completed).length;
    if (!count) return;
    const noun = count === 1 ? 'выполненную задачу' : count < 5 ? 'выполненные задачи' : 'выполненных задач';
    if (!window.confirm(`Удалить ${count} ${noun}? Это действие нельзя отменить.`)) return;
    tasks = tasks.filter(task => !task.completed);
    saveTasks();
    render();
    showToast('Выполненные задачи удалены');
  }

  function updateFilterTabs() {
    elements.filterButtons.forEach(button => {
      const selected = button.dataset.filter === currentFilter;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('show'), 2600);
  }

  elements.form.addEventListener('submit', event => {
    event.preventDefault();
    addTask(elements.input.value);
  });

  elements.input.addEventListener('input', () => {
    if (elements.input.value.trim()) elements.hint.textContent = 'Нажмите Enter, чтобы быстро добавить задачу';
  });

  elements.filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      updateFilterTabs();
      render();
    });
  });

  elements.clear.addEventListener('click', clearCompleted);
  render();
})();
