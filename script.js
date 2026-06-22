let transactions = [];
let editId = null;

const baseExpenseCategories = ['Еда', 'Транспорт', 'Развлечения', 'Учёба', 'Другое'];
const baseIncomeCategories  = ['Зарплата', 'Фриланс', 'Подарок', 'Другое'];

let customExpenseCategories = [];
let customIncomeCategories  = [];
const savedExpCats = localStorage.getItem('customExpenseCategories');
const savedIncCats = localStorage.getItem('customIncomeCategories');
if (savedExpCats) customExpenseCategories = JSON.parse(savedExpCats);
if (savedIncCats) customIncomeCategories  = JSON.parse(savedIncCats);

// миграция старых категорий в расходные
const oldCats = localStorage.getItem('customCategories');
if (oldCats && !savedExpCats) {
    customExpenseCategories = JSON.parse(oldCats);
    localStorage.setItem('customExpenseCategories', JSON.stringify(customExpenseCategories));
    localStorage.removeItem('customCategories');
}

let settings = { currencyName: '', currencyRate: 1, dailyLimit: 0, weakCategory: '' };
const savedSettings = localStorage.getItem('settings');
if (savedSettings) settings = Object.assign(settings, JSON.parse(savedSettings));

const API_URL = '/api/transactions';

if (localStorage.getItem('dark') === '1') {
    document.body.classList.add('dark');
    document.getElementById('themeBtn').textContent = 'Светлая тема';
}

document.getElementById('date').value = new Date().toISOString().slice(0, 10);
document.getElementById('currencyName').value = settings.currencyName;
document.getElementById('currencyRate').value = settings.currencyRate > 1 ? settings.currencyRate : '';
document.getElementById('dailyLimit').value   = settings.dailyLimit || '';

document.getElementById('type').addEventListener('change', updateFormCategorySelect);

function loadTransactions() {
    fetch(API_URL)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            transactions = data;
            render();
        })
        .catch(function(err) { console.error('Не удалось загрузить транзакции', err); });
}

function formatAmount(n) {
    if (settings.currencyName && settings.currencyRate > 1) {
        return (n / settings.currencyRate).toFixed(1) + ' ' + settings.currencyName;
    }
    return n + ' ₽';
}

function getCategories(type) {
    if (type === 'income') return baseIncomeCategories.concat(customIncomeCategories);
    return baseExpenseCategories.concat(customExpenseCategories);
}

function updateFormCategorySelect() {
    const type    = document.getElementById('type').value;
    const formCat = document.getElementById('category');
    const cur     = formCat.value;
    const cats    = getCategories(type);
    formCat.innerHTML = '';
    for (let i = 0; i < cats.length; i++) {
        const opt = document.createElement('option');
        opt.value = cats[i]; opt.textContent = cats[i];
        formCat.appendChild(opt);
    }
    if (cur && cats.indexOf(cur) !== -1) formCat.value = cur;
}

function updateCategorySelects() {
    updateFormCategorySelect();

    // фильтр — все уникальные категории
    const expCats = getCategories('expense');
    const incCats = getCategories('income');
    const allCats = expCats.slice();
    for (let i = 0; i < incCats.length; i++) {
        if (allCats.indexOf(incCats[i]) === -1) allCats.push(incCats[i]);
    }
    const filterCat = document.getElementById('filterCategory');
    const filterVal = filterCat.value;
    filterCat.innerHTML = '<option value="all">Все</option>';
    for (let i = 0; i < allCats.length; i++) {
        const opt = document.createElement('option');
        opt.value = allCats[i]; opt.textContent = allCats[i];
        filterCat.appendChild(opt);
    }
    if (filterVal) filterCat.value = filterVal;

    // слабое место — только расходные
    const weakSel = document.getElementById('weakCategory');
    weakSel.innerHTML = '<option value="">— не выбрано —</option>';
    for (let i = 0; i < expCats.length; i++) {
        const opt = document.createElement('option');
        opt.value = expCats[i]; opt.textContent = expCats[i];
        weakSel.appendChild(opt);
    }
    weakSel.value = settings.weakCategory || '';

    renderCustomCatList();
}

function renderCustomCatList() {
    const catList = document.getElementById('customCatList');
    catList.innerHTML = '';

    if (customExpenseCategories.length === 0 && customIncomeCategories.length === 0) {
        catList.innerHTML = '<span class="no-cats">Своих категорий нет</span>';
        return;
    }
    if (customExpenseCategories.length > 0) {
        catList.innerHTML += '<span class="cat-type-label">Расходы:</span>';
        for (let i = 0; i < customExpenseCategories.length; i++) {
            const n = customExpenseCategories[i];
            catList.innerHTML += '<span class="cat-tag">' + n +
                ' <button class="cat-del" onclick="deleteCustomCategory(\'expense\',\'' + n + '\')">×</button></span>';
        }
    }
    if (customIncomeCategories.length > 0) {
        catList.innerHTML += '<span class="cat-type-label">Доходы:</span>';
        for (let i = 0; i < customIncomeCategories.length; i++) {
            const n = customIncomeCategories[i];
            catList.innerHTML += '<span class="cat-tag cat-tag-income">' + n +
                ' <button class="cat-del" onclick="deleteCustomCategory(\'income\',\'' + n + '\')">×</button></span>';
        }
    }
}

function deleteCustomCategory(type, name) {
    if (type === 'expense') {
        customExpenseCategories = customExpenseCategories.filter(function(c) { return c !== name; });
        localStorage.setItem('customExpenseCategories', JSON.stringify(customExpenseCategories));
        if (settings.weakCategory === name) {
            settings.weakCategory = '';
            localStorage.setItem('settings', JSON.stringify(settings));
        }
    } else {
        customIncomeCategories = customIncomeCategories.filter(function(c) { return c !== name; });
        localStorage.setItem('customIncomeCategories', JSON.stringify(customIncomeCategories));
    }
    updateCategorySelects();
    render();
}

function resetSettings() {
    if (!confirm('Сбросить все настройки и удалить свои категории?')) return;
    settings = { currencyName: '', currencyRate: 1, dailyLimit: 0, weakCategory: '' };
    customExpenseCategories = [];
    customIncomeCategories  = [];
    localStorage.removeItem('settings');
    localStorage.removeItem('customExpenseCategories');
    localStorage.removeItem('customIncomeCategories');
    localStorage.removeItem('customCategories');
    document.getElementById('currencyName').value = '';
    document.getElementById('currencyRate').value = '';
    document.getElementById('dailyLimit').value   = '';
    updateCategorySelects();
    render();
}

function addCustomCategory() {
    const input = document.getElementById('newCategoryInput');
    const type  = document.getElementById('newCategoryType').value;
    const name  = input.value.trim();
    if (!name) return;

    const all = getCategories(type);
    for (let i = 0; i < all.length; i++) {
        if (all[i] === name) { alert('Такая категория уже есть'); return; }
    }

    if (type === 'expense') {
        customExpenseCategories.push(name);
        localStorage.setItem('customExpenseCategories', JSON.stringify(customExpenseCategories));
    } else {
        customIncomeCategories.push(name);
        localStorage.setItem('customIncomeCategories', JSON.stringify(customIncomeCategories));
    }
    input.value = '';
    updateCategorySelects();
}

function saveSettings() {
    settings.currencyName = document.getElementById('currencyName').value.trim();
    settings.currencyRate = Number(document.getElementById('currencyRate').value) || 1;
    settings.dailyLimit   = Number(document.getElementById('dailyLimit').value)   || 0;
    settings.weakCategory = document.getElementById('weakCategory').value;
    localStorage.setItem('settings', JSON.stringify(settings));
    render();
}

function toggleSettings() {
    const body  = document.getElementById('settingsBody');
    const arrow = document.getElementById('settingsArrow');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        arrow.textContent  = '▲';
    } else {
        body.style.display = 'none';
        arrow.textContent  = '▼';
    }
}

function toggleTheme() {
    if (document.body.classList.contains('dark')) {
        document.body.classList.remove('dark');
        document.getElementById('themeBtn').textContent = 'Тёмная тема';
        localStorage.setItem('dark', '0');
    } else {
        document.body.classList.add('dark');
        document.getElementById('themeBtn').textContent = 'Светлая тема';
        localStorage.setItem('dark', '1');
    }
}

const form = document.getElementById('form');

form.addEventListener('submit', function(e) {
    e.preventDefault();

    const type     = document.getElementById('type').value;
    const amount   = Number(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date     = document.getElementById('date').value;
    const comment  = document.getElementById('comment').value;

    if (amount <= 0) { alert('Сумма должна быть больше 0'); return; }

    if (editId === null && type === 'expense' && settings.weakCategory && category === settings.weakCategory) {
        const ok = confirm('⚠️ Это трата на "' + settings.weakCategory + '" — твоё слабое место. Точно продолжить?');
        if (!ok) return;
    }

    const payload = { type: type, amount: amount, category: category, date: date, comment: comment };

    if (editId !== null) {
        fetch(API_URL + '/' + editId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function() { cancelEdit(); loadTransactions(); })
            .catch(function(err) { console.error('Не удалось сохранить транзакцию', err); });
    } else {
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function() { loadTransactions(); })
            .catch(function(err) { console.error('Не удалось добавить транзакцию', err); });
    }

    document.getElementById('amount').value  = '';
    document.getElementById('comment').value = '';
});

function startEdit(id) {
    let t = null;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === id) { t = transactions[i]; break; }
    }
    if (!t) return;

    editId = id;
    document.getElementById('type').value = t.type;
    updateFormCategorySelect();
    document.getElementById('category').value = t.category;
    document.getElementById('amount').value   = t.amount;
    document.getElementById('date').value     = t.date;
    document.getElementById('comment').value  = t.comment;

    document.getElementById('formTitle').textContent   = 'Редактировать транзакцию';
    document.getElementById('submitBtn').textContent   = 'Сохранить';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    document.querySelector('.form-box').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    editId = null;
    form.reset();
    document.getElementById('date').value              = new Date().toISOString().slice(0, 10);
    document.getElementById('formTitle').textContent   = 'Новая транзакция';
    document.getElementById('submitBtn').textContent   = 'Добавить';
    document.getElementById('cancelBtn').style.display = 'none';
    updateFormCategorySelect();
}

function deleteItem(id) {
    if (editId === id) cancelEdit();
    fetch(API_URL + '/' + id, { method: 'DELETE' })
        .then(function() { loadTransactions(); })
        .catch(function(err) { console.error('Не удалось удалить транзакцию', err); });
}

// стрик — сколько дней подряд есть хоть одна транзакция
function calculateStreak() {
    if (transactions.length === 0) return 0;
    const dates = {};
    for (let i = 0; i < transactions.length; i++) dates[transactions[i].date] = true;

    const now = new Date();
    const pad = function(n) { return (n < 10 ? '0' : '') + n; };
    let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let streak = 0;
    while (true) {
        const dateStr = checkDate.getFullYear() + '-' + pad(checkDate.getMonth() + 1) + '-' + pad(checkDate.getDate());
        if (!dates[dateStr]) break;
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
}

function pluralDays(n) {
    if (n % 100 >= 11 && n % 100 <= 19) return 'дней';
    if (n % 10 === 1) return 'день';
    if (n % 10 >= 2 && n % 10 <= 4) return 'дня';
    return 'дней';
}

function updateStreak() {
    const streak = calculateStreak();
    const el = document.getElementById('streakDisplay');
    el.textContent = streak > 0 ? '🔥 ' + streak + ' ' + pluralDays(streak) : '—';
}

function render() {
    renderList();
    updateStats();
    updateStreak();
}

function renderList() {
    const list = document.getElementById('list');

    const filterType     = document.getElementById('filterType').value;
    const filterCategory = document.getElementById('filterCategory').value;
    const sortBy         = document.getElementById('sortBy').value;
    const dateFrom       = document.getElementById('dateFrom').value;
    const dateTo         = document.getElementById('dateTo').value;

    let arr = transactions.slice();
    if (filterType !== 'all')     arr = arr.filter(function(t) { return t.type === filterType; });
    if (filterCategory !== 'all') arr = arr.filter(function(t) { return t.category === filterCategory; });
    if (dateFrom) arr = arr.filter(function(t) { return t.date >= dateFrom; });
    if (dateTo)   arr = arr.filter(function(t) { return t.date <= dateTo; });

    if (sortBy === 'date') {
        arr.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    } else if (sortBy === 'amount') {
        arr.sort(function(a, b) { return b.amount - a.amount; });
    } else if (sortBy === 'category') {
        arr.sort(function(a, b) { return a.category.localeCompare(b.category); });
    }

    if (arr.length === 0) { list.innerHTML = '<p class="empty">Нет транзакций</p>'; return; }

    let html = '';
    for (let i = 0; i < arr.length; i++) {
        const t      = arr[i];
        const color  = t.type === 'income' ? 'green' : 'red';
        const sign   = t.type === 'income' ? '+' : '−';
        const isWeak = t.type === 'expense' && t.category === settings.weakCategory;

        html += '<div class="item' + (isWeak ? ' weak-item' : '') + '">';
        html += '  <div class="item-info">';
        html += '    <div class="date">' + formatDate(t.date) + '</div>';
        html += '    <div class="category">' + t.category + (isWeak ? ' 😈' : '') + '</div>';
        if (t.comment) html += '  <div class="comment">' + t.comment + '</div>';
        html += '  </div>';
        html += '  <div class="item-amount ' + color + '">' + sign + ' ' + formatAmount(t.amount) + '</div>';
        html += '  <div class="item-btns">';
        html += '    <button class="edit-btn" onclick="startEdit(' + t.id + ')">Изм.</button>';
        html += '    <button class="del-btn" onclick="deleteItem(' + t.id + ')">Удалить</button>';
        html += '  </div>';
        html += '</div>';
    }
    list.innerHTML = html;
}

function updateStats() {
    let balance = 0, income = 0, expense = 0;
    const now      = new Date();
    const curMonth = now.getMonth();
    const curYear  = now.getFullYear();
    const today    = now.toISOString().slice(0, 10);
    let todayExpense = 0, weakTotal = 0;

    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        const d = new Date(t.date);

        if (t.type === 'income') balance += t.amount;
        else                     balance -= t.amount;

        if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
            if (t.type === 'income') income  += t.amount;
            else                     expense += t.amount;
        }

        if (t.date === today && t.type === 'expense') todayExpense += t.amount;
        if (settings.weakCategory && t.category === settings.weakCategory && t.type === 'expense') weakTotal += t.amount;
    }

    document.getElementById('balance').textContent = formatAmount(balance);
    document.getElementById('income').textContent  = formatAmount(income);
    document.getElementById('expense').textContent = formatAmount(expense);

    const balEl = document.getElementById('balance');
    if (balance > 0)      balEl.className = 'green';
    else if (balance < 0) balEl.className = 'red';
    else                  balEl.className = '';

    const dailyCard = document.getElementById('dailyCard');
    if (settings.dailyLimit > 0) {
        const left   = settings.dailyLimit - todayExpense;
        const leftEl = document.getElementById('dailyLeft');
        leftEl.textContent = formatAmount(left >= 0 ? left : 0);
        leftEl.className   = left <= 0 ? 'red' : (left < settings.dailyLimit * 0.2 ? 'red' : 'green');
        document.getElementById('dailySpent').textContent = 'Потрачено: ' + formatAmount(todayExpense);
        dailyCard.style.display = 'block';
    } else {
        dailyCard.style.display = 'none';
    }

    const weakCard = document.getElementById('weakCard');
    if (settings.weakCategory) {
        document.getElementById('weakTotal').textContent     = formatAmount(weakTotal);
        document.getElementById('weakCardTitle').textContent = '😈 ' + settings.weakCategory;
        weakCard.style.display = 'block';
    } else {
        weakCard.style.display = 'none';
    }

    document.getElementById('extraStats').style.display =
        (settings.dailyLimit > 0 || settings.weakCategory) ? 'flex' : 'none';
}

function exportCSV() {
    if (transactions.length === 0) { alert('Нет транзакций для экспорта'); return; }
    let csv = 'Дата;Тип;Категория;Сумма;Комментарий\n';
    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        csv += formatDate(t.date) + ';' + (t.type === 'income' ? 'Доход' : 'Расход') + ';' +
               t.category + ';' + t.amount + ';' + t.comment + '\n';
    }
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'transactions.csv'; link.click();
    URL.revokeObjectURL(url);
}

function clearDates() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value   = '';
    render();
}

function formatDate(str) {
    const parts = str.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
}

updateCategorySelects();
loadTransactions();
